## Why

El proyecto actual es un monolito de 4 archivos HTML vanilla + 1 server.js sin estructura de proyecto. Para evolucionar a 3 apps React (kiosk, dashboard, resident), packages compartidos, y múltiples servidores (API, signaling, MQTT bridge), necesitamos una base monorepo sólida antes de implementar cualquier feature. Sin esta fundación, cada feature nueva acumularía deuda estructural.

## What Changes

- Crear estructura `apps/` con scaffolds React + Vite + TypeScript para kiosk, dashboard y resident
- Crear `packages/shared/` con tipos TypeScript, DTOs y constantes compartidas entre apps
- Crear `server/` con scaffolds Fastify + TypeScript para api, signaling y mqtt-bridge
- Configurar pnpm workspaces (`pnpm-workspace.yaml`) como herramienta de monorepo
- Configurar ESLint + Prettier + tsconfig base compartidos
- Agregar scripts de conveniencia en raíz (`pnpm dev`, `pnpm build`, `pnpm lint`)
- Docker Compose para desarrollo local con PostgreSQL + TimescaleDB + Redis + Mosquitto
- El código actual (`server.js`, `kiosk.html`, `operator.html`, `kiosk2.html`) se preserva en `legacy/` como referencia y se eliminará progresivamente cuando las apps React alcancen paridad

## Capabilities

### New Capabilities
- `monorepo-structure`: Estructura de carpetas del monorepo con pnpm workspaces, configuración de tooling (ESLint, Prettier, tsconfig), scripts de desarrollo y build, y Docker Compose para servicios de infraestructura local.
- `shared-types`: Package con tipos TypeScript, DTOs, enums y constantes compartidos entre todas las apps y servidores del monorepo.

### Modified Capabilities
<!-- Ninguna — este es el primer cambio, no hay specs existentes que modificar -->

## Impact

- **Estructura del proyecto**: cambio completo de archivos sueltos a monorepo organizado
- **Tooling**: se introduce pnpm como package manager, Vite como bundler, TypeScript en todo el proyecto
- **Dependencias nuevas**: pnpm, Vite, React, TypeScript, ESLint, Prettier, Docker Compose
- **Código existente**: se mueve a `legacy/` como referencia, sin modificar su funcionalidad
- **No hay breaking changes**: el código legacy sigue funcionando igual, las apps nuevas son scaffolds vacíos
