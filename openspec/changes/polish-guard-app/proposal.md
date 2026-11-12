## Why

La app `zima-qr-access` ya funciona en dispositivo, pero el flujo del guardia tiene
fricciones que aparecieron en la primera prueba real:

- la pantalla de login muestra una letra "Z" en un cuadrado en lugar de la marca;
- el turno se inicia tocando una tarjeta entera, sin una acción explícita de arranque;
- la lista de turnos siempre está desplegada y empuja el escáner hacia abajo;
- la cámara se enciende sola al entrar al turno y queda abierta aunque el guardia no
  esté escaneando;
- una vez confirmado un ingreso, la app no muestra qué pasó durante el turno: el guardia
  tiene que ir al dashboard para revisarlo.

Este change resuelve esos cinco puntos sin tocar el modelo de datos ni el backend.

## What Changes

- **Marca**: se reemplaza el cuadrado con la letra "Z" por el logo real `LogoZima_W.svg`
  en las pantallas de autenticación (login y selección de contexto).
- **Inicio de turno**: los puntos de acceso pasan a ser una selección y el turno arranca
  con un botón verde explícito **Iniciar turno**.
- **Mis turnos**: el encabezado de la tarjeta se puede tocar y la lista se despliega o se
  contrae.
- **Cámara bajo demanda**: el escáner ya no abre la cámara al entrar al turno. Hay un
  botón **Escanear QR** que la abre y un botón **Cancelar** que la cierra y la libera.
  El ingreso manual de token sigue disponible sin cámara.
- **Actividad del turno**: con el turno abierto, la app lista los ingresos, egresos y
  rechazos registrados en ese turno. Al cerrar el turno la sección desaparece. El
  registro completo sigue en la base y se consulta desde el dashboard.

## Capabilities

### New Capabilities

- Ninguna. Todo se expresa sobre las capacidades móviles existentes.

### Modified Capabilities

- `zima-mobile-auth`: la pantalla de acceso muestra el logo de la marca en lugar de un
  placeholder.
- `zima-guard-scan`: inicio de turno con acción explícita, cámara bajo demanda, listas
  colapsables y actividad del turno abierto.

## Impact

- **App**: `apps/zima-qr-access` (`app/index.tsx`, `app/context.tsx`, `app/scan.tsx`,
  `src/components/ui.tsx`, `src/theme.ts`, nuevo `src/components/zima-logo.tsx`, nuevos
  `src/api/bitacora.ts` y `src/lib/bitacora.ts`).
- **Backend**: sin cambios. La actividad del turno usa `GET /api/bitacora?shiftId=`, que ya
  admite el rol `guard`.
- **Base de datos**: sin cambios.
- **Shared**: sin cambios de tipos. Se reutilizan `BitacoraEntryDto` y
  `BitacoraListResponse`.
- **Dependencias**: ninguna nueva. `react-native-svg` ya está instalado y el logo se
  embebe como componente (no hace falta `react-native-svg-transformer` ni tocar Metro).

## Fuera de alcance

- Notificaciones push, pases recurrentes y subusuarios (siguen en Phase 2 de
  `add-zima-qr-access-app`).
- Distribución del APK y configuración de EAS.
- Cambios de autorización en el backend: la bitácora sigue siendo legible a nivel
  comunidad para el guardia; el filtro por turno es alcance de producto, no un límite de
  seguridad.
- Rediseño del modo residente más allá del logo.
