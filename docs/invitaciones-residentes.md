# Invitaciones de residentes

Una invitación crea el vínculo entre una persona y una o más unidades de la misma
comunidad. Al aceptarla, la persona queda enrolada en la organización y recibe una
membresía y un registro de residente por cada unidad incluida.

## Cómo se invita

- **Desde una unidad**: en la tabla de unidades o en el árbol de estructura, usar
  `Invitar residente`. La acción sólo aparece para unidades hoja, activas y que
  admiten ocupantes (parqueaderos y depósitos no admiten residentes).
- **Desde varias unidades**: seleccionar unidades con los checkboxes y usar la barra
  inferior `Invitar a N unidades`. Todas deben pertenecer a la misma comunidad.
- **Carga masiva por CSV**: disponible en Unidades, Estructura y en la pestaña de
  invitaciones con permiso de administración.

Los roles disponibles son residente, arrendatario y propietario. Una invitación
individual admite hasta 50 unidades.

## Formato del CSV

La plantilla descargable tiene tres columnas:

```csv
unidad,correo,nombre
A-101,ana@example.com,Ana Torres
Torre A > Piso 2 > A-201,luis@example.com,Luis Gómez
```

- `unidad` y `correo` son obligatorias. `nombre` es opcional; si falta, la persona
  lo completa al aceptar la invitación.
- El correo se normaliza a minúsculas y se valida por fila. Un correo inválido no
  invalida el resto del lote.
- La unidad se puede indicar por **código** (`A-101`) o por **ruta completa**
  (`Torre A > Piso 2 > A-201`). Si el código está repetido en varias hojas, usar la
  ruta para desambiguar.
- El separador puede ser coma o punto y coma. Las celdas con comas o punto y coma
  deben ir entre comillas dobles; las comillas internas se escapan duplicándolas.
- Se aceptan archivos con BOM de Excel y saltos de línea Windows o Unix.
- El límite es de **500 filas por lote**. Un lote sin filas válidas no se envía.

## Vista previa y resultado

Antes de enviar, la vista previa consulta al servidor y clasifica cada fila:

- `valid`: se puede invitar.
- `failed`: no se puede invitar. El motivo puede ser `invalid_email`,
  `unit_required`, `unit_not_found`, `unit_not_leaf`, `unit_ambiguous` (incluye las
  rutas candidatas) o `duplicate_row` (mismo correo y unidad repetidos en el lote).

Al enviar, el resultado es parcial por fila. Una fila válida puede terminar como:

- `created`: la invitación se creó.
- `skipped`: la persona ya era miembro de esa unidad.
- `failed`: el servidor rechazó la fila (por ejemplo, por permisos o conflicto).

El diálogo muestra el resumen y permite reintentar únicamente las filas fallidas.

## Aceptación

El correo lleva a `/invite/:token`. La página muestra todas las unidades incluidas.
Si la persona no tiene cuenta, completa nombre, contraseña, teléfono y documento
opcionales; si ya tiene cuenta, debe iniciar sesión con ese mismo correo.

Al aceptar se crea una membresía y un registro en `location_residents` por unidad.
Si todas las membresías ya existían, la respuesta es `409 already_member` y no se
duplica ningún residente. La membresía de la primera unidad queda como contexto
activo.

## Errores frecuentes

| Código              | Qué significa                                                        |
| ------------------- | -------------------------------------------------------------------- |
| `unit_invalid`      | La unidad no existe, no es hoja o no pertenece a la comunidad.        |
| `unit_ambiguous`    | El código coincide con varias hojas; usar la ruta completa.          |
| `unit_not_leaf`     | Se indicó un nivel intermedio; la invitación requiere una hoja.      |
| `unit_not_found`    | No hay ninguna unidad con ese código o ruta en la comunidad.         |
| `already_member`    | La persona ya tiene membresía en todas las unidades de la invitación. |
| `invalid_email`     | El correo de la fila no tiene un formato válido.                     |
| `duplicate_row`     | El lote repite el mismo correo para la misma unidad.                 |
| `forbidden`         | La unidad queda fuera del alcance del administrador.                 |

## Operación

La funcionalidad requiere las migraciones `0040_invitation_units.sql` y
`0041_account_activation.sql`, que se aplican con el flujo habitual:

```bash
pnpm --filter @porteria/database db:migrate
```

En staging y producción el servicio de migraciones del compose las ejecuta antes de
levantar el API. No hay tareas manuales adicionales.
