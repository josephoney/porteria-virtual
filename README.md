# Porteria Virtual — Central de Porteria Remota

Sistema de porteria virtual con videollamada WebRTC, control de puerta remoto, bitacora digital, y monitoreo de guardias. 100% open source.

## Arquitectura

```
[Kiosk RPi]  ←WebRTC→  [Operador Web]
      ↕                       ↕
      └──── Socket.io ────────┘
                ↕
        [Signaling Server]
                ↕
           [API Server]
                ↕
    ┌───────────┼───────────┐
    ▼           ▼           ▼
[PostgreSQL] [Redis]    [Mosquitto]
                            
```

## Estructura del Monorepo

```
porteria-virtual/
├── apps/
│   ├── kiosk/            # React — terminal tactil (Raspberry Pi)
│   ├── dashboard/        # React — panel operador + admin + guardia
│   └── resident/         # React PWA — app movil residente
├── packages/
│   └── shared/           # Tipos TypeScript, DTOs, enums compartidos
├── server/
│   ├── api/              # Fastify — REST API, auth, reportes
│   ├── signaling/        # Fastify + Socket.io — señalizacion WebRTC
│   └── mqtt-bridge/      # Fastify — puente MQTT ↔ API
├── legacy/               # Codigo original Fase 1 (referencia)
├── docker-compose.yml    # PostgreSQL + Redis + Mosquitto
└── pnpm-workspace.yaml
```

## Stack Tecnologico

| Componente         | Tecnologia                    |
|--------------------|-------------------------------|
| Frontend apps      | React 18 + Vite + TypeScript  |
| Monorepo           | pnpm workspaces               |
| API / Servers      | Fastify + TypeScript          |
| ORM                | Drizzle (pendiente)           |
| Videollamada       | WebRTC (nativo browser)       |
| Senalizacion       | Socket.io                     |
| NAT Traversal      | Coturn (STUN/TURN)            |
| Base de datos      | PostgreSQL 16 + TimescaleDB   |
| Cache / Sesiones   | Redis 7                       |
| IoT / GPIO         | MQTT (Mosquitto 2)            |
| Contenedores       | Docker Compose                |

## Setup Rapido (Desarrollo Local)

### Prerequisitos

- Node.js 20+
- pnpm 9+ (`npm install -g pnpm`)
- Docker Desktop (o Docker Engine + Docker Compose)

### 1. Instalar dependencias

```bash
pnpm install
```

### 2. Iniciar servicios de infraestructura

```bash
docker compose up -d
```

Esto levanta PostgreSQL + TimescaleDB (puerto 5432), Redis (6379) y Mosquitto MQTT (1883, 9001 ws).

Verificar que esten corriendo:

```bash
docker compose ps
# Los 3 servicios deben mostrar status "healthy"
```

### 3. Iniciar apps en desarrollo

```bash
pnpm dev
```

Apps disponibles:
- Kiosk: http://localhost:5173
- Dashboard: http://localhost:5174
- Resident: http://localhost:5175

### 4. Iniciar servidores (individual)

```bash
pnpm --filter @porteria/signaling dev   # Signaling + Socket.io :3001
pnpm --filter @porteria/api dev         # REST API :3000
pnpm --filter @porteria/mqtt-bridge dev # MQTT Bridge :3002
```

### 5. Verificar

```bash
curl http://localhost:3001/health  # Signaling
curl http://localhost:3000/health  # API
```

## Comandos

| Comando              | Descripcion                              |
|----------------------|------------------------------------------|
| `pnpm dev`           | Inicia todas las apps en dev             |
| `pnpm build`         | Build de produccion para todas las apps  |
| `pnpm lint`          | Ejecuta ESLint en todo el workspace      |
| `pnpm format`        | Formatea con Prettier                    |
| `pnpm --filter <pkg> dev` | Inicia solo un package especifico  |

## Apps

### Kiosk (`apps/kiosk`)

Terminal tactil para Raspberry Pi 4 con display 7". Corre en Chromium modo kiosk. Interfaz oscura optimizada para touch.

### Dashboard (`apps/dashboard`)

Panel de operador, administrador y guardia. Segun el rol muestra diferentes secciones: atencion de llamadas, reportes, gestion de usuarios, rondas de guardia.

### Resident (`apps/resident`)

PWA mobile-first para residentes. Permite abrir puertas, generar QR de acceso temporal, ver historial.

## Variables de Entorno

Copiar `.env.example` a `.env` y ajustar. Las credenciales por defecto funcionan con Docker Compose local.

```
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=porteria
POSTGRES_USER=porteria
POSTGRES_PASSWORD=porteria_dev
REDIS_HOST=localhost
REDIS_PORT=6379
MQTT_HOST=localhost
MQTT_PORT=1883
```

## Fases de Desarrollo

- [x] **Fase 1**: Videollamada WebRTC kiosk ↔ operador + control de puerta
- [ ] **Fase 2**: Monorepo React + Base de datos + Auth + Migracion
- [ ] **Fase 3**: Bitacora digital + Reportes (diario/semanal/mensual)
- [ ] **Fase 4**: MQTT + GPIO + Guard Rondas digitales
- [ ] **Fase 5**: App Residente + QR Temporales + Face Recognition
- [ ] **Fase 6**: Multi-sede Dashboard + Call Routing + Modo Offline

## Legacy

El codigo original de la Fase 1 esta en `legacy/`. Se preserva como referencia funcional y se eliminara cuando las apps React alcancen paridad de features.

## Licencia

MIT
