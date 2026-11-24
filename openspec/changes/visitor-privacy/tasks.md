## 1. Datos

- [ ] 1.1 Cambiar la ventana a días: `organizations.retention_days` (30, 60 o 90,
      default 30), migrando el valor existente y retirando `retention_months`.
- [ ] 1.2 Guardar el consentimiento en `access_passes`: momento, IP, user agent,
      versión de la política y modo (`link` o `at_gate`).
- [ ] 1.3 Tabla `retention_holds`: organización, comunidad opcional, rango de
      fechas, motivo, autor, creación, vencimiento y liberación.
- [ ] 1.4 Reescribir el disparador de la bitácora: acepta únicamente el cambio
      que anonimiza, conserva al autorizador y permite reemplazar el resumen por
      su versión anónima.
- [ ] 1.5 Tests: la columna nueva queda con 30 por defecto, el consentimiento se
      guarda y se lee, y el disparador sigue rechazando cualquier otra escritura.

## 2. Retención

- [ ] 2.1 Barrido por días, con la ventana de cada organización.
- [ ] 2.2 Excluir los registros dentro de un rango preservado y vigente.
- [ ] 2.3 Anonimizar también el resumen del registro y conservar el nombre del
      residente que autorizó.
- [ ] 2.4 Tests: 29 días conserva, 31 anonimiza, un rango preservado no se toca,
      la liberación lo vuelve elegible, y el autorizador sigue identificado.

## 3. Consentimiento

- [ ] 3.1 Endpoint público para registrar la aceptación del visitante con su IP
      y user agent.
- [ ] 3.2 El QR del pase no se entrega sin consentimiento registrado.
- [ ] 3.3 Al escanear un pase sin consentimiento, el acceso lo registra como
      dado en portería.
- [ ] 3.4 Página del pase público: aviso, casilla sin premarcar y enlace a la
      política.
- [ ] 3.5 Tests: sin aceptación no hay QR, con aceptación sí, la aceptación no se
      sobrescribe y el escaneo sin consentimiento queda marcado `at_gate`.

## 4. Visibilidad por rol

- [ ] 4.1 El documento completo sólo se entrega a administradores de comunidad,
      organización y plataforma.
- [ ] 4.2 Operador y guardia reciben el documento enmascarado en el historial.
- [ ] 4.3 El escaneo sigue devolviendo la identidad que el guardia necesita para
      verificar.
- [ ] 4.4 El residente ve los datos de sus propios invitados y de nadie más.
- [ ] 4.5 Verificar que las exportaciones no llevan identidad.
- [ ] 4.6 Tests: guardia enmascarado en el detalle, administrador completo, el
      residente no alcanza pases ajenos, y el export no contiene documentos.

## 5. Panel

- [ ] 5.1 Selector de ventana con 30, 60 y 90 días.
- [ ] 5.2 Gestión de preservaciones: crear con motivo y vencimiento, listar y
      liberar.
- [ ] 5.3 Estado del consentimiento y su modo en el detalle del ingreso.
- [ ] 5.4 Playwright: cambiar la ventana, crear y liberar una preservación, y ver
      el estado del consentimiento.

## 6. Textos legales

- [ ] 6.1 Política de tratamiento de datos: responsable, finalidad, derechos,
      ventana, canales de atención y vigencia.
- [ ] 6.2 Aviso de portería para el punto de escaneo.
- [ ] 6.3 Cláusula de transmisión para la empresa de vigilancia.
- [ ] 6.4 Enlazar la política desde el aviso del pase público y desde el panel.

## 7. Verificación

- [ ] 7.1 Suites unitarias e integración en verde.
- [ ] 7.2 Smoke en staging: abrir un pase sin aceptar y comprobar que no hay QR,
      aceptar, escanear, y ver el documento enmascarado con el rol de guardia.
