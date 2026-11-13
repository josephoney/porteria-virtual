# Tasks: guard id verification

## 1. Servidor: búsqueda por documento

- [ ] 1.1 Agregar `searchByDocument(requester, document, context)` en `access-scan.service.ts`: exige turno abierto y punto de acceso, normaliza el documento y devuelve las autorizaciones activas y vigentes de la comunidad con visitante, destino, ventana y estado.
- [ ] 1.2 Exponer `GET /api/access/authorizations?document=...` con `requireRole('guard')`.
- [ ] 1.3 Validar el documento de entrada (largo mínimo y sólo dígitos y letras) y responder `400` con un mensaje claro cuando no sirve.
- [ ] 1.4 Limitar las consultas por minuto por guardia y responder `429` al excederse.
- [ ] 1.5 Devolver una lista vacía con un código propio cuando no hay coincidencias, no un `404` genérico.

## 2. Servidor: registrar el ingreso

- [ ] 2.1 Agregar `confirmIdentityEntry(requester, passId, context)` que reutilice la transacción del escaneo, marque el pase como usado y escriba la bitácora.
- [ ] 2.2 Registrar `source: 'manual_identity'` y `type: 'pass_entry'`, con el guardia, el turno y el destino.
- [ ] 2.3 Responder `409` si el pase ya fue usado o revocado, y `400` si venció.
- [ ] 2.4 Publicar el evento del bus de pases para que el residente vea el cambio en vivo.

## 3. App: la pantalla del guardia

- [ ] 3.1 Reemplazar el bloque de token manual por la jerarquía de tres vías: «Escanear QR» como acción principal, «Escanear cédula» al lado y «Ingresar cédula manualmente» como control secundario que revela el campo.
- [ ] 3.2 Configurar la cámara con `barcodeTypes: ['qr']` en un modo y `['pdf417']` en el otro, cerrando la cámara al leer o cancelar.
- [ ] 3.3 Dejar el campo de cédula oculto hasta que el guardia pida tipearla, y mantener deshabilitado «Verificar autorización» con el campo vacío.
- [ ] 3.4 Al leer el PDF417, llenar el campo y seguir mostrando el botón de verificación: el escaneo no autoriza por sí solo.
- [ ] 3.4 Mostrar la lista de candidatas con visitante, destino, vigencia y estado, y permitir elegir una.
- [ ] 3.5 Confirmar el ingreso contra el API y refrescar la actividad del turno.
- [ ] 3.6 Mostrar los errores: sin autorizaciones, documento inválido, límite de consultas y pase ya usado.

## 4. Verificación

- [ ] 4.1 Test de integración: la búsqueda encuentra la autorización vigente por documento y no devuelve las vencidas ni las de otra comunidad.
- [ ] 4.2 Test de integración: confirmar por documento escribe la bitácora con `source: 'manual_identity'` y marca el pase como usado.
- [ ] 4.3 Test de integración: un guardia sin turno abierto recibe `403`.
- [ ] 4.4 Playwright: el guardia verifica una cédula y ve la autorización confirmada en la actividad del turno.
- [ ] 4.5 `typecheck` de la app, `tsc` de la API, Prettier y `openspec validate --strict`.
- [ ] 4.6 Suite completa en verde y commit.
