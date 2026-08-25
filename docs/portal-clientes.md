# El portal de clientes — manual de operación

Este documento es para el EQUIPO: qué es el portal, cómo se opera desde
el panel, qué hacer cuando llega cada aviso y cómo salir de los
problemas típicos. La arquitectura y el detalle técnico viven en el
código (cada archivo lleva su porqué); aquí está lo que se hace.

## Qué es (en tres frases)

Los clientes con cuenta entran a `/portal` con correo y contraseña y ven
TODO lo suyo: su pedido, su plan con lo que contrató, sus pagos, su
invitación y sus invitados. Es una capa **encima** del sistema de
enlaces con token, que sigue igual: los invitados confirman por
`/i/<slug>`, el anfitrión gestiona su lista por `/lista/<token>` y la
recepción escanea sin cuenta — nadie que no la necesite tiene cuenta.
El aislamiento no es de pantalla: cada consulta del portal pasa por las
políticas de la base (RLS multicuenta), y `supabase/probar-aislamiento.sql`
lo demuestra contra la base real.

## Los roles

| Rol | Quién es | Qué puede |
|---|---|---|
| Equipo (propietario/admin/…)| Nosotros, en `/panel` | Todo, según `docs/roles-y-permisos.md`; las cuentas del portal exigen el permiso `gestionar_cuentas` |
| Propietario de cuenta | El cliente que contrató | Ve todo lo suyo, invita/quita colaboradores, edita los textos de su invitación |
| Colaborador | Quien el propietario invitó (pareja, planner) | Ve lo de la cuenta **según sus permisos**: `ver_pagos` y `editar_invitacion` se conceden casilla a casilla |
| Anfitrión / recepción / invitado | Sin cuenta | Sus enlaces con token de siempre |

Reglas que no se negocian:

- **Nunca se envía una contraseña** por WhatsApp ni por correo. El
  cliente la elige él, en su pantalla. Nosotros mandamos ENLACES, y
  todos caducan y se usan una sola vez.
- **Suspender no borra nada.** Cierra el portal y el login; reactivar
  lo devuelve todo tal cual.
- **Esconder un botón no es seguridad**: cada permiso se exige también
  en el servidor y, donde toca (pagos), en la propia base de datos.

## Operar desde el panel (ficha del pedido → tarjeta "Portal del cliente")

**Dar acceso.** Escribe el correo del cliente (será su usuario) → Crear
acceso → Copiar mensaje de WhatsApp → enviárselo. El enlace de
activación vence en 7 días; al usarlo, el cliente elige su contraseña y
entra directo.

**El enlace venció.** Botón "Generar enlace nuevo" (mata el anterior) y
reenviar el mensaje.

**Suspender / reactivar.** Suspender cierra el RLS (no ve nada) y
banea el login. Reactivar abre las dos puertas. Úsalo para impagos o a
petición del cliente; los datos no se tocan.

**Perdió la contraseña.** Botón "Enlace de recuperación" → copiar el
mensaje → WhatsApp. Vence en 24 horas y se usa una vez. Si venció,
genera otro. A un colaborador que olvidó la suya lo resuelve su
propietario: quitarlo y reinvitarlo.

**Colaboradores.** No se gestionan desde el panel: los invita el
PROPIETARIO desde su portal (`/portal` → Personas), con sus permisos
casilla a casilla. Nosotros solo entramos si algo se atasca.

## Qué hacer cuando llega cada aviso

Los avisos salen por la bandeja de la casa (`avisos`, con reintentos) si
`NOTIFICACIONES_EMAIL` y Resend están configurados. La tarjeta
"Actividad del portal" del tablero enseña lo mismo leyendo la
auditoría, con correo o sin él.

| Aviso | Qué pasó | Qué hacer |
|---|---|---|
| 🔑 Portal activado | El cliente ya entra con su contraseña | Nada. Si era el primer acceso que esperabas, avanza su pedido |
| 👥 Colaborador activado | Alguien nuevo entró a una cuenta | Nada, es normal. Si la cuenta no debería tener colaboradores, habla con el propietario |
| 📝 Textos editados | El cliente cambió textos de su invitación (el aviso dice QUÉ campos) | Echar un vistazo antes del próximo envío o publicación: los textos del cliente salen en vivo si está publicada |
| 🔐 Contraseña restablecida | Se usó un enlace de recuperación | **Este es de seguridad**: si nadie lo pidió por WhatsApp, investiga — y suspende la cuenta mientras tanto |

## Cuando algo no cuadra (los casos típicos)

- **"Este enlace ya no sirve" al activar** → venció (7 días) o ya se
  usó. Generar enlace nuevo desde la ficha y reenviar.
- **El cliente activó y ve "Esta cuenta no tiene portal"** → su usuario
  no quedó como miembro. Verifica en Supabase que `miembros_cuenta`
  tiene su fila; si el problema persiste, corre
  `supabase/probar-aislamiento.sql` — ya cazó un bug de políticas así.
- **"Ese correo ya tiene un usuario"** al activar → ese correo ya
  existe en auth (p. ej. es de otra cuenta). Hoy se resuelve con
  nosotros: usar otro correo o escribirnos para conectarlo a mano.
- **El colaborador no ve pagos** → es su permiso: el propietario se lo
  concede en Personas. No es un error, es el diseño.
- **La cuenta ve TODO vacío** → ¿está suspendida? `mi_cliente_id()`
  devuelve null con cuenta suspendida y el RLS cierra todo.

## Comprobaciones periódicas

- Tras cada migración que toque políticas del portal:
  `supabase/verificar-instalacion.sql` (todas OK) y
  `supabase/probar-aislamiento.sql` (15 filas ✅; un ❌ FUGA = no se
  despliega). Ver `docs/migraciones.md`.
- El tope de miembros por cuenta es **técnico** (anti-abuso), no
  comercial: nadie ha vendido "hasta N colaboradores".

## Decisiones comerciales pendientes (no inventadas a propósito)

- **Revisiones por plan** (`revisiones: null` en el catálogo): sin
  decidir, no se anuncia ni se limita.
- **Qué plan incluye qué funciones nuevas** (hogares, QR individual,
  preguntas extra del RSVP): hoy funcionan para todos vía tokens; el QR
  individual se vende como Premium sin estar implementado. Cuando se
  decida, va al catálogo (`lib/planes.ts`) y a la foto del contrato —
  los contratos ya firmados no se mueven.
- **Un usuario en varias cuentas**: `mi_cliente_id()` resuelve UNA
  cuenta por usuario. Si un día un planner lleva varias cuentas con el
  mismo correo, hay que ampliarla (está anotado en el código).
