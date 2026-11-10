# Zima QR Access

App móvil de PorteriaVirtual para residentes y guardias. El modo residente permite crear
pases de visita, compartir el link público y mostrar el QR dinámico de 24 segundos. El
modo guardia permite iniciar turno, cambiar de punto de acceso, escanear el QR, confirmar
o rechazar el ingreso y consultar el historial de turnos.

## Requisitos

- Node 20+
- pnpm
- Expo Go o un development build para probar en un dispositivo
- API de PorteriaVirtual corriendo con `DYNAMIC_QR_ENABLED=true`

## Configuración

```bash
cp .env.example .env
```

Variables:

- `EXPO_PUBLIC_API_URL`: URL de la API. Para un teléfono físico usá la IP LAN de la
  máquina, por ejemplo `http://192.168.1.50:3000`. Para el emulador Android,
  `http://10.0.2.2:3000`.
- `EXPO_PUBLIC_ENV`: `development` o `production`.

## Desarrollo

```bash
pnpm install
pnpm --filter @porteria/zima-qr-access start
```

Atajos:

```bash
pnpm --filter @porteria/zima-qr-access android
pnpm --filter @porteria/zima-qr-access ios
```

## Roles

- `owner`, `tenant`, `resident`: modo residente.
- `guard`: modo guardia con turno y escaneo.
- `operator` y `community_admin`: aviso para usar el dashboard o la central de monitoreo.

Si el usuario tiene más de una membresía activa, la app muestra el selector de contexto.

## Flujo residente

1. Login con email y contraseña.
2. La app toma `locationUnitId` de la membresía activa.
3. Crear pase: visitante, documento, vehículo opcional, tipo (`entry_only` o
   `entry_exit`), vigencia, ventana diaria opcional y PIN opcional.
4. La app abre el detalle con el QR dinámico y el link para compartir.
5. El QR se refresca cada 20 segundos; el link se comparte con `Share`.

## Flujo guardia

1. Login con una cuenta `guard`.
2. La app consulta el turno actual (`GET /api/guard/shifts/current`).
3. Sin turno: elegí un punto de acceso activo y tocá **Iniciar turno**. Si la membresía
   tiene `defaultAccessPointId`, ese acceso aparece preseleccionado.
4. Con turno: la app muestra el acceso actual, la hora de inicio y la duración.
5. **Cambiar acceso** cierra el tramo anterior y abre uno nuevo sin cerrar el turno.
6. Escaneá el QR con la cámara o ingresá el token manualmente.
7. Revisá el visitante, el documento, la patente, la ubicación y el punto de acceso;
   confirmá o rechazá el ingreso.
8. **Cerrar turno** registra la salida y vuelve al selector de acceso.
9. El historial muestra los últimos turnos con acceso, inicio, duración y estado.

El guardia debe estar en turno en el mismo punto de acceso para confirmar o rechazar un
escaneo. Varios guardias pueden cubrir el mismo acceso al mismo tiempo.

## Build interno

El APK interno se genera con EAS o un build local de Expo. Requiere configurar
`android.package` (`com.porteria.zimaqraccess`) y las credenciales de firma. La cámara
del modo guardia requiere un development build, no Expo Go.

## Fuera del MVP

- Push notifications.
- Pases recurrentes.
- Autorizador delegado.
- Escaneo en el dashboard.
- Modo offline.
