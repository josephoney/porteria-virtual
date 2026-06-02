## 1. Root Configuration

- [x] 1.1 Create `pnpm-workspace.yaml` with packages: `apps/*`, `packages/*`, `server/*`
- [x] 1.2 Create root `package.json` with `packageManager: pnpm`, workspace scripts (`dev`, `build`, `lint`, `format`), and devDependencies (typescript, eslint, prettier, concurrently)
- [x] 1.3 Create `tsconfig.base.json` with strict mode, path aliases, and ESNext target
- [x] 1.4 Create `.eslintrc.cjs` with TypeScript, React, and Prettier plugins
- [x] 1.5 Create `.prettierrc` with consistent formatting rules (single quotes, trailing commas, 2-space indent)
- [x] 1.6 Update `.gitignore` for monorepo: `node_modules/`, `dist/`, `.env`, Docker volumes
- [x] 1.7 Create `.env.example` with DB connection strings and ports

## 2. Shared Package

- [x] 2.1 Create `packages/shared/package.json` with name `@porteria/shared`, TypeScript build script, and exports
- [x] 2.2 Create `packages/shared/tsconfig.json` extending root tsconfig.base.json
- [x] 2.3 Create `packages/shared/src/index.ts` as barrel export
- [x] 2.4 Create `packages/shared/src/types/` with domain entity types: `Organization`, `Location`, `AccessPoint`, `User`, `Call`, `Event`
- [x] 2.5 Create `packages/shared/src/dto/` with API DTOs: `LoginRequest`, `LoginResponse`, `PaginatedResponse<T>`, `ApiError`
- [x] 2.6 Create `packages/shared/src/enums/` with `UserRole`, `EventType`, `AccessMethod`, `CallStatus`
- [x] 2.7 Verify shared package builds and types are importable: `pnpm --filter @porteria/shared build`

## 3. App Scaffolds

- [x] 3.1 Create `apps/kiosk/` with Vite + React + TypeScript scaffold (`pnpm create vite kiosk --template react-ts` or manual)
- [x] 3.2 Create `apps/dashboard/` with Vite + React + TypeScript scaffold
- [x] 3.3 Create `apps/resident/` with Vite + React + TypeScript scaffold
- [x] 3.4 Configure each app's `tsconfig.json` to extend root tsconfig.base.json and reference `@porteria/shared`
- [x] 3.5 Add `@porteria/shared` as workspace dependency in each app's `package.json`
- [x] 3.6 Verify cross-package imports work: import a type from `@porteria/shared` in each app's `App.tsx`
- [x] 3.7 Verify `pnpm dev` from root starts all apps concurrently

## 4. Server Scaffolds

- [x] 4.1 Create `server/api/` with Fastify + TypeScript scaffold
- [x] 4.2 Create `server/signaling/` with Fastify + TypeScript scaffold (Socket.io integration placeholder)
- [x] 4.3 Create `server/mqtt-bridge/` with Fastify + TypeScript scaffold
- [x] 4.4 Configure each server's `tsconfig.json` to extend root tsconfig.base.json and reference `@porteria/shared`
- [x] 4.5 Add `@porteria/shared` as workspace dependency in each server's `package.json`
- [x] 4.6 Add `tsx` as devDependency for TypeScript execution in development (`tsx watch src/index.ts`)

## 5. Docker Compose

- [x] 5.1 Create `docker-compose.yml` with PostgreSQL 16 + TimescaleDB, Redis 7, and Mosquitto 2 services
- [x] 5.2 Create `docker/mosquitto.conf` with default MQTT configuration (allow anonymous for dev, listener on 1883)
- [x] 5.3 Create `.env` file (from .env.example) with default dev credentials
- [x] 5.4 Verify `docker compose up -d` starts all services successfully
- [x] 5.5 Verify PostgreSQL accepts connections: `docker compose exec postgres psql -U porteria -d porteria`

## 6. Legacy Code Preservation

- [x] 6.1 Create `legacy/` directory
- [x] 6.2 Move `server.js`, `kiosk.html`, `kiosk2.html`, `operator.html` into `legacy/`
- [x] 6.3 Create `legacy/README.md` explaining these files are reference only
- [x] 6.4 Verify legacy server still runs: `node legacy/server.js` starts on port 3001

## 7. Documentation

- [x] 7.1 Update root `README.md` with monorepo structure, setup instructions, and development workflow
- [x] 7.2 Document environment setup: `pnpm install`, `docker compose up -d`, `pnpm dev`
- [x] 7.3 Verify all commands in README work correctly
