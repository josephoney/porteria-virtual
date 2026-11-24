# Runbook de producción

Guía operativa para incidentes de Portería Virtual. Está pensada para quien esté de guardia: primero se diagnostica, después se mitiga y recién al final se investiga la causa raíz.

## Contactos y escalamiento

| Nivel | Responsable                     | Cuándo escalar                                              |
| ----- | ------------------------------- | ----------------------------------------------------------- |
| N1    | Soporte / operador de guardia   | Primer contacto, triage y mitigación básica                 |
| N2    | Responsable técnico             | API, base de datos, QR, turnos o seguridad                  |
| N3    | Arquitecto / dueño del producto | Pérdida de datos, incidente de seguridad o caída prolongada |

> Completar teléfonos, correo y canal interno antes del go-live. No dejar datos reales en este documento.

## Triage rápido

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml ps
curl -fsS https://app.<dominio>/health
curl -fsS https://app.<dominio>/ready
curl -fsS https://app.<dominio>/api/version
```

- `/health` responde `200` si el proceso está vivo.
- `/ready` responde `200` con `db: "ok"`; `503` si Postgres no responde.
- `/metrics` expone métricas Prometheus. Debe estar restringido por red o firewall.
- Logs: `docker compose ... logs -f api` (JSON de Pino, con `reqId`).

## 1. API caída o 502/504

1. Verificar contenedores: `docker compose ... ps`.
2. Revisar logs del API: `docker compose ... logs --tail=200 api`.
3. Confirmar configuración: el API no arranca en producción si falta un secreto, `CORS_ORIGINS`, URLs HTTPS, `COOKIE_SECURE=true` o `POSTGRES_PASSWORD`.
4. Reiniciar solo el API: `docker compose ... restart api`.
5. Si el puerto está tomado, revisar `docker compose ... ps` y procesos del host.
6. Si el problema es la base, seguir el incidente 2.

## 2. Base de datos caída o `/ready` con 503

1. `docker compose ... logs --tail=200 db`.
2. `docker compose ... exec db pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"`.
3. Revisar disco: `df -h`; Postgres se detiene si no puede escribir.
4. Revisar conexiones: `SELECT count(*) FROM pg_stat_activity;`.
5. Reiniciar la base solo si no hay riesgo de corrupción: `docker compose ... restart db`.
6. Si hay corrupción o pérdida de volumen, restaurar el último backup (sección 10). No improvisar `initdb` sobre un volumen con datos.

## 3. QR inválido o expirado

Síntomas: el guardia escanea y recibe `invalid_or_expired_token`, `not_valid_now`, `pass_used`, `not_bound` o `device_already_bound`.

Checklist:

1. **TTL**: el QR vive 24 segundos (`PASS_QR_TTL_SECONDS`). Si la pantalla del residente quedó en segundo plano, el token viejo expira. Pedir que mantenga la pantalla del pase abierta y en primer plano.
2. **Secreto**: todos los procesos que firman y validan QR deben usar el mismo `PASS_QR_SECRET`. Si hay varias instancias o un proxy apuntando a otra API, comparar `/api/version` y el entorno. Un secreto distinto produce `invalid signature`.
3. **Vinculación**: el link público se vincula al primer dispositivo. Si se abrió en otro dispositivo, el segundo recibe `device_already_bound`. Solución: **Regenerar link** desde la app del residente y abrir el link nuevo primero en el dispositivo correcto.
4. **Estado del pase**: verificar `status` (`active`, `used`, `revoked`, `expired`) y `presence_state` (`outside`, `inside`).
5. **Horario**: si está fuera de `valid_from`/`valid_until` o de la ventana diaria, el QR devuelve `not_valid_now`. Para salir, el sistema permite el egreso aunque la ventana ya haya terminado.
6. **Acceso**: el guardia debe tener un turno abierto en el acceso correcto. Si no, `no_active_shift` o `not_on_shift_at_access_point`.
7. **Dirección**: un acceso `entry` no permite salida y uno `exit` no permite entrada. Verificar `direction` del access point.

Consulta de diagnóstico:

```sql
SELECT id, status, presence_state, valid_from, valid_until, time_from, time_to,
       link_expires_at, bound_at, device_key_hash IS NOT NULL AS bound
FROM access_passes
WHERE id = '<pass-id>';
```

## 4. Link vinculado al dispositivo equivocado

