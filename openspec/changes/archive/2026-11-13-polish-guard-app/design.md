# Design: Pulir la app del guardia

## Context

`apps/zima-qr-access` es una app Expo Router que cubre tres roles: residente, guardia y
administrador. La pantalla del guardia vive entera en `app/scan.tsx` (unas 510 líneas) y
hoy tiene cinco problemas de uso:

1. El login muestra un cuadrado con la letra "Z" en lugar del logo de la marca.
2. El inicio del turno está escondido: cada punto de acceso es una tarjeta que arranca el
   turno al tocarla, sin un botón que diga qué va a pasar.
3. La lista de turnos se muestra siempre completa, sin forma de contraerla.
4. La cámara se monta al entrar al turno y queda abierta hasta que haya un escaneo, aunque
   el guardia no esté escaneando.
5. No hay forma de ver, desde la app, qué se autorizó durante el turno en curso.

La app no tiene tests automatizados ni librería de iconos, y su única verificación es
`typecheck`. Eso condiciona las decisiones: cada primitiva nueva tiene que ser chica, sin
dependencias, y explicable en una prueba manual.

## Goals

- Que el login se vea como un producto de Zima y no como un placeholder.
- Que iniciar un turno sea una acción explícita y visible, con el verde del sistema.
- Que las listas largas (turnos, actividad) se puedan plegar sin perder información.
- Que la cámara sólo esté prendida cuando el guardia lo pide, y que se pueda cerrar.
- Que el guardia vea los ingresos y egresos del turno abierto sin salir de la pantalla.
- No tocar backend, base de datos ni `@porteria/shared`.

## Non-goals

- Agregar tests automatizados o un runner de UI a la app: no existe hoy y no es el pedido.
- Traer una librería de iconos o de componentes.
- Notificaciones, pases recurrentes o cualquier ítem de Phase 2 de `add-zima-qr-access-app`.
- Cambiar la home del residente (`app/home.tsx`) ni la de administración.
- Persistir el estado abierto/cerrado de las listas entre visitas.

## Decisions

### 1. El logo se embebe como componente SVG, no como archivo

`images/LogoZima_W.svg` tiene `viewBox="0 0 7000 2500"` (ratio 2.8:1) y 16 formas con
`fill:white` y `stroke:#FEFEFE`. Las tres opciones eran: importar el `.svg` directo (requiere
`react-native-svg-transformer` y un `metro.config.js`, es decir, tocar el pipeline de build),
convertirlo a imagen PNG (pierde nitidez y suma un asset para dos tamaños) o transcribir las
formas a un componente con `react-native-svg`.

Se elige el componente: `react-native-svg` ya es dependencia directa (`15.16.0`) y no hace
falta configurar Metro ni agregar paquetes de build, que es justo el tipo de cambio que
rompe Expo Go. El componente `src/components/zima-logo.tsx` recibe `height` (por defecto 56),
calcula el ancho por ratio y expone `accessibilityRole="image"` con
`accessibilityLabel="Zima Seguridad"`. Los colores van literales dentro del componente
porque el logo es blanco por definición de marca; no se deriva de `theme.ts`.

### 2. La variante `success` entra en `Button`, no en un botón local

`Button` ya centraliza variantes (`primary | secondary | danger | ghost`), estados de carga y
deshabilitado. Agregar `success` con `colors.success` y label blanco mantiene una sola
definición de botón y deja la variante disponible para el resto de la app. Un `TouchableOpacity`
suelto en `scan.tsx` habría duplicado el manejo de `loading` y `disabled`.

### 3. Iniciar turno: selección + una acción

Los puntos de acceso dejan de ser botones y pasan a ser opciones con estado seleccionado
(`selectedAccessPointId`, inicializado con `defaultAccessPointId` de la membresía o el primero
de la lista). Debajo va un único `Button variant="success"` con «Iniciar turno».

Alternativas descartadas: un botón verde dentro de cada tarjeta (con cuatro porterías hay
cuatro verdes compitiendo, y el guardia tiene que leer cuál toca) y pintar la tarjeta entera de
verde (se pierde el contraste del texto sobre `colors.success`).

### 4. La cámara es un estado explícito de la pantalla

`cameraOpen: boolean` arranca en `false` y sólo se prende con «Escanear QR». El permiso se pide
en ese momento con `requestPermission()`, no al montar la pantalla: pedir cámara al entrar al
turno es exactamente el roce que el pedido quiere eliminar.

