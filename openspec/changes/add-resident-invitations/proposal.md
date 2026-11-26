## Why

Hoy el alta de un residente obliga a un paso previo: la persona tiene que existir como
usuario en la plataforma para poder asignarle una unidad. El backend ya acepta
invitaciones a correos sin cuenta y crea la cuenta al aceptar, pero el dashboard solo
ofrece elegir usuarios existentes, no permite invitar a más de una unidad y no tiene
forma de cargar una lista de residentes.

En un edificio real eso significa cargar decenas de unidades a mano, una por una, y
depender de que cada residente ya esté registrado. La invitación por correo con alta
diferida es el camino natural: el administrador invita, el residente acepta, crea su
contraseña, completa sus datos y queda enrolado en la organización, comunidad y
unidad(es) que le corresponden.

## What Changes

- **Invitación a correos sin cuenta** con rol de ocupante (`resident`, `tenant`,
  `owner`): el formulario deja de pedir un usuario existente y pide el correo.
- **Multi-unidad**: una invitación puede cubrir varias unidades de la misma comunidad.
  Al aceptar se crea una membresía por unidad.
- **Puntos de entrada**:
  - acciones de fila en la pantalla de Unidades;
  - selección múltiple de unidades en el árbol de estructura;
  - el flujo de invitación existente del panel de administración, ampliado.
- **Carga masiva por CSV** con columnas `unidad` y `correo` (más `nombre` opcional),
  con previsualización, resumen de resultados y errores por fila.
- **Aceptación con perfil**: la página `/invite/:token` pide nombre y contraseña y
  permite completar teléfono y documento antes de entrar.
- **Seguimiento**: las invitaciones pendientes muestran las unidades incluidas y se
  pueden reenviar o revocar (el lifecycle ya existe).
- **Cuentas creadas por un administrador**: cuando un admin da de alta un usuario
  desde el menú de Usuarios, la persona recibe un correo para establecer su propia
  contraseña. Es el mismo mecanismo de token de un solo uso que la invitación y el
  restablecimiento; el admin ya no elige la contraseña.

**Non-goals:**

- No se habilita registro público abierto: solo se entra por invitación.
- No se cambia el modelo de personas ni se migra el `unitId` legacy.
- No se agrega aprobación manual del administrador en la aceptación.
- No se toca la mensajería ni el envío de emails más allá de reutilizarlo.

## Capabilities

### New Capabilities

- `resident-bulk-invitations`: carga masiva de invitaciones desde CSV, con
  previsualización, resultados por fila y límites de tamaño.

### Modified Capabilities

- `invitation-onboarding`: invitación por correo a personas sin cuenta, cobertura de
  varias unidades por invitación, entrada desde unidades y árbol de estructura, y
  aceptación con datos de perfil.
- `user-management`: el alta directa deja de recibir contraseña y pasa a emitir un
  enlace de activación de un solo uso, con reenvío.

## Impact

- **Base de datos**: nueva relación invitación ↔ unidades (tabla de unión con
  integridad referencial) y migración asociada.
- **API**: `POST /api/invitations` acepta `locationUnitIds`; nuevo endpoint de carga
  masiva; la aceptación crea una membresía por unidad; validaciones de alcance por rol.
  `POST /api/users` deja de pedir `password` y emite un enlace de activación; nuevo
  endpoint de reenvío de activación.
- **Dashboard**: `UnitsPage`, `StructureTreeWorkspace`, `AdminPanel` (diálogo de
  invitación), `UsersTable` (alta sin contraseña y reenvío), `InvitePage` y una pantalla
  nueva de carga masiva; tipos compartidos.
- **Specs**: delta de `invitation-onboarding` y capability nueva
  `resident-bulk-invitations`.
- **Riesgos**: duplicados por carrera al aceptar, invitaciones parcialmente válidas en
  el CSV y crecimiento del payload. Se mitigan con constraints únicos, resultado por
  fila y límites explícitos.
