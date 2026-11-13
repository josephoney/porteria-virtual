# Design: Pestañas y paginación del tablero del guardia

## Context

`GuardPanel` renderiza hoy dos bloques consecutivos: `<AccessBitacoraView compact />` y una
tarjeta con la tabla «Historial de turnos». Ambos viven en la misma columna del `main`, así que
la segunda tabla arranca debajo de la primera. Con 20 movimientos y 20 turnos son unas 40 filas
más encabezados y filtros: dos pantallas de scroll en un puesto de vigilancia donde el guardia
mira de reojo.

`AccessBitacoraView` pagina de a 20 fijo y muestra «Página X de Y · N movimientos» con dos
botones. El historial de turnos no pagina: pide `page=1&pageSize=20` una sola vez al cargar.

## Goals

- Ver una tabla por vez en el tablero, sin apilar.
- Controlar cuántos registros se ven, con 10 / 35 / 50.
- Que la tabla no estire la página: si hay más, se pasa de página.

## Non-goals

- Cambiar el esquema de datos o los endpoints más allá de aceptar `pageSize` hasta 50.
- Rediseñar la bitácora de Análisis más allá de sus controles de paginación.
- Persistir la pestaña o el tamaño elegido entre visitas.

## Decisions

### 1. Pestañas con el `Tabs` que ya usa el resto del dashboard

`components/ui/tabs.tsx` ya existe y se usa en `PlatformPage`. Reutilizarlo mantiene el mismo
look y el mismo comportamiento de teclado que el resto de la consola, en vez de inventar un
toggle propio.

Las pestañas viven dentro de una `Card` que envuelve las dos tablas: **Ingresos y salidas** y
**Turnos**. La primera monta la bitácora, la segunda el historial de turnos. Abrir una no
renderiza la otra, así que el alto de la página no se suma.

Por defecto abre «Ingresos y salidas»: es lo que el guardia mira durante el turno. El historial
de turnos es consulta, no operación.

### 2. La paginación es responsabilidad de cada tabla

No se extrae un componente de paginación compartido: las dos tablas ya tienen contratos
distintos (una trae `total` del endpoint, la otra también pero con otra forma) y unificarlas
obligaría a adaptar ambos lados. Se replican los tres controles (selector, anterior, siguiente)
en cada una, con el mismo texto y los mismos valores, que es lo que el usuario percibe como
consistencia.

Si en el futuro aparece una tercera tabla, ahí sí conviene extraerlo.

### 3. Tamaños 10 / 35 / 50 y default 10

El pedido fija esos tres valores. El default baja de 20 a 10 para que la tabla entre en pantalla
sin scroll en una laptop de 768 px de alto, que es el caso real del puesto.

Cambiar el tamaño resetea la página a 1: quedarse en la página 3 con un tamaño mayor mostraría
una página que ya no existe.

### 4. El historial de turnos pasa a paginar contra el servidor

Hoy pide siempre la primera página de 20. Pasa a llevar `page` y `pageSize` en el estado y a
recargar cuando cambian, reutilizando el `page`/`pageSize` que `GET /api/guard/shifts` ya acepta.
No se pagina en cliente: el historial crece con cada turno y traer todo para cortar en memoria
es exactamente lo que hay que evitar.

### 5. Alto acotado con scroll interno como red de seguridad

Además de paginar, el contenedor de la tabla lleva `max-h` y scroll interno. Con 50 filas en una
pantalla chica la paginación sola no alcanza, y un scroll interno mantiene los encabezados
visibles. La página nunca crece más allá del viewport.

### 6. Los controles de la bitácora se mudan al encabezado de la tabla

El indicador de página queda arriba, junto al selector de tamaño, en vez de al pie. En una tabla
con scroll interno el pie puede quedar fuera de vista, y ahí es donde el usuario decide si hay
más.

## Risks

- **Cambiar el default de 20 a 10 hace que la bitácora muestre menos de entrada.** Mitigación: el
  selector está a la vista y el total se sigue mostrando.
- **Dos tablas con paginación independiente pueden desincronizarse** si el usuario cambia de
  pestaña y espera conservar la página. Es intencional: cada pestaña conserva su propio estado
  mientras el componente esté montado, y se pierde al recargar.
- **`pageSize` máximo del endpoint.** Si el servicio limita a 20, pedir 50 devolvería 20 sin
  avisar. Se verifica el esquema antes de implementar y, si el tope es menor, se sube.