1. En la app del residente, abrir el pase y tocar **Regenerar link**.
2. El endpoint `POST /api/passes/:id/regenerate-link` rota el token, limpia `device_key_hash`/`bound_at` y reinicia los intentos de PIN.
3. Abrir el link nuevo primero en el dispositivo que va a mostrar el QR.
4. No compartir el link por WhatsApp antes de abrirlo: el primer dispositivo que lo abre queda vinculado.

Si la app no está disponible, un `org_admin`/`community_admin` puede pedir al residente que repita el proceso; no hay endpoint administrativo para regenerar el link de otro usuario en v1.

## 5. Turno abierto olvidado

1. El guardia puede cerrar su turno desde el panel `/guard` o desde la app.
2. Un `community_admin`/`org_admin` puede forzar el cierre:
   `POST /api/guard/shifts/:id/force-close` con `{ "reason": "..." }`.
3. Si no hay acceso al dashboard, usar SQL de emergencia (solo lectura y luego actualización controlada):

```sql
SELECT id, guard_person_id, status, started_at
FROM guard_shifts
WHERE status = 'open'
ORDER BY started_at;
```

4. El cierre deja una entrada `shift_end` en la bitácora del acceso. No borrar turnos ni entradas.

## 6. Acceso o portería fuera de servicio

1. Desactivar el access point desde **Admin → Accesos** (`DELETE /api/communities/:id/access-points/:id`).
2. Pedir al guardia que cambie de acceso en su turno (**Cambiar acceso**). El sistema cierra el segmento anterior con `reassigned` y abre uno nuevo.
3. Si el acceso se reemplaza definitivamente, crear uno nuevo con nombre distinto y dejar el viejo inactivo. La bitácora conserva el nombre histórico.

## 7. Escaneo duplicado o pendiente

- Cada QR tiene un `jti` único; un segundo escaneo del mismo token devuelve `token_already_used` (409).
- Un escaneo pendiente expira a los 180 segundos (`PASS_SCAN_PENDING_TTL_SECONDS`). Confirmar después devuelve `scan_expired`.
- Si el guardia confirma dos veces, la segunda devuelve `scan_already_processed`.
- Consulta:

```sql
SELECT id, pass_id, status, action, scanned_at, confirmed_at
FROM pass_scans
WHERE token_jti = '<jti>';
```

No borrar `pass_scans`: son parte de la auditoría.

## 8. Outbox con backlog

1. Consultar:

```sql
SELECT status, count(*) FROM outbox_events GROUP BY status;
SELECT id, event_type, status, attempts, available_at, last_error
FROM outbox_events
WHERE status IN ('pending', 'processing', 'dead')
ORDER BY created_at
LIMIT 50;
```

2. Si el worker está deshabilitado (`OUTBOX_WORKER_ENABLED=false`), habilitarlo y reiniciar el API.
3. Si hay eventos `dead`, revisar `last_error`; no reencolar a ciegas.
4. Los eventos `processing` viejos se pueden resetear con el mecanismo del worker (`resetProcessing`) o reiniciando el proceso.
5. Confirmar que los eventos de pases usan `topic='events'`; las notificaciones quedan para fase 2.

## 9. Incidente de seguridad

1. Rotar `JWT_SECRET`, `JWT_REFRESH_SECRET` y `PASS_QR_SECRET`.
2. Revocar refresh tokens:

```sql
UPDATE refresh_tokens SET revoked = true WHERE revoked = false;
```

3. Desactivar cuentas comprometidas: `UPDATE accounts SET active = false WHERE email = '<email>';` y `UPDATE users SET status = 'inactive' ...` si aplica.
4. Revisar logs por `reqId`, IPs y endpoints sensibles.
5. Forzar regeneración de links de pases activos si se sospecha filtración.
6. Documentar el incidente y notificar según el protocolo legal correspondiente.

## 10. Restauración de backup

1. Detener API y web para evitar escrituras.
2. Restaurar Postgres:

```bash
docker compose ... exec -T db pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists < backup.dump
```

3. Restaurar el volumen `uploads` si se usan assets locales.
4. Ejecutar migraciones pendientes: `pnpm --filter @porteria/database db:migrate`.
5. Levantar API/web y verificar `/ready`, login y un pase de prueba.
6. Registrar el incidente y el RPO/RTO real.

## 11. Retención y privacidad de datos

La retención tiene dos formas, porque el registro tiene dos dueños:

- **La bitácora** (registro operativo de la comunidad) pierde al visitante
  completo pasada la ventana: nombre, documento, acompañantes y placa; el resumen
  pasa a «Acceso anonimizado». Conserva la hora, la portería, el resultado, el
  motivo, el turno y **quien autorizó**, que es la pregunta de una investigación.
