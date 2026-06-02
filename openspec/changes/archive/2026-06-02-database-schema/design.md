## Context

El monorepo ya tiene estructura base (`apps/`, `packages/`, `server/`), Docker Compose con PostgreSQL 16 + TimescaleDB corriendo, y `packages/shared/` con tipos y enums del dominio. Falta la capa de persistencia: esquema de tablas, migraciones, y conexión a la base de datos.

Este cambio define el schema en Drizzle ORM y lo empaqueta en `packages/database/` para que todos los servidores (`api`, `signaling`, `mqtt-bridge`) compartan la misma definición de tablas y tipos inferidos.

## Goals / Non-Goals

**Goals:**
- Definir las 11 tablas del modelo de dominio con tipos TypeScript inferidos automáticamente por Drizzle
- Configurar TimescaleDB hypertable en `events` para queries analíticas eficientes por ventana de tiempo
- Generar migración inicial que cree todas las tablas en PostgreSQL
- Proveer seed data para desarrollo y testing
- Centralizar la lógica de conexión a DB en un solo package

**Non-Goals:**
- No se implementan repositorios ni queries de negocio (eso va en cada server)
- No se configura replicación, backups ni producción (fase posterior)
- No se implementa autenticación (cambio 3)
- No se crean endpoints de API (cambio 3)
- No se migran datos legacy (no hay datos que migrar)

## Decisions

### 1. Drizzle ORM sobre Knex y Prisma

**Decisión**: Drizzle ORM para definición de schema, migraciones y tipos.

**Alternativas**:
- **Knex**: Query builder sin type safety. Habría que definir tipos manualmente y mantenerlos sincronizados con las migraciones. Descartado porque Drizzle infiere tipos automáticamente del schema.
- **Prisma**: ORM pesado con engine binario. Sobrecarga innecesaria para queries analíticas de TimescaleDB. Descartado en la decisión de arquitectura general.

**Razonamiento**: Drizzle es el ORM elegido en la arquitectura. Genera tipos TypeScript del schema sin código generado, queries SQL-like, y soporta PostgreSQL + TimescaleDB sin fricción. El método `sql` permite queries raw cuando sea necesario (window functions, time buckets de TimescaleDB).

### 2. `packages/database/` como package separado

**Decisión**: El schema vive en `packages/database/`, no en `server/api/`.

**Razonamiento**: Los 3 servidores (`api`, `signaling`, `mqtt-bridge`) necesitan acceso a la DB. Centralizar el schema en un package evita duplicación y garantiza consistencia. Cambios al schema se hacen en un solo lugar.

### 3. Estructura de archivos del schema

**Decisión**: Un archivo por tabla en `packages/database/src/schema/`, barrel export en `index.ts`.

```
packages/database/
├── src/
│   ├── schema/
│   │   ├── organizations.ts
│   │   ├── locations.ts
│   │   ├── access-points.ts
│   │   ├── kiosks.ts
│   │   ├── users.ts
│   │   ├── visitors.ts
│   │   ├── calls.ts
│   │   ├── events.ts (hypertable config)
│   │   ├── guard-rounds.ts
│   │   ├── guard-checkpoints.ts
│   │   └── access-codes.ts
│   ├── relations.ts       (Drizzle relations)
│   ├── connection.ts      (pg Pool + drizzle wrapper)
│   └── index.ts           (barrel export)
├── drizzle.config.ts      (drizzle-kit config)
└── package.json
```

**Razonamiento**: Separación clara, cada archivo es una tabla. Fácil de navegar y mantener.

### 4. UUID como primary key

**Decisión**: Usar `uuid` generado en PostgreSQL (`gen_random_uuid()`) para todas las primary keys.

**Alternativas**: 
- **Serial / autoincrement**: Vulnerable a enumeration attacks. No portable entre entornos.
- **ULID**: Más legible que UUID pero requiere extensión o librería extra.

**Razonamiento**: UUID v4 es el estándar para sistemas distribuidos. PostgreSQL lo genera nativamente con `gen_random_uuid()` (extensión `pgcrypto` incluida por defecto). No hay riesgo de colisión entre entornos.

### 5. TimescaleDB hypertable para events

**Decisión**: La tabla `events` se convierte en hypertable de TimescaleDB con `chunk_time_interval` de 7 días.

```sql
SELECT create_hypertable('events', 'created_at', chunk_time_interval => INTERVAL '7 days');
```

**Razonamiento**: `events` es la tabla que más va a crecer (cada apertura de puerta, llamada, login, ronda genera un registro). TimescaleDB particiona automáticamente por tiempo, haciendo que queries como "eventos de los últimos 30 días" sean O(1) en lugar de secuenciales. El chunk de 7 días balancea tamaño de partición vs cantidad de particiones.

### 6. Índices para queries frecuentes

| Tabla | Índice | Motivo |
|-------|--------|--------|
| `users` | `email` UNIQUE | Login lookup |
| `events` | `(organization_id, created_at DESC)` | Reportes multi-tenant |
| `events` | `(organization_id, event_type, created_at DESC)` | Filtro por tipo de evento |
| `calls` | `(organization_id, status)` | Calls activas por tenant |
| `kiosks` | `(access_point_id)` UNIQUE | Un kiosk por access point |
| `access_codes` | `(code)` UNIQUE | Validación de QR |
| `refresh_tokens` | `(token_hash)` UNIQUE | Rotación de tokens |

*Nota: `refresh_tokens` se agrega acá porque es parte del schema. Su uso real viene en el change 3 (auth).*

### 7. Relaciones con foreign keys

**Decisión**: Todas las relaciones usan foreign keys con `ON DELETE CASCADE` donde tiene sentido.

**Razonamiento**: Integridad referencial a nivel de base de datos, no solo en aplicación. Si se elimina una organización, sus locations, access points, users y eventos se eliminan en cascada.

### 8. Tabla `refresh_tokens`

**Decisión**: Incluir `refresh_tokens` en este schema aunque su uso principal sea en el change de auth.

**Razonamiento**: Es más simple crear todas las tablas juntas en una migración que agregar tablas incrementalmente. Evita migraciones parciales. La tabla queda lista para cuando auth la necesite.

## Risks / Trade-offs

- **[Riesgo] Migración irreversible en desarrollo** → Mitigación: `drizzle-kit drop` permite resetear. En producción se usarán migraciones incrementales.
- **[Riesgo] TimescaleDB requiere licencia Community** → Es gratuita para uso no-cloud. No aplica restricción para self-hosted.
- **[Trade-off] 12 tablas en vez de 11** → Se incluye `refresh_tokens` proactivamente para el change 3. Agrega una tabla extra pero evita una migración futura.
- **[Trade-off] UUID vs Serial** → UUID ocupa 16 bytes vs 4 de integer. Para la escala esperada (miles de registros, no millones), el overhead es insignificante.
