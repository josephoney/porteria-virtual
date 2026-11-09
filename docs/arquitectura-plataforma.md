# Arquitectura de la Plataforma de Gestión de Comunidades

Documento de referencia con los diagramas de arquitectura objetivo, el modelo de dominio
y el roadmap por fases. Deriva del análisis del monorepo actual y del relevamiento de
la plataforma Munily.

## Decisiones de arquitectura

- **Multi-tenant por organización.** `organization` es el tenant. Cada organización
  (administradora, empresa de seguridad o comunidad independiente) gestiona una o más
  `communities`. Los `users` son identidades globales y se vinculan a organizaciones,
  comunidades y unidades mediante `memberships`.
- **Monolito modular.** La API es un monolito modular con contextos delimitados
  (`server/api/src/modules/*`). El realtime (llamadas + chat + alertas) y el device
  bridge se mantienen como servicios separados por su naturaleza de I/O.
- **Motor de control de acceso como núcleo.** Toda credencial (QR, PIN, RFID, rostro)
  pasa por el mismo motor de decisión y siempre deja auditoría en `access_logs` +
  evento.
- **Biometría adapter-first.** La verificación se resuelve con un adaptador
  intercambiable: por defecto en el dispositivo (edge, sin costo por API ni envío de
  rostros a la nube) y con opción de proveedor cloud. Nunca se almacenan imágenes
  crudas; solo plantilla cifrada o referencia del proveedor, con consentimiento
  explícito y borrado auditable.
- **QR firmado y rotativo.** Los pases de acceso se emiten como tokens firmados de
  vida corta, verificables offline en el dispositivo. No se usan códigos estáticos.
- **Pasarela de pagos en Fase 3.** La cartera se modela desde la Fase 1/2 con una
  interfaz de proveedor de pagos (`payment_provider`), pero la integración real con
  pasarela se implementa en Fase 3. Esto permite cobrar manualmente primero y enchufar
  la pasarela sin cambiar el dominio.
- **Eventos confiables.** Se reemplaza el envío fire-and-forget por un patrón outbox
  transaccional consumido por un worker.

## Mapa de fases

| Fase | Alcance | Cambios OpenSpec principales |
|------|---------|------------------------------|
| **Fase 1 — Núcleo de acceso** | Fundación de dominio, eventos confiables, notificaciones, motor de acceso, QR, biometría, abstracción de dispositivos | `establish-domain-foundation`, `add-reliable-event-outbox`, `add-notification-service`, `add-access-control-engine`, `add-qr-access-passes`, `add-biometric-access`, `add-device-abstraction` |
| **Fase 2 — MVP comunidad** | Citofonía virtual, app residente, visitas, paquetería, operación de seguridad, pánico, comunicaciones, reservas, tickets, documentos | `add-virtual-intercom-routing`, `add-resident-app`, `add-visitor-management`, `add-package-management`, `add-guard-operations`, `add-panic-alerts`, `add-communications`, `add-reservations`, `add-tickets-pqrs`, `add-documents` |
| **Fase 3 — Finanzas y escala** | Cartera/alícuotas, pasarela de pagos, informes financieros, analítica, IA, offline/API pública | `add-billing`, `add-payment-gateway`, `add-financial-reports`, `add-analytics-dashboard`, `add-ai-assistant`, `add-offline-mode`, `add-public-api-webhooks`, `add-observability-and-retention` |

---

## 1. Arquitectura actual

Núcleo de portería remota: kiosco RPi ↔ operador por WebRTC, apertura de puerta por
relé/MQTT/GPIO, bitácora sobre TimescaleDB y reportes. El modelo sigue centrado en
kioscos y no en comunidades/unidades.

