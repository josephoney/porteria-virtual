## Why

El sistema actual no tiene persistencia — `server.js` guarda kiosks, operadores y llamadas en un `Map` en memoria. Si el proceso muere, se pierde todo. Sin base de datos no hay forma de implementar autenticación, bitácora de eventos, reportes, multi-tenancy, ni ninguno de los features planeados para las fases siguientes. Este cambio construye la capa de datos fundacional sobre la que se edifican todos los demás cambios.

## What Changes

- Instalar Drizzle ORM (`drizzle-orm`, `drizzle-kit`) en el monorepo
- Crear `packages/database/` con el esquema completo del modelo de dominio (11 tablas)
- Configurar TimescaleDB como hypertable para la tabla `events` (particionado automático por tiempo)
- Crear migración inicial con drizzle-kit
- Crear script de seed data con datos demo (organización, sede, access point, usuarios de prueba)
- Agregar utilidad de conexión a PostgreSQL usando variables de entorno
- Configurar drizzle-kit para gestionar migraciones desde `packages/database/`

## Capabilities

### New Capabilities
- `drizzle-setup`: Instalación y configuración de Drizzle ORM en el monorepo — dependencias, drizzle.config.ts, utilidad de conexión a PostgreSQL, scripts de migración.
- `database-schema`: Definición de las 11 tablas del modelo de dominio con tipos TypeScript, relaciones, índices, y configuración de TimescaleDB hypertable para `events`.
- `seed-data`: Script de datos de prueba que crea una organización demo, sede, access point, kiosk, usuarios con distintos roles, y visitantes de ejemplo.

### Modified Capabilities
<!-- Ninguno — este es el primer cambio de datos, no hay specs existentes que modificar -->

## Impact

- **Nuevo package**: `packages/database/` con drizzle-orm + drizzle-kit como dependencias
- **Dependencias nuevas**: drizzle-orm, drizzle-kit, pg (driver PostgreSQL), dotenv
- **Infraestructura**: Requiere PostgreSQL + TimescaleDB corriendo (ya configurado en docker-compose del change anterior)
- **Variables de entorno**: Usa `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` de `.env`
- **No hay breaking changes**: El código legacy no se toca, las apps React tampoco
