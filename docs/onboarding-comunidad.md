# Onboarding de una comunidad

Checklist para dejar una comunidad operativa con Portería Virtual: estructura física, accesos, usuarios, guardias, residentes y primer pase.

## Antes de empezar

- Organización y comunidad creadas (por bootstrap o desde la consola de plataforma).
- Dominio de dashboard y pass-web con HTTPS.
- App Zima QR Access instalada en los teléfonos de guardias y residentes.
- Acceso físico identificado con un nombre claro (ej. `Portón Principal`, `Entrada Vehicular`, `Portería Norte`).
- Un responsable de la comunidad con rol `org_admin` o `community_admin`.

## 1. Crear la estructura de ubicaciones

1. Entrar al dashboard como administrador.
2. Ir a **Admin → Secciones** y crear la estructura (`Torre`, `Manzana`, `Bloque`, etc.) con la cantidad de niveles.
3. Crear las unidades en el nivel hoja: apartamentos, casas, lotes u oficinas.
4. Verificar que cada unidad tenga un código único y una ruta legible (ej. `General / Torre A / Piso 1 / A-101`).
5. Asignar residentes a las unidades (titular, inquilino, residente).

> Los pases se crean contra una unidad hoja. Si la unidad no es hoja, la API responde `invalid` y no permite crear el pase.

## 2. Crear los accesos físicos

1. Ir a **Admin → Accesos**.
2. Crear cada portería o portón con:
   - **Nombre**: el que usa la comunidad en la vida real.
   - **Tipo**: puerta, portón o molinete.
   - **Dirección**: entrada, salida o ambas.
   - **GPIO**: opcional; se usa si hay relé físico.
3. Dejar inactivo cualquier acceso que no esté operativo.
4. Asignar un acceso por defecto a cada guardia desde **Admin → Usuarios** (campo `defaultAccessPointId`).

> La bitácora es por lugar físico. El nombre del acceso queda congelado en cada entrada; si cambia el nombre, el historial conserva el anterior.

## 3. Crear usuarios y roles

| Rol                             | Uso                                                        |
| ------------------------------- | ---------------------------------------------------------- |
| `org_admin`                     | Administra la organización y todas sus comunidades         |
| `community_admin`               | Administra una comunidad, sus accesos, usuarios y bitácora |
| `guard`                         | Inicia turno, escanea QR, confirma/rechaza ingresos        |
| `owner` / `tenant` / `resident` | Crea pases y muestra el QR desde la app                    |
| `staff`                         | Rol reservado; no tiene pantalla operativa en v1           |
| `operator`                      | Monitoreo/central; no escanea ni usa bitácora en v1        |

Pasos:

1. Crear o invitar al `community_admin`.
2. Crear las cuentas de guardias y asignarles comunidad + acceso por defecto.
3. Crear o invitar a los residentes y vincularlos a su unidad.
4. Verificar que cada usuario pueda iniciar sesión y que caiga en la pantalla correcta:
   - admin → `/admin`
   - guardia → `/guard` (dashboard) o modo guardia (app)
   - residente → `/home` (app)

## 4. Capacitar al guardia

1. Instalar la app **Zima QR Access**.
2. Iniciar sesión con su cuenta.
3. Confirmar que aparece el acceso por defecto.
4. **Iniciar turno**. Si no aparece el acceso, seleccionarlo de la lista.
5. Probar un escaneo con un pase de prueba:
   - escanear el QR,
   - revisar visitante, documento, patente y destino,
   - **Confirmar** o **Rechazar**.
6. Si lo mueven a otra portería, usar **Cambiar acceso**. No hace falta cerrar el turno.
7. Al terminar, **Cerrar turno**.
8. Explicar que la bitácora es inmutable: no se edita ni se borra; solo se agregan comentarios o novedades.

## 5. Capacitar al residente

1. Instalar la app **Zima QR Access**.
2. Iniciar sesión y verificar la unidad asignada.
3. Crear un pase:
   - nombre y documento del visitante,
   - tipo `entry_only` o `entry_exit`,
   - validez,
   - ventana diaria opcional,
   - vehículo y patente si aplica,
   - PIN opcional.
4. Mostrar el QR desde la app o compartir el link público.
5. Recordar:
   - el QR rota cada 24 segundos y solo funciona con la pantalla abierta;
   - el link público se vincula al primer dispositivo que lo abre;
   - si se comparte con otra persona, usar **Regenerar link**;
   - el guardia puede rechazar el ingreso si el pase no está vigente.

## 6. Primer pase de prueba

1. El residente crea un pase `entry_only` para hoy.
2. El guardia inicia turno en el acceso correspondiente.
3. El residente muestra el QR; el guardia escanea.
4. Confirmar el ingreso.
5. Verificar en **Bitácora de accesos**:
   - acceso,
   - tipo `Ingreso`,
   - visitante,
   - **Destino**,
   - **Autorizó**,
   - autor y hora.
6. Probar un rechazo y verificar que el pase sigue activo.
7. Probar un pase `entry_exit` y confirmar entrada y salida.

## 7. Operación diaria

- **Guardia**: iniciar turno, escanear, confirmar/rechazar, cambiar acceso si lo reasignan, cerrar turno.
- **Community admin**: revisar bitácora, agregar novedades, gestionar accesos, forzar cierre de turnos olvidados, dar de alta usuarios.
- **Residente**: crear pases, compartir links, regenerar links, revocar pases.
- **Soporte**: usar el runbook de producción ante QR inválido, link vinculado, turno abierto o acceso caído.

## 8. Checklist de aceptación

- [ ] Estructura y unidades creadas.
- [ ] Accesos nombrados y con dirección correcta.
- [ ] Guardias con acceso por defecto.
- [ ] Residentes vinculados a su unidad.
- [ ] Un guardia completó un turno con ingreso confirmado.
- [ ] Un residente creó y compartió un pase.
- [ ] La bitácora muestra destino y autorizador.
- [ ] Se probó un rechazo y un egreso.
- [ ] El community admin sabe forzar el cierre de un turno.
- [ ] El equipo conoce el runbook y el canal de soporte.

## 9. Pendientes conocidos de v1

- Notificaciones push: fase 2.
- Subusuarios/delegaciones: fase 2.
- Pases recurrentes y alertas de salida faltante: fase 2.
- Escaneo desde el dashboard: no incluido; el escaneo es con la app del guardia.
- `operator` no escanea ni accede a la bitácora en v1.