Mientras está cerrada se ven el botón «Escanear QR» y el campo de token manual con su propio
botón. Mientras está abierta se monta `CameraView` y aparece «Cancelar», que desmonta la cámara
y vuelve al estado cerrado. `runScan` baja `cameraOpen` tanto en éxito como en error: después
de un escaneo el guardia ya tiene el resultado en pantalla y no necesita la cámara prendida.

La sección queda siempre visible dentro del turno, pero sin cámara hasta que se pida.

### 5. `CollapsibleSection` como primitiva de `ui.tsx`

No hay acordeón ni librería de componentes, y el patrón se repite dos veces (turnos y
actividad). Se agrega `CollapsibleSection({ title, defaultOpen, badge, children })`:

- Encabezado `Pressable` con `accessibilityRole="button"`, `accessibilityState={{ expanded }}` y
  `accessibilityLabel` con el nombre de la sección más el conteo cuando hay `badge`.
- Indicador con los glifos `▾` / `▸` en un `Text`, porque no hay iconos y sumar una librería por
  dos caracteres no se justifica.
- El contenido se monta sólo si está abierto. Eso importa: la lista de turnos puede crecer y no
  queremos renderizar filas que no se ven.

`Mis turnos` arranca cerrado con el conteo en el encabezado, así la pantalla no termina en una
lista larga. `Actividad del turno` arranca abierto, porque si el guardia está en turno lo que
quiere ver es justamente eso.

### 6. La actividad sale de la bitácora filtrada por turno

`GET /api/bitacora` ya acepta `shiftId` y ordena por `createdAt` descendente, y el guardia ya
puede leer la bitácora de su comunidad por RBAC. No hace falta endpoint nuevo ni campo nuevo en
`@porteria/shared`: se agrega `src/api/bitacora.ts` con
`listBitacora(request, { shiftId, page, pageSize })` y un helper `src/lib/bitacora.ts` que
traduce `type`, `summary` y `details` (visitante, patente, destino, motivo) a lo que se muestra.

La sección se renderiza sólo si hay turno abierto. Al cerrarlo desaparece de la pantalla, pero
no se borra nada: los movimientos siguen en `bitacora_entries` con su `shift_id` para el
dashboard.

### 7. Un solo `refresh()` para turno, turnos y actividad

Hoy `refresh()` recarga el turno actual y la lista de turnos. Se le suma la carga de la
actividad, y se llama en los mismos cuatro momentos: al entrar en foco, al iniciar o cambiar de
acceso, al cerrar turno y después de confirmar o rechazar un escaneo. La alternativa —recargar
la actividad sólo al confirmar— dejaba desincronizada la lista cuando el turno cambia.

La actividad tiene su propio estado de error y reintento local para que un fallo de la bitácora
no tape el escáner.

### 8. El logo también va en la selección de contexto

`app/context.tsx` es la otra pantalla previa al login y repite el encabezado de marca. Se usa el
mismo componente sin tocar su lógica de selección, para que la app no cambie de identidad entre
las dos pantallas de entrada.

## Risks

- **Transcribir el SVG a mano puede perder formas.** Mitigación: comparar contra el archivo
  original y revisar el render a 2x y 3x en Expo Go antes de cerrar la tarea.
- **El logo blanco desaparece sobre fondo claro.** La app es de tema oscuro fijo
  (`colors.background = #0B1220`); si mañana se agrega tema claro, el logo necesita una variante
  oscura.
- **Cambiar los puntos de acceso de botón a selección puede confundir a quien ya usaba la app.**
  Mitigación: preseleccionar el acceso por defecto y dejar el botón con verbo explícito
  («Iniciar turno»), que es lo que el pedido busca.
- **La cámara bajo demanda agrega un toque al flujo de escaneo.** Es el costo aceptado de no
  tener la cámara prendida todo el turno.
- **`CollapsibleSection` monta y desmonta hijos.** Si una sección futura tiene estado propio
  (por ejemplo un formulario a medio llenar) va a perderlo al plegarse. Hoy no aplica: las dos
  secciones son listas de sólo lectura.
- **La actividad depende de que la bitácora escriba `shift_id`.** Ya lo hace en los flujos de
  escaneo del API; si un movimiento se registra con `shift_id` nulo, no aparece en la app. Es
  aceptable: un movimiento sin turno no pertenece a la actividad del turno.
