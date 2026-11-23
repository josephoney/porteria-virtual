## 1. Un pase por cookie

- [ ] 1.1 Nombrar la cookie por pase (`pass_device_<passId>`) manteniendo
      `pass_device` como formato heredado.
- [ ] 1.2 Escribir la cookie del pase y, durante la transición, también la
      heredada.
- [ ] 1.3 Aceptar la cookie del pase o la heredada en `isBound`, sin cambiar el
      esquema de firma ni la regla de primer dispositivo.
- [ ] 1.4 Tests: abrir dos pases en el mismo cliente y verificar que ambos
      autorizan; verificar que un tercer dispositivo sigue rechazado.

## 2. Índice de pases del dispositivo

- [ ] 2.1 Endpoint que lista los pases ligados al dispositivo actual, con enlace,
      titular, destino y estado del ticket. Se resuelve con las cookies que el
      dispositivo presenta; no agrega identificador de dispositivo ni columna.
- [ ] 2.2 Ocultar del índice los pases revocados, vencidos o agotados, sin
      borrarlos del historial.
- [ ] 2.3 Entrada en la web pública para llegar al índice y salir de un pase
      hacia otro. El índice es una lista clara y grande; cada pase abre su QR a
      tamaño completo, uno a la vez (no un mosaico).
- [ ] 2.4 Tests del endpoint: lista vacía para un dispositivo sin pases, sin
      filtración entre dispositivos y sin depender de un identificador guardado.

## 3. Verificación

- [ ] 3.1 Suites unitarias e integración en verde.
- [ ] 3.2 Smoke manual: dos links de unidades distintas en el mismo teléfono,
      ambos accesibles desde el índice, cada uno con su QR a tamaño completo.
- [ ] 3.3 Confirmar que el escaneo de un pase no altera el estado del otro.