```mermaid
flowchart LR
  subgraph Clientes
    K["Kiosk React (RPi)"]
    D["Dashboard React"]
    R["Resident (stub)"]
  end
  K <-->|WebRTC / Socket.io| SIG["Signaling :3001"]
  D <-->|WebRTC / Socket.io| SIG
  D -->|REST JWT| API["API Fastify :3000"]
  SIG -->|HTTP interno fire-and-forget| API
  API --> PG[("PostgreSQL + TimescaleDB")]
  API -->|HTTP| MB["MQTT Bridge :3002"]
  MB <--> MQ[("Mosquitto")]
  MQ <--> GPIO["GPIO / Relés RPi"]
  API <--> RD[("Redis")]
  K --> EDGE["nginx + coturn"]
  D --> EDGE
```

## 2. Arquitectura objetivo (contenedores)

```mermaid
flowchart TB
  subgraph Clientes
    RA["Resident PWA"]
    AD["Admin Dashboard"]
    GA["Guard App / Dashboard"]
    KI["Kiosk RPi"]
    HW["Lectores facial / QR / RFID · torniquete · barrera · citófono"]
  end
  subgraph Borde
    GW["nginx + TURN"]
  end
  subgraph Backend
    RT["Realtime: llamadas + chat + alertas"]
    APIMO["API modular monolith"]
    DB2["Device Bridge + Outbox Worker"]
    NW["Notification Worker"]
    AIW["AI Worker (opcional)"]
  end
  subgraph Datos
    PG[("PostgreSQL + TimescaleDB")]
    RD[("Redis")]
    MQ[("Mosquitto MQTT")]
    OBJ[("Object Storage: fotos, docs")]
  end
  RA --> GW --> RT
  RA --> GW --> APIMO
  AD --> GW --> APIMO
  GA --> GW --> APIMO
  KI --> GW --> RT
  KI --> GW --> APIMO
  HW <--> DB2
  APIMO <--> PG
  APIMO <--> RD
  APIMO --> OBJ
  DB2 <--> MQ
  DB2 <--> PG
  RT <--> RD
  NW <--> PG
  AIW <--> APIMO
```

## 3. Mapa de bounded contexts

```mermaid
flowchart TB
  subgraph Plataforma["Plataforma de Gestión de Comunidades"]
    IAM["Identidad y Multi-tenencia"]
    PRO["Propiedad y Unidades"]
    ACC["Control de Acceso"]
    VIS["Visitas y Paquetería"]
    ITC["Citofonía y Videollamadas"]
    SEC["Operación de Seguridad"]
    COM["Comunicación"]
    SRV["Servicios Comunitarios"]
    FIN["Finanzas"]
    ANA["Analítica y Reportería"]
    AI["Asistente IA (opcional)"]
  end
  DEV["Integración de Dispositivos / IoT"]
  NOT["Notificaciones Push"]
  ACC --> DEV
  ITC --> NOT
  SEC --> NOT
  COM --> NOT
  PRO --> ACC
  PRO --> VIS
  PRO --> SRV
  PRO --> FIN
  VIS --> ACC
  ACC --> ANA
  VIS --> ANA
  SEC --> ANA
  FIN --> ANA
  SRV --> AI
  COM --> AI
```

## 4. Flujo de control de acceso

Aplica a cualquier credencial: rostro (biometría), QR, PIN o RFID. El motor evalúa
sujeto + punto de acceso + vigencia + horario + reglas y siempre audita la decisión.

```mermaid
sequenceDiagram
  autonumber
  actor P as Persona
  participant D as Dispositivo de acceso
  participant E as Motor de Acceso (API)
  participant DB as PostgreSQL
  participant A as Actuador (relé/barrera/torniquete)
  participant N as Notificaciones
  participant EV as Bitácora / Eventos
  P->>D: Presenta credencial (rostro, QR, PIN, RFID)
  D->>E: verify(deviceId, credential, contexto)
  E->>DB: Cargar dispositivo, credencial, reglas, horarios
  E->>E: Evaluar sujeto + punto + vigencia + uso
  alt Permitido
    E->>A: Comando open / turn
    E->>EV: access.granted
    E-->>D: allow
  else Denegado
    E->>EV: access.denied (motivo)
    E-->>D: deny
  end
  opt Visita o alerta
    E->>N: push a residente / guardia
  end
```

