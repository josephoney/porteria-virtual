## Context

El proyecto PorteriaVirtual actualmente es un conjunto de archivos sueltos: `server.js` (servidor de señalización Socket.io), `kiosk.html`, `kiosk2.html`, `operator.html` (interfaces vanilla JS), y `porteria/` con docker-compose heredado. No hay package.json, sistema de builds, TypeScript, ni estructura de proyecto formal.

Para la Fase 2, necesitamos migrar a React + TypeScript con 3 apps (kiosk, dashboard, resident), packages compartidos, y servidores modularizados. Esto requiere una base monorepo.

## Goals / Non-Goals

**Goals:**
- Estructura de carpetas clara y consistente para todo el proyecto
- pnpm workspaces como gestor de monorepo (elegido sobre Turborepo y Nx por simplicidad)
- Scaffolds funcionales: `pnpm dev` ejecuta todas las apps en paralelo, `pnpm build` compila todo
- Tipos TypeScript compartidos vía `packages/shared` importables por cualquier app/server
- Tooling unificado: ESLint, Prettier, tsconfig base que todas las apps extienden
- Docker Compose con servicios de infraestructura para desarrollo local (PostgreSQL, Redis, Mosquitto)
- Código legacy preservado en `legacy/` como referencia funcional

**Non-Goals:**
- No se implementa lógica de negocio en ninguna app (son scaffolds vacíos)
- No se configura CI/CD (fase posterior)
- No se migra el código legacy a React en este change (esos son changes 4 y 5)
- No se configura producción (solo desarrollo local)
- No se configura autenticación ni base de datos (change 2 y 3)

## Decisions

### 1. pnpm workspaces sobre Turborepo y Nx

**Decisión**: Usar pnpm workspaces nativo sin herramientas adicionales de orquestación.

**Alternativas consideradas**:
- **Turborepo**: Ofrece caché de builds y ejecución paralela inteligente. Descartado porque para 3 apps con Vite (build <5s cada una) la ganancia de caché es marginal. Agrega un archivo `turbo.json` y dependencia extra. Se puede adoptar después si los builds crecen.
- **Nx**: Plataforma completa de monorepo. Descartado por overkill. Curva de aprendizaje alta, complejidad innecesaria para este tamaño de proyecto.

**Razonamiento**: pnpm workspaces requiere solo un archivo `pnpm-workspace.yaml` con 3 líneas. Los scripts en raíz (`pnpm -r dev`, `pnpm -r build`) cubren el 100% de los casos de uso actuales.

### 2. Vite como bundler para todas las apps React

**Decisión**: Vite + React + TypeScript con `@vitejs/plugin-react`.

**Alternativas consideradas**:
- **Create React App**: Deprecado, lento en desarrollo, sin soporte oficial actual.
- **Next.js**: Overkill para apps SPA que no necesitan SSR. El kiosk corre en un RPi con Chromium en modo kiosk — no necesita SSR.

**Razonamiento**: Vite es el estándar actual para SPAs React. HMR instantáneo, build rápido con Rollup, configuración mínima.

### 3. Fastify sobre Express para servidores

**Decisión**: Usar Fastify para los servidores (`server/api/`, `server/signaling/`, `server/mqtt-bridge/`).

**Alternativas consideradas**:
- **Express**: El server.js actual lo usa. Pero no tiene tipado nativo, validación de schemas, ni plugins.
- **Fastify**: Más rápido, schema validation nativo (JSON Schema), plugin system, tipado TypeScript de primera clase.

**Razonamiento**: Para la API que manejará auth, validación de requests, y alta concurrencia, Fastify es objetivamente superior. El signaling server puede seguir con Express inicialmente (Socket.io tiene mejor integración) pero el scaffold se crea con Fastify para consistencia.

### 4. Estructura de packages compartidos

**Decisión**: Un solo package `packages/shared` con tipos, DTOs, enums y constantes.

**Alternativas consideradas**:
- **Múltiples packages** (`shared-types`, `shared-ui`, `shared-utils`): Fragmentación innecesaria para el tamaño del proyecto. Si `shared` crece demasiado, se puede splitear después.
- **Turborepo internal packages**: Mismo resultado pero con dependencia extra.

**Razonamiento**: KISS. Un package que exporta tipos es suficiente. Si en el futuro se necesita un design system compartido (`packages/ui`), se agrega como package independiente.

### 5. Docker Compose para desarrollo local

**Decisión**: `docker-compose.yml` en raíz con PostgreSQL 16 + TimescaleDB, Redis 7, Mosquitto 2.

```yaml
services:
  postgres:
    image: timescale/timescaledb:latest-pg16
    ports: [5432:5432]
    environment:
      POSTGRES_DB: porteria
      POSTGRES_USER: porteria
      POSTGRES_PASSWORD: porteria_dev
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports: [6379:6379]

  mosquitto:
    image: eclipse-mosquitto:2
    ports: [1883:1883, 9001:9001]
    volumes:
      - ./docker/mosquitto.conf:/mosquitto/config/mosquitto.conf
```

**Razonamiento**: Sin Docker Compose, cada dev instalaría PostgreSQL, Redis y Mosquitto manualmente. Esto estandariza el entorno.

### 6. TypeScript strict mode

**Decisión**: `strict: true` en tsconfig base.

**Razonamiento**: Mejor detectar errores en compilación que en runtime. Todas las apps y packages heredan esta configuración.

## Risks / Trade-offs

- **[Riesgo] pnpm puede no estar instalado en la máquina del dev** → Mitigación: documentar `npm install -g pnpm` en README y verificar en scripts de setup. Corepack (`packageManager` en root package.json) fuerza la versión correcta automáticamente.
- **[Riesgo] Docker Compose requiere Docker Desktop/Engine** → Mitigación: los servicios de infraestructura solo se necesitan para desarrollo con features que usen DB. Un dev puede trabajar en la UI del kiosk sin Docker.
- **[Riesgo] El código legacy en `legacy/` puede generar confusión** → Mitigación: README en `legacy/` explicando que es referencia temporal y se eliminará cuando las apps React tengan paridad.
- **[Trade-off] Fastify para signaling server** → Socket.io tiene mejor integración con Express (usan el mismo http server). Si la integración Fastify + Socket.io es problemática, se puede mantener Express solo para signaling. Este cambio solo crea el scaffold — la decisión final se toma en el change del signaling server.
