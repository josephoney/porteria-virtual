# Design: guard id verification

## Context

`scanPass` recibe un token de QR y valida firma, expiración, estado del pase y presencia. El documento del visitante ya se guarda en `access_passes.visitorDocument` cuando el residente crea la autorización, así que la segunda vía no necesita datos nuevos.

El guardia trabaja con un turno abierto y un punto de acceso, y la bitácora registra cada movimiento con `source` y `type`.

## Goals

- Permitir el ingreso de una visita autorizada cuando no hay QR disponible.
- Que el ingreso quede auditado con la misma calidad que uno por QR.
- No abrir una puerta lateral: la cédula no puede autorizar por sí sola.

## Non-goals

- Funcionar sin conexión.
- Sustituir la verificación física del documento por parte del guardia.

## Decisions

### 1. La búsqueda es por documento, no por nombre

El nombre lo escribe el residente y puede venir con errores de tipeo o incompleto. El documento es el dato que el guardia tiene en la mano y el que el residente cargó. Se busca por coincidencia exacta sobre el documento normalizado, sin búsquedas parciales: permitir prefijos convertiría el endpoint en un listado de todas las visitas de la comunidad.

### 2. Devuelve candidatas, nunca un veredicto

La respuesta es una lista de autorizaciones activas y vigentes de esa cédula en esa comunidad, con visitante, destino, ventana y estado. El guardia elige cuál corresponde y confirma. Un endpoint que respondiera "válido" convertiría la cédula en una contraseña, y la cédula de cualquiera es pública.

### 3. El ingreso se registra como origen propio

`source: 'manual_identity'` en la entrada de bitácora. Así se puede responder "cuántos ingresos no usaron QR este mes" sin adivinar. El `type` sigue siendo `pass_entry` para que los reportes de accesos no se rompan.

### 4. Requiere turno abierto y punto de acceso

Misma regla que el escaneo: sin turno no hay responsable. Un ingreso verificado por documento sin guardia identificado es basura desde el punto de vista de la auditoría, que es justamente para lo que sirve este registro.

### 5. El PDF417 se lee con la misma cámara, en un modo explícito

`expo-camera` soporta `pdf417` en `barcodeTypes`, y la cédula amarilla lo lleva al dorso. La pantalla ofrece "Escanear QR" y "Escanear cédula" por separado en vez de aceptar ambos formatos en un solo modo: el guardia sabe qué tiene en la mano, y separar los modos evita que un QR leído se interprete como número de documento.

El contenido del código se usa **sólo** para llenar el campo. Igual hace falta tocar "Verificar autorización" y confirmar una candidata.

### 6. Límite de consultas por turno

La búsqueda acepta como mucho N consultas por minuto por guardia, reutilizando el mecanismo de rate limit existente. Sin eso, un guardia con credenciales podría enumerar documentos hasta dar con una visita vigente, y ese es exactamente el ataque que la verificación física no cubre.

### 7. El nombre se muestra para comparar contra la cédula

La lista incluye el nombre del visitante y el destino. El guardia compara con el documento físico. La app no puede verificar que la persona sea quien dice ser; puede verificar que existe una autorización para ese número.

## Risks

- **Suplantación por conocer la cédula.** Mitigado parcialmente: el guardia mira el documento físico y el ingreso queda registrado con su nombre. No es perfecto, y no pretende serlo; es una segunda vía, no la principal.
- **Doble ingreso.** Si la visita ya entró por QR y alguien intenta entrar de nuevo por documento, la candidata aparece como usada y el guardia lo ve antes de confirmar.
