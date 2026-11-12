# Tasks: Pulir la app del guardia

## 1. Marca en las pantallas de autenticación

- [ ] 1.1 Crear `src/components/zima-logo.tsx` con `react-native-svg`: `Svg` con `viewBox="0 0 7000 2500"`, las 16 formas del archivo `images/LogoZima_W.svg`, `fill="#FFFFFF"` y `stroke="#FEFEFE"`, ancho calculado por ratio a partir de la prop `height` (56 por defecto), `accessibilityRole="image"` y `accessibilityLabel="Zima Seguridad"`.
- [ ] 1.2 Reemplazar en `app/index.tsx` el cuadrado con la letra "Z" y su estilo `logo`/`logoText` por `<ZimaLogo />`, sin tocar el título «Zima QR Access» ni el subtítulo.
- [ ] 1.3 Usar el mismo `ZimaLogo` en el encabezado de `app/context.tsx`, manteniendo la lógica de selección de contexto intacta.
- [ ] 1.4 Eliminar los estilos que quedan sin uso después del reemplazo y verificar que no quede ninguna referencia a `logoText`.

## 2. Inicio de turno explícito

- [ ] 2.1 Agregar la variante `success` a `Button` en `src/components/ui.tsx`, con `backgroundColor: colors.success` y label blanco, conservando el comportamiento de `loading` y `disabled` de las otras variantes.
- [ ] 2.2 En `app/scan.tsx`, agregar el estado `selectedAccessPointId` inicializado con `defaultAccessPointId` de la membresía activa o, si no existe, con el primero de `accessPoints`.
- [ ] 2.3 Convertir las tarjetas de punto de acceso de `Card onPress` a opciones seleccionables: indicador visual del seleccionado, badge «Asignado» y `accessibilityState={{ selected }}`, sin iniciar el turno al tocarlas.
- [ ] 2.4 Agregar debajo de la lista un `Button variant="success"` con «Iniciar turno» que llame `startShift` con el acceso seleccionado, deshabilitado mientras guarda o cuando no hay selección.
- [ ] 2.5 Mostrar `EmptyState` «Sin accesos activos» sin botón de inicio cuando la comunidad no tiene puntos de acceso.
- [ ] 2.6 Mantener el mensaje de error en pantalla si el inicio falla, dejando al guardia sin turno.

## 3. Secciones colapsables

- [ ] 3.1 Agregar `CollapsibleSection({ title, defaultOpen, badge, children })` a `src/components/ui.tsx`: encabezado `Pressable` con `accessibilityRole="button"`, `accessibilityState={{ expanded }}`, `accessibilityLabel` con el título y el conteo del badge, glifo `▾`/`▸` y contenido montado sólo si está abierto.
- [ ] 3.2 Envolver la tarjeta «Mis turnos» de `app/scan.tsx` en `CollapsibleSection` con `defaultOpen={false}` y el conteo de turnos en el badge; mover el `EmptyState` de turnos adentro.
- [ ] 3.3 Envolver la actividad del turno (sección 5) en `CollapsibleSection` con `defaultOpen={true}`.
- [ ] 3.4 Verificar que el estado abierto/cerrado no se persista entre montajes de la pantalla.

## 4. Cámara bajo demanda

- [ ] 4.1 Agregar el estado `cameraOpen` en `app/scan.tsx`, en `false` al montar y al cerrar sesión.
- [ ] 4.2 Con la cámara cerrada, mostrar el botón «Escanear QR» y el campo de token manual con su botón «Escanear token», sin montar `CameraView`.
- [ ] 4.3 Con la cámara cerrada y sin permiso, pedir el permiso con `requestPermission()` al tocar «Escanear QR», no al montar la pantalla.
- [ ] 4.4 Con la cámara abierta, montar `CameraView` con `barcodeScannerSettings={{ barcodeTypes: ['qr'] }}` y mostrar un botón «Cancelar» que la cierre y vuelva al estado cerrado.
- [ ] 4.5 Bajar `cameraOpen` a `false` en `runScan` tanto en éxito como en error, y en `resetScan`.
- [ ] 4.6 Mantener el camino de token manual funcionando con la cámara cerrada y con el permiso denegado, con el botón deshabilitado si el campo está vacío.

## 5. Actividad del turno abierto

- [ ] 5.1 Crear `src/api/bitacora.ts` con `listBitacora(request, { shiftId, page = 1, pageSize = 50 })` contra `GET /api/bitacora`, devolviendo `BitacoraListResponse` de `@porteria/shared`.
- [ ] 5.2 Crear `src/lib/bitacora.ts` con los helpers que derivan hora, visitante, movimiento (ingreso/egreso/rechazo), destino y motivo desde `type`, `summary` y `details`.
- [ ] 5.3 Cargar la actividad del turno abierto en `app/scan.tsx` y sumarla a `refresh()`, junto al turno actual y la lista de turnos.
- [ ] 5.4 Renderizar la actividad dentro de su `CollapsibleSection` sólo cuando hay turno abierto, con los movimientos más nuevos primero e `EmptyState` cuando todavía no hubo movimientos.
- [ ] 5.5 Recargar la actividad después de confirmar o rechazar un escaneo, sin navegar ni recargar la pantalla.
- [ ] 5.6 Manejar el error de la actividad con un mensaje y un reintento local, sin tapar el escáner ni el resultado del escaneo.
- [ ] 5.7 Ocultar la sección al cerrar el turno, sin borrar ni modificar registros.

## 6. Verificación

- [ ] 6.1 `pnpm --filter @porteria/zima-qr-access typecheck` sin errores.
- [ ] 6.2 `npx prettier --write` sobre los archivos tocados y `git status` con sólo los archivos esperados.
- [ ] 6.3 Prueba manual en Expo Go: el login muestra el logo blanco sin deformarse y con el nombre accesible.
- [ ] 6.4 Prueba manual: elegir un acceso distinto del preseleccionado e iniciar turno con el botón verde.
- [ ] 6.5 Prueba manual: entrar al turno y confirmar que la cámara no está montada hasta tocar «Escanear QR», que «Cancelar» la cierra y que el token manual sigue funcionando.
- [ ] 6.6 Prueba manual: escanear un pase, confirmar el ingreso y ver el movimiento aparecer en la actividad; rechazar otro y ver el motivo.
- [ ] 6.7 Prueba manual: cerrar el turno y confirmar que la actividad desaparece de la app y que los movimientos siguen en la bitácora del dashboard.
- [ ] 6.8 Prueba manual: contraer y expandir «Mis turnos» y la actividad, verificando que el lector de pantalla anuncie el estado.
- [ ] 6.9 `pnpm exec openspec validate polish-guard-app --strict` sin errores.
