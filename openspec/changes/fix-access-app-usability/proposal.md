## Why

La app de acceso se usa de pie, con una mano y con alguien esperando en la
portería. En ese contexto, el teclado tapa el botón que hay que presionar y el
campo que hay que leer, y la cámara aparece descentrada.

Hay tres defectos concretos de uso y uno de información:

- al elegir una cuenta guardada en el login, el teclado se abre y deja el botón
  de Ingresar debajo;
- al escribir una cédula a mano, el teclado numérico tapa el campo y el botón de
  verificar;
- la vista de la cámara no está centrada en la pantalla;
- el home no dice en qué comunidad está la persona ni de qué unidad es, así que
  un guardia que trabaja en varias comunidades no tiene cómo confirmarlo de un
  vistazo.

## What Changes

- El login adapta su altura al teclado y permite tocar el botón con el teclado
  abierto.
- El ingreso manual de documento scrollea para dejar visibles el campo y la
  acción principal.
- La vista previa de la cámara queda centrada.
- El home del guardia y del residente muestra la comunidad y la unidad.
- La API expone la unidad del contexto activo para que la app pueda mostrarla.

## Capabilities

### New Capabilities

- `access-app-usability`: comportamiento de las pantallas de la app de acceso
  frente al teclado, la cámara y el contexto de la persona.

### Modified Capabilities

None.

## Impact

- `apps/zima-qr-access`: login, escaneo, ingreso manual y home.
- `server/api`: el contexto de la sesión incorpora la unidad y su nombre.
- Sin migraciones.
