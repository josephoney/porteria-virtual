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

Los respaldos los genera `deploy/backup.sh` (ver `deploy/README.md`, sección 4):
`backups/porteria-<fecha>.dump` en el servidor y una copia en el bucket remoto.

1. Elegir el archivo. Si el servidor se perdió, bajarlo primero del bucket con
   `rclone` y verificarlo contra su `.sha256`.
2. Revisar qué contiene, sin tocar nada:

```bash
bash deploy/restore.sh backups/porteria-20260101T033000Z.dump --list
```

3. Restaurar. El script detiene `api` y `web`, pide confirmación escrita y corre
   `pg_restore --clean --if-exists --no-owner`:

```bash
bash deploy/restore.sh backups/porteria-20260101T033000Z.dump --confirm
```

4. Restaurar el volumen `uploads` si se usan assets locales.
5. Ejecutar migraciones pendientes: `pnpm --filter @porteria/database db:migrate`.
6. Levantar API/web y verificar `/ready`, login y un pase de prueba.
7. Registrar el incidente y el **RPO real** (cuánto dato se perdió, según la
   antigüedad del dump) y el **RTO real** (cuánto tardó todo el procedimiento).

Si `pg_restore` termina con errores, no levantar el stack: leer la salida,
corregir la causa y volver a empezar sobre una base limpia.

## 11. Comandos útiles

```bash
# Estado y logs
docker compose --env-file .env.production -f docker-compose.prod.yml ps
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f api
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f web

# Migraciones y bootstrap
docker compose ... run --rm migrate
docker compose ... --profile bootstrap run --rm bootstrap

# Backup (dump validado + subida fuera del servidor)
bash deploy/backup.sh

# Ver el último respaldo
tail -n 20 backups/backup.log
ls -lh backups/
```

## 12. Post-incidente

- Registrar: hora de detección, impacto, causa, mitigación, tiempo de recuperación.
- Crear una tarea con la causa raíz y una prueba que evite la regresión.
- Actualizar este runbook si el procedimiento cambió.
