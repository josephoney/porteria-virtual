# Checklist de producción v1

Lista de go/no-go para la primera puesta en producción. Cada ítem debe tener evidencia y responsable. Lo que esté en **Pendiente** bloquea el go-live o requiere aceptación explícita del riesgo.

## 1. Seguridad y secretos

- [ ] TLS/HTTPS en dashboard, pass-web y API.
- [ ] `JWT_SECRET`, `JWT_REFRESH_SECRET`, `PASS_QR_SECRET` e `INTERNAL_API_KEY` generados con al menos 32 caracteres y guardados fuera del repo.
- [ ] `POSTGRES_PASSWORD` fuerte; no se usa `porteria_dev`.
- [ ] `COOKIE_SECURE=true` y cookies `HttpOnly`/`SameSite=Lax`.
- [ ] `CORS_ORIGINS` limitado a los dominios reales.
- [ ] `SEED_DEMO_DATA=false`; no hay usuarios demo (`superadmin@porteria.local`, `porteria123`, etc.).
- [ ] Bootstrap inicial ejecutado con contraseña fuerte y `BOOTSTRAP_FORCE_PASSWORD=false`.
- [ ] Rate limit de login activo (`AUTH_LOGIN_RATE_LIMIT=10`).
- [ ] Rate limits de pases activos (preview/bind/QR/status).
- [ ] `/metrics` restringido por red/firewall.
- [ ] Revisión de PII: documento enmascarado en listados, tokens crudos fuera de logs, y ventana de retención configurada por organización (ver `docs/runbook-produccion.md`).
- [ ] Plan de rotación de secretos y revocación de refresh tokens probado.
- [ ] Dependencias auditadas (`pnpm audit`) y sin vulnerabilidades críticas abiertas.
- **Pendiente**: Sentry/error tracking no está cableado; `SENTRY_DSN` es reservado.
- **Pendiente**: rate limiting distribuido (si se escala a más de una instancia de API).

## 2. Infraestructura

- [ ] Servidor con Docker y Docker Compose.
- [ ] DNS: `app.<dominio>`, `pases.<dominio>` y, si aplica, `api.<dominio>`.
- [ ] Puertos 80/443 abiertos; TLS automático con Caddy.
- [ ] `deploy/docker-compose.prod.yml` levanta `db`, `migrate`, `api`, `signaling`, `web`.
- [ ] Migraciones aplicadas (`migrate`) antes de arrancar el API.
- [ ] `/health` y `/ready` responden 200.
- [ ] Backups automáticos de Postgres + volumen `uploads`; restauración probada.
- [ ] Staging separado de producción.
- [ ] CI verde en `master` (typecheck, tests, lint).
- [ ] Estrategia de actualización: build, migrate, rolling restart, rollback.
- [ ] Monitoreo de disco, CPU y memoria del host.
- **Pendiente**: proveedor de base gestionada con PITR si se elige esa opción.
- **Pendiente**: WAF/rate limit de borde si se expone a Internet sin proxy administrado.

## 3. Observabilidad

- [ ] `/metrics` scrapeado por Prometheus o equivalente.
- [ ] Dashboard con requests, errores 5xx, p95 y uptime.
- [ ] Alertas: API caída, DB no ready, 5xx > 1%, p95 > 1s, outbox backlog, picos de `invalid_or_expired_token`.
- [ ] Logs JSON con `reqId`, sin tokens ni documentos completos.
- [ ] Retención de logs definida (mínimo 30 días).
- [ ] Ventana de retención de la identidad del visitante definida por organización (12 meses por defecto) y verificada en simulación antes de habilitar la escritura.
- [ ] Uptime monitor externo para `/health` y `/ready`.
- [ ] Runbook de incidentes accesible al equipo.
- **Pendiente**: Sentry/GlitchTip para excepciones; el DSN está reservado pero el SDK no está integrado.
- **Pendiente**: métricas de negocio (pases creados, escaneos, rechazos) si se necesitan para operación.

## 4. Build móvil y distribución

- [ ] `eas.json` con perfiles `development`, `preview` y `production`.
- [ ] `EXPO_PUBLIC_API_URL` apunta a HTTPS de producción; no hay `localhost` ni HTTP.
- [ ] `NSAllowsArbitraryLoads` y `usesCleartextTraffic` eliminados.
- [ ] Ícono 1024×1024, adaptive icon Android y splash definidos y versionados.
- [ ] Build Android `preview` (APK) instalado y probado en un teléfono real.
- [ ] Build Android `production` (AAB) subido a Play Console (internal testing).
- [ ] Build iOS/TestFlight si se lanza en iOS.
- [ ] Cámara probada en development build; Expo Go no alcanza para el escaneo.
- [ ] Deep link `zima-qr-access://` probado.
- [ ] Crash reporting configurado (Sentry/Expo) o aceptado como pendiente.
- [ ] Política de privacidad y términos publicados, con el plazo de conservación de la identidad del visitante que define cada organización.
- [ ] Ficha de tienda: nombre, descripción, capturas, clasificación, permisos.
- **Pendiente**: cuentas Expo/EAS, Play Console y Apple Developer.
- **Pendiente**: ícono/splash definitivos (hoy no están versionados).
- **Pendiente**: prueba iOS real si aplica.

## 5. Runbook y onboarding

- [ ] `docs/runbook-produccion.md` revisado por N1/N2.
- [ ] `docs/onboarding-comunidad.md` usado en una comunidad piloto.
- [ ] Guardias capacitados: turno, cambio de acceso, escaneo, confirmar/rechazar, cierre.
- [ ] Residentes capacitados: crear pase, mostrar QR, compartir link, regenerar link.
- [ ] Community admin capacitado: accesos, usuarios, bitácora, force-close.
- [ ] Canal de soporte y escalamiento definidos.
- [ ] Procedimiento de alta de comunidad probado de punta a punta.
- [ ] Retención de datos y PII acordada con la comunidad: la plataforma anonimiza la identidad pasado el plazo que la organización define (12 meses por defecto, entre 1 y 60).
- [ ] Plan de comunicación para incidentes.

## 6. Contrato de API v1

- [ ] `docs/api-v1-contract.md` congelado y revisado.
- [ ] `GET /api/version` devuelve `api: "v1"` y `contract: 1`.
- [ ] `server/api/test/api-contract.test.ts` verde.
- [ ] Endpoints, DTOs y códigos de error documentados.
- [ ] Política de versionado: cambios breaking van a `/api/v2`; v1 se mantiene 6 meses.
- [ ] Clientes móviles toleran campos nuevos (ignoran desconocidos).
- [ ] Pruebas de integración de pases, escaneos, turnos y bitácora verdes.
- [ ] Prueba de contrato ejecutada en CI.

## 7. Go/no-go

| Área               | Responsable | Evidencia | Estado |
| ------------------ | ----------- | --------- | ------ |
| Seguridad          |             |           |        |
| Infraestructura    |             |           |        |
| Observabilidad     |             |           |        |
| Mobile             |             |           |        |
| Runbook/onboarding |             |           |        |
| API v1             |             |           |        |

**Go-live solo si:** todos los ítems bloqueantes están tildados o tienen aceptación escrita del riesgo. Los pendientes de Sentry, íconos/splash y tiendas deben tener fecha o aceptación explícita.

## 8. Después del go-live

- [ ] Primer día: monitoreo activo y guardia de soporte.
- [ ] Primera semana: revisar errores, picos de QR inválido y backlog de outbox.
- [ ] Primer mes: revisar backups, capacidad y feedback de guardias/residentes.
- [ ] Actualizar este checklist con lo aprendido.
