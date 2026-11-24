# Tratamiento de datos personales

Este documento describe cómo la plataforma trata los datos de las personas que
entran a una comunidad. No es un documento legal genérico: cada punto
corresponde a una decisión implementada en el sistema, y donde no hay
implementación se dice explícitamente.

## Responsable y encargado

La **organización** (la administradora del conjunto o el cliente que contrata la
plataforma) es la **responsable** del tratamiento: decide para qué se recogen los
datos y durante cuánto tiempo se conservan.

La plataforma actúa como **encargada**: procesa los datos por cuenta de la
organización y no los usa para fines propios.

## Finalidad

Controlar el acceso de visitantes a las unidades: verificar que una persona
está autorizada, registrar su ingreso y su salida, y permitir que la comunidad
responda ante un incidente dentro de su perímetro.

Ningún dato se usa para publicidad, perfilamiento comercial ni cesión a
terceros ajenos a esa finalidad.

## Datos que se tratan

| Dato                                        | Dónde vive              | Para qué                                |
| ------------------------------------------- | ----------------------- | --------------------------------------- |
| Nombre y apellido del visitante             | pase, escaneo, bitácora | identificarlo en la portería            |
| Documento de identidad                      | pase, escaneo, bitácora | verificar que es quien dice ser         |
| Placa del vehículo                          | pase, escaneo           | controlar el ingreso vehicular          |
| Acompañantes                                | pase                    | saber cuántas personas entran           |
| Fecha y hora de ingreso y salida            | bitácora, escaneos      | registrar el movimiento                 |
| Nombre del guardia o residente que autorizó | bitácora                | responder quién permitió la entrada     |
| IP y agente del navegador                   | pase (consentimiento)   | probar cuándo y desde dónde se autorizó |

No se capturan datos sensibles. En particular, **no se escanea el código QR de la
cédula**: el documento se transcribe a mano y se guarda como texto.

## Autorización

Antes de mostrar el QR, la persona ve el aviso y marca una casilla que **no viene
premarcada**. El sistema registra fecha, hora, IP, agente del navegador y la
versión de la política aceptada. Esa prueba es lo que permite demostrar la
autorización si alguien la cuestiona.

Si la persona nunca abrió el enlace y el guardia la registra en portería, la
autorización se captura en ese momento y queda marcada como **en portería**
(`at_gate`) en lugar de **por enlace** (`link`).

Si la versión de la política cambia, se exige aceptar de nuevo.

## Conservación

La ventana es de **30, 60 o 90 días**, según lo que defina cada organización (30
por defecto). Al cumplirse, el tratamiento depende del registro:

- **La bitácora** es el registro operativo de la comunidad. Pierde al visitante
  completo: nombre, documento, acompañantes y placa; el resumen pasa a «Acceso
  anonimizado». Conserva la hora, la portería, el resultado, el motivo, el turno,
  el pase y **quien autorizó**, que es lo que responde quién dejó entrar.
- **El pase** es la constancia del residente sobre a quién autorizó. Conserva el
  nombre, los acompañantes y la placa; **sólo se anonimiza el documento**, porque
  es el dato que permite suplantar a una persona. Así el residente puede revisar
  meses después quién entró a su unidad y a qué hora.
- **Los escaneos** conservan el nombre y la hora, y anonimizan el documento.

La ventana del pase se mide desde su **último uso**, no desde su fecha de
vencimiento: un pase de larga vigencia no conserva la cédula más tiempo que sus
visitas.

Mientras la cédula exista, tampoco se muestra de más: el residente y el guardia
la ven enmascarada una vez que el pase se usó, y el escaneo en vivo es el único
momento en que el guardia la ve completa.

El **nombre del guardia o residente que autorizó se conserva siempre**.

Las exportaciones de reportes no incluyen identidad: sólo agregados por período,
portería, método, resultado y turno.

## Preservación por incidente

Cuando ocurre un incidente, la organización puede **preservar un rango de fechas**
antes de que la ventana lo alcance. La preservación tiene motivo, autor y
vencimiento obligatorio; mientras esté vigente, el barrido de retención no toca
ese rango. Al liberarla, el rango vuelve a quedar sujeto a la ventana.

Preservar no comparte ni copia datos: sólo impide su anonimización durante el
plazo indicado.

## Quién ve qué

| Rol                                       | Nombre del visitante  | Documento                       |
| ----------------------------------------- | --------------------- | ------------------------------- |
| Guardia en el escaneo                     | Sí (es su función)    | Sí, en el momento de verificar  |
| Guardia u operador en la bitácora         | Sí                    | Enmascarado (`***` + últimos 4) |
| Administrador de comunidad u organización | Sí                    | Completo, dentro de la ventana  |
| Residente                                 | Sus propios invitados | Completo (lo escribió él)       |

Fuera de la ventana, la bitácora ya no muestra al visitante: aparece como
«Acceso anonimizado». El residente conserva en su propio historial el nombre y la
hora de cada ingreso y salida, y en todos lados el documento queda como
`ANONIMIZADO`.

## Transmisión a terceros

Si la vigilancia la presta una **empresa externa**, esa empresa es un
**transmisor** y requiere contrato escrito conforme al artículo 25 del Decreto
1377 de 2013, con las mismas obligaciones de seguridad y confidencialidad y la
prohibición de usar los datos para fines distintos.

La infraestructura (servidores, base de datos, correo transaccional) también
opera como encargada y debe cubrirse con el contrato correspondiente.

## Seguridad

- Acceso por rol y por comunidad; un rol de comunidad no puede ver otra.
- La bitácora es **inmutable**: la base rechaza cualquier modificación salvo la
  anonimización, que además verifica que sólo se hayan quitado datos de
  identidad.
- Cada corrida de retención queda registrada con fecha, ventana, modo y conteos.
- La exportación de reportes no expone identidad.

## Derechos de la persona

Conocer, actualizar, rectificar y suprimir sus datos, y revocar la autorización.
La solicitud se presenta a la organización responsable, que la atiende dentro de
los plazos de la Ley 1581 de 2012.

La supresión se atiende sobre el registro de acceso: el sistema anonimiza el
documento de forma automática al cumplirse la ventana, y si la persona pide la
supresión del nombre, la organización la ejecuta sobre el registro, porque el
sistema lo conserva como evidencia de la visita.

## Textos para portería

**Aviso para el cartel de la entrada**

> En este acceso se registran el nombre y el documento de las personas que
> ingresan, con el fin de controlar el acceso y atender incidentes. Pasado el
> plazo definido por la administración, el número de documento se anonimiza y el
> registro de la visita se conserva. Puede consultar el aviso completo y ejercer
> sus derechos ante la administración de la comunidad.

**Texto de la casilla en el pase**

> He leído el aviso y autorizo el tratamiento de mis datos para controlar el
> acceso.

## Pendiente fuera de este documento

- Registro Nacional de Bases de Datos (RNBD): aplica según el tamaño de la
  organización; lo evalúa la responsable.
- Política de privacidad publicada en la aplicación móvil, con el detalle de
  cámara, documento y retención.
- Contrato de transmisión firmado con la empresa de vigilancia, si existe.