- **El pase** (constancia del residente) conserva nombre, acompañantes y placa, y
  sólo anonimiza el documento. El residente sigue viendo quién entró a su unidad y
  a qué hora, aunque ya no pueda recuperar la cédula.

Los escaneos conservan nombre y hora y anonimizan el documento. Mientras el
documento exista, residente y guardia lo ven enmascarado después del uso; sólo el
escaneo en vivo lo muestra completo.

La ventana del pase se mide por su **último uso** (o su creación si nunca se usó),
no por su vencimiento: un pase de larga vigencia no conserva la cédula más tiempo
que sus visitas.

La ventana la define cada organización en **Mi organización → Retención de
datos**: 30, 60 o 90 días (30 por defecto). La organización es la responsable del
dato. El detalle del tratamiento está en `docs/tratamiento-datos-personales.md`.

1. El barrido corre cada `RETENTION_INTERVAL_MINUTES` (1440 por defecto) y, si
   `RETENTION_WRITE_ENABLED` no es `true`, **sólo simula**: cuenta lo que haría y
   registra la corrida sin escribir. Es el estado por defecto.
2. Para ver qué haría hoy, esperar una corrida de simulación y leer el historial
   en la misma pantalla. También queda en los logs del API:
   `[retention] <dry run|applied>: N organization(s), N pass(es), N scan(s), N bitacora entry(ies), N row(s) kept by an active hold`.
3. Para habilitar la escritura: `RETENTION_WRITE_ENABLED=true` y reiniciar el
   API. La primera corrida real ocurre recién al cumplirse el intervalo, no al
   arrancar.
4. Apagar el worker: `RETENTION_WORKER_ENABLED=false`.
5. Idempotencia: una segunda corrida sobre la misma ventana informa cero filas.
   La marca de anonimizado (`visitor_document = 'ANONIMIZADO'`) evita reprocesar.

### Preservación por incidente

Cuando ocurre un incidente, la organización preserva un rango de fechas antes de
que la ventana lo alcance, desde **Mi organización → Preservaciones**. Tiene
motivo, autor y **vencimiento obligatorio**; mientras esté vigente el barrido no
toca ese rango y lo informa como `preserved`. Al liberarla, el rango vuelve a
quedar sujeto a la ventana.

Preservar no copia datos: sólo impide su anonimización durante el plazo.

**Si se anonimizó por error**: no hay rollback. La identidad se sobrescribió en
`access_passes`, `pass_scans` y `bitacora_entries`; sólo el backup la recupera,
y restaurarlo devuelve también el resto de los datos a ese momento — evaluar el
costo antes. Si el plazo estaba mal, corregirlo en la organización **antes** de
la siguiente corrida.

### Consentimiento

El pase no entrega su QR hasta que la persona acepte el aviso: la casilla no
viene premarcada y el sistema registra fecha, IP, agente y versión de la política.
Si el guardia registra la entrada sin que la persona haya abierto el enlace, el
consentimiento queda marcado como `at_gate`. Cambiar `PRIVACY_POLICY_VERSION`
(`server/api/src/lib/privacy-policy.ts`) obliga a aceptar de nuevo.

**Excepción conocida**: `bitacora_entries` es inmutable por trigger
(`prevent_bitacora_update`, migraciones 0034, 0035 y 0036). El único `UPDATE`
permitido es el que reemplaza el documento por `ANONIMIZADO` y no toca nada más
—la función compara la forma de la fila—; cualquier otro cambio sigue fallando
con `bitacora rows are immutable`.

**Fuera de alcance**: el directorio `people`/`accounts` (residentes y personal)
y la tabla legacy `visitors` no entran en esta ventana. Los textos libres que
escribe el guardia en el resumen de la bitácora tampoco se anonimizan: si alguien
escribió un documento en el resumen, ese texto permanece.

## 12. Comandos útiles

```bash
# Estado y logs
docker compose --env-file .env.production -f docker-compose.prod.yml ps
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f api
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f web

# Migraciones y bootstrap
docker compose ... run --rm migrate
docker compose ... --profile bootstrap run --rm bootstrap

# Backup
docker compose ... exec -T db pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > backup-$(date +%F).dump
```

## 13. Post-incidente

- Registrar: hora de detección, impacto, causa, mitigación, tiempo de recuperación.
- Crear una tarea con la causa raíz y una prueba que evite la regresión.
- Actualizar este runbook si el procedimiento cambió.
