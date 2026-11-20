# Backlog

Ideas y deudas anotadas a propósito, sin implementar todavía. No son un
compromiso de fecha: es el registro de lo que sabemos que falta para no
redescubrirlo cada vez.

## App móvil

### Selector de contexto en la pantalla del residente

Al ocultar el header nativo de `app/home.tsx` para dejar la marca compacta, se
perdió la única forma de volver al selector de contexto.

- **Quién lo nota**: un residente con más de una membresía (`multi@porteria.local`
  es el caso de prueba) ya no puede cambiar de contexto sin cerrar sesión.
- **Propuesta**: un control discreto en la barra de la marca — ícono o texto
  «Cambiar contexto» — que navegue a `/context`. Debe verse sólo cuando el
  usuario tiene más de una membresía activa.
- **Por qué no se hizo ya**: el cambio de diseño era sólo JavaScript y no se
  quiso sumar navegación nueva en la misma pasada.

## Despliegue

### Volumen para los archivos subidos

Los logos de organización y comunidad se guardan en el disco del contenedor del
API. En staging **se pierden en cada rebuild**.

- Opciones: volumen de Docker montado en la carpeta de uploads, o mover a S3/R2.
- Sin resolver, un logo que desaparece después de un deploy parece un bug.

### Producción gestionada: assets en S3 y base administrada

Decisión diferida a propósito. Hoy el despliegue es **un solo VPS** con Postgres
en volumen Docker y respaldos fuera del servidor (`deploy/backup.sh`). Alcanza
para el volumen actual: ~6–10 MB de datos nuevos por día, ~4 GB al año.

Se migra cuando aparezca **cualquiera** de estas señales:

- **Más de una instancia de API.** Con volumen local, un logo subido en la
  instancia A da 404 en la B. Ahí S3 deja de ser opcional.
- **Exigencia de auditoría o continuidad.** PITR, RTO/RPO por contrato o
  retención formal de la bitácora.
- **Assets que crecen.** Foto de visitante o de documento: ~300 KB por pase
  contra ~1 KB de dato relacional. Eso no va a la base.
- **Mudanza de proveedor o de región** que queramos hacer sin copiar bytes a mano.

Camino previsto:

1. `ASSET_STORAGE=s3` con las variables `S3_*`. Ya está implementado en
   `server/api/src/services/asset-storage.service.ts`; no requiere código nuevo.
2. Postgres administrado con PITR. **Bloqueante conocido:**
   `packages/database/src/connection.ts` crea el `Pool` sin opción `ssl`, y los
   managed exigen TLS. Agregar `ssl` antes de apuntar `POSTGRES_HOST` al cluster.
3. Conservar el dump lógico semanal además del PITR: el PITR no protege de una
   migración que corrompe datos de forma consistente.

Por qué no ahora: suma proveedor, credenciales y ~USD 35–70/mes sin resolver
ningún problema que tengamos hoy. El respaldo fuera del servidor cubre el riesgo
inmediato.

### Retención de bitácora y auditoría

`bitacora_entries` y `events` crecen para siempre: no hay purga. Con 1000 pases
diarios son ~4 GB al año, y la bitácora suele tener exigencia de retención legal
o contractual.

- Falta definir la política (por ejemplo 1–2 años) y un job de purga por
  antigüedad, con el mismo patrón que `outbox.purgeDone`.
- Sin política, la base crece sin techo y el backup se vuelve más lento cada año.

### Signaling para videollamadas

El compose de staging no incluye el servicio `signaling`, y Caddy no tiene ruta
para `/socket.io/`. El navegador falla el WebSocket con un 200 en lugar de 101.

- Falta un Dockerfile para `server/signaling` y la ruta en el Caddyfile.
- Mientras tanto, la mensajería y las llamadas no funcionan en staging.

### EAS Update

Permitiría publicar cambios de JavaScript sin recompilar el APK.

- Requiere configurar `expo-updates` y una rama de publicación.
- Hoy cada ajuste visual obliga a un build nuevo y a redistribuir el APK.

## Producto

### iOS

El build de iOS funciona en EAS, pero instalar en un iPhone requiere Apple
Developer Program (99 USD/año) y registrar cada dispositivo.

- Alternativa gratuita para demos: Expo Go con `--tunnel`.

## Deuda técnica conocida

- `role="button"` en `<tr>` de las tablas expandibles: se corrigió, pero quedan
  componentes nuevos que deben seguir la misma regla (mantener el rol `row`).
- Tests del camino por documento en la app: cubiertos a nivel API, sin
  automatización de la interfaz porque vive en Expo.