## 5. Modelo de datos objetivo (núcleo)

```mermaid
erDiagram
  ORGANIZATION ||--o{ COMMUNITY : gestiona
  COMMUNITY ||--o{ BUILDING : contiene
  BUILDING ||--o{ UNIT : contiene
  COMMUNITY ||--o{ USER_MEMBERSHIP : tiene
  USER ||--o{ USER_MEMBERSHIP : participa
  UNIT ||--o{ USER_MEMBERSHIP : ocupa
  COMMUNITY ||--o{ ACCESS_POINT : define
  ACCESS_POINT ||--o{ DEVICE : opera
  DEVICE ||--o{ DEVICE_COMMAND : recibe
  USER ||--o{ CREDENTIAL : posee
  VISITOR ||--o{ CREDENTIAL : usa
  CREDENTIAL ||--o{ ACCESS_LOG : genera
  ACCESS_POINT ||--o{ ACCESS_LOG : registra
  USER ||--o{ VISITOR_PASS : autoriza
  VISITOR_PASS ||--o{ VISITOR : identifica
  UNIT ||--o{ VISITOR_PASS : recibe
  COMMUNITY ||--o{ PACKAGE : recibe
  UNIT ||--o{ PACKAGE : destinatario
  COMMUNITY ||--o{ INCIDENT : reporta
  COMMUNITY ||--o{ PANIC_ALERT : emite
  COMMUNITY ||--o{ ANNOUNCEMENT : publica
  COMMUNITY ||--o{ RESERVATION : agenda
  COMMUNITY ||--o{ TICKET : gestiona
  UNIT ||--o{ CHARGE : factura
  CHARGE ||--o{ PAYMENT : paga
```

> El diagrama muestra el núcleo. Quedan fuera por legibilidad: `biometric_templates`,
> `access_rules`, `shifts`, `rounds`/`checkpoints`, `messages`, `documents`,
> `fee_concepts`, `vehicles`, `pets`, `notification_receipts`,
> `payment_provider`/`payment_method`.

## 6. Roadmap OpenSpec (dependencias)

```mermaid
flowchart LR
  F["1. domain-foundation"] --> OB["2. event-outbox"]
  F --> NT["3. notification-service"]
  F --> AC["4. access-control-engine"]
  AC --> QR["5. qr-access-passes"]
  AC --> BIO["6. biometric-access"]
  AC --> DEV["7. device-abstraction"]
  F --> ITC["8. virtual-intercom"]
  ITC --> RES["9. resident-app"]
  RES --> VIS["10. visitor-management"]
  VIS --> PKG["11. package-management"]
  RES --> PAN["12. panic-alerts"]
  F --> SEC["13. guard-operations"]
  RES --> COM["14. communications"]
  RES --> RSV["15. reservations"]
  RES --> TKT["16. tickets-pqrs"]
  F --> BILL["17. billing"]
  BILL --> PAY["18. payment-gateway (Fase 3)"]
  AC --> ANA["19. analytics"]
  BILL --> ANA
  TKT --> AI["20. ai-assistant"]
  ANA --> HARD["21. hardening: offline/api/observability"]
```

## 7. Trazabilidad de requerimientos

| Requerimiento | Cambio OpenSpec |
|---------------|-----------------|
| Control de acceso biométrico | `add-biometric-access` + `add-device-abstraction` |
| Generación de códigos QR | `add-qr-access-passes` |
| Botón de pánico en app | `add-panic-alerts` + `add-notification-service` |
| Citofonía | `add-virtual-intercom-routing` + `add-resident-app` |
| Gestión de visitas/paquetería | `add-visitor-management` / `add-package-management` |
| Bitácora/rondas/novedades | `add-guard-operations` |
| Comunicados/chat | `add-communications` |
| Reservas / PQRS | `add-reservations` / `add-tickets-pqrs` |
| Cartera/alícuotas | `add-billing` |
| Pasarela de pagos | `add-payment-gateway` (Fase 3) |
| Multi-comunidad / multi-tenant | `establish-domain-foundation` |
