# Observabilidad — Portería Virtual

## Señales disponibles

| Señal     | Endpoint / fuente             | Uso                                               |
| --------- | ----------------------------- | ------------------------------------------------- |
| Liveness  | `GET /health`                 | Proceso vivo. Devuelve versión y timestamp.       |
| Readiness | `GET /ready`                  | DB responde (`select 1`) y estado del outbox.     |
| Métricas  | `GET /metrics`                | Formato Prometheus (`text/plain`).                |
| Versión   | `GET /api/version`            | `api: v1`, `contract: 1`, versión y entorno.      |
| Logs      | stdout (JSON de Fastify/Pino) | Request ID, método, URL redaccionada, status, ms. |
| Errores   | `SENTRY_DSN` (reservado)      | Error tracking; ver nota al final.                |

`/metrics` está pensado para scraping interno. Bloquealo desde internet o expone solo la red de monitoreo.

## Métricas

El API expone contadores en memoria desde `server/api/src/lib/metrics.ts`:

- `porteria_http_requests_total` — requests por método/status.
- `porteria_http_request_duration_ms` — duración acumulada.
- `porteria_http_errors_total` — respuestas 5xx.
- `porteria_process_uptime_seconds` — uptime del proceso.

Ejemplo de scrape con Prometheus:

```yaml
scrape_configs:
  - job_name: porteria-api
    metrics_path: /metrics
    static_configs:
      - targets: ['api:3000']
```

Si Prometheus corre fuera de la red de Docker, proxeá `/metrics` por Caddy con una regla interna o usá un exporter.

## Logs

- Fastify emite JSON con `reqId`, método, URL, status y `responseTime`.
- `server/api/src/lib/log-redaction.ts` reemplaza los tokens de pases públicas (`/api/public/passes/:token`) antes de loguear.
- Variables: `LOG_LEVEL=info` en producción; `debug` solo para incidentes acotados.
- Recolección: `docker compose logs -f api`, o un driver de logs (Loki, CloudWatch, Datadog).

## Alertas recomendadas

| Alerta                       | Condición sugerida                                   | Acción                               |
| ---------------------------- | ---------------------------------------------------- | ------------------------------------ |
| API caída                    | `/health` falla 2 minutos                            | Reiniciar `api`, revisar logs.       |
| DB no lista                  | `/ready` devuelve 503 2 minutos                      | Revisar Postgres, disco, conexiones. |
| Tasa de 5xx alta             | `rate(porteria_http_errors_total[5m]) > 0.02`        | Revisar logs y último deploy.        |
| Latencia alta                | p95 de `porteria_http_request_duration_ms` > 1000 ms | Revisar DB, outbox, queries lentas.  |
| Outbox atrasado              | `pending` > 100 o antigüedad > 5 min                 | Revisar worker y `last_error`.       |
| Escaneos rechazados anómalos | aumento de 400 en `/api/access/scan`                 | Revisar secreto QR, TTL y relojes.   |
| Turnos abiertos olvidados    | `guard_shifts` abiertos > 20 h                       | Forzar cierre y avisar al guardia.   |

## Retención

- Logs de contenedor: 14–30 días según el driver.
- Métricas Prometheus: 15 días mínimo; 90 días si hay capacidad.
- Backups de Postgres: 30 días + un backup mensual por 12 meses.
- Auditoría/bitácora: según requisito legal de la comunidad; no borrar desde la API.

## Error tracking (pendiente)

`SENTRY_DSN` existe en la configuración y en `.env.production.example`, pero el SDK de Sentry **todavía no está cableado**. Para v1 recomendamos:

1. Agregar `@sentry/node` al API.
2. Inicializar en `server/api/src/index.ts` cuando `config.observability.sentryDsn` esté definido.
3. Capturar errores 5xx en el error handler y asociar `request.id`.

Mientras tanto, los logs estructurados y `/metrics` cubren el diagnóstico básico.
