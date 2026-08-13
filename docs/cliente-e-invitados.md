# Cliente e invitados (Etapa E)

Las dos personas que no son del equipo ya tienen su puerta, y ninguna
necesita cuenta: el **cliente** revisa y aprueba con un enlace, y el
**invitado** confirma con el suyo — con su nombre y su cupo ya puestos.

## El ciclo de aprobación del cliente

```text
Equipo: "Enviar a revisión" (tarjeta en el editor)
→ Se congela una VERSIÓN inmutable (tabla versiones, trigger anti-edición)
→ Enlace /revision/<token> (opaco, caduca a 30 días, revocable)
→ El cliente ve EXACTAMENTE esa versión, dibujada por el render de siempre
→ Comenta por sección · pide cambios · o APRUEBA firmando con su nombre
→ Aprobar deja evidencia (quién, cuándo, qué versión) y BLOQUEA la invitación
→ Editar lo aprobado exige desbloquear a propósito (motivo + auditoría)
→ Publicar sigue siendo un acto del equipo: aprobar no publica nada
```

Reglas que las pruebas (`pruebas/cliente.prueba.ts`) sostienen:

- **La aprobación apunta a una versión, no al editor.** Si el equipo toca
  algo después, la evidencia no se mueve: dice qué vio el cliente.
- **Revocada gana a todo; una aprobación hecha a tiempo sobrevive a la
  caducidad del enlace.** El enlace muere; la firma no.
- **Cada envío revoca el enlace anterior**: un solo enlace vivo por
  invitación, siempre apuntando a la última versión.
- Los comentarios llevan sección (del catálogo, no texto libre), estado
  (`abierto / en_proceso / resuelto / descartado`) y quién los resolvió.

## Hogares: la lista como invita la gente

En el panel del anfitrión (`/lista/<token>`): **"Familia Pérez, hasta 4"**
en vez de cuatro nombres sueltos. Cada hogar nace con un token opaco que
alimenta dos cosas:

- **Su enlace personal** `/i/<slug>?h=<token>`: la invitación con el
  nombre del hogar puesto y su cupo como tope del RSVP. El cupo se
  aplica **en el servidor** (la pantalla se la salta cualquiera); un
  token de otra boda se ignora y la invitación se enseña normal.
- **Su QR imprimible** (`/lista/<token>/qr`): hoja para recortar, con el
  código corto para teclear en la puerta. Dentro del QR viaja solo la
  dirección pública y azar — **nunca nombre, teléfono ni dirección**.

Los hogares son opcionales, como la lista de nombres: sin ellos todo
sigue funcionando igual que antes.

## Las preguntas extra del RSVP

"No pedir información innecesaria" hecho sistema: el RSVP nace solo con
nombre / asistencia / acompañantes, y el equipo activa en el editor
ÚNICAMENTE las preguntas que ese evento necesita (tarjeta RSVP →
"Preguntas extra"). Menú, alergias y transporte son atajos de un mismo
mecanismo genérico; una pregunta propia es una línea más. Máximo 5.

- La configuración vive en `datos.rsvp.preguntas` (viaja con las
  versiones y la IA la tiene vetada como todo el bloque rsvp) y se sanea
  al guardar (`lib/rsvp.ts`).
- La respuesta del invitado se valida EN EL SERVIDOR contra la
  configuración real: id desconocido u opción inventada se descartan,
  texto recortado a 200. Solo se pregunta a quien asiste, y todo es
  opcional — una pregunta sin responder no bloquea la confirmación.
- Las respuestas se guardan en `confirmaciones.respuestas` (jsonb,
  migración `20260806030000`), llegan al mensaje de WhatsApp del
  anfitrión, a su panel `/lista/<token>` (bajo cada nombre en "vienen")
  y a la ficha del pedido con el resumen copiable del equipo.

## La recepción (check-in)

Pestaña **Recepción** del panel del anfitrión, pensada para el día del
evento: buscar por nombre o código, ver esperados / ya dentro, y
confirmar cuántos entran.

- La puerta **registra, no impide**: cupo pasado o reingreso son avisos
  en ámbar; la decisión es del humano.
- Entrada parcial y reingreso son filas separadas; el total es la suma
  de las no anuladas.
- Lo mal anotado se **anula** (queda tachado con hora), nunca se borra:
  la puerta es historial.
- Queda quién anotó (operador) y a qué hora.

## La bandeja de salida (avisos)

Cada correo interno al equipo es una **fila en `avisos`** antes de ser un
correo: se encola, se intenta enviar al momento sin bloquear la petición,
y si Resend falla el repaso diario del cron lo reintenta (hasta 5
intentos; después queda `fallido` y visible). Tipos hoy: formulario
completado, revisión aprobada, cambios solicitados, comentario nuevo.

- Destinatarios: **solo** los de `NOTIFICACIONES_EMAIL`. Jamás datos de
  invitados.
- Sin `NOTIFICACIONES_EMAIL` configurado no se encola nada.
- El aviso de vencimientos sigue con su propio mecanismo idempotente
  (`aviso_vencimiento_en`), que ya reintentaba solo.

## Base de datos

Migración `20260805210000_cliente-e-invitados.sql` (también en
`schema.sql` y `verificar-instalacion.sql`):

| Tabla | Qué guarda | Nota |
|---|---|---|
| `versiones` | Fotos inmutables de la invitación | Trigger anti update/delete |
| `revisiones` | Enlaces de revisión del cliente | Token único, caducidad, revocación, evidencia de aprobación |
| `comentarios` | Feedback por sección | Estados de resolución |
| `hogares` | Cupo agrupado por familia | Token opaco (enlace personal + QR) |
| `entradas` | La puerta del evento | Se anula, no se borra |
| `avisos` | Bandeja de salida de correos internos | Estado + intentos + error |

Columnas nuevas: `invitaciones.bloqueada_en` (el candado),
`invitados.hogar_id` y `confirmaciones.hogar_id`.

Todo con RLS del equipo; el cliente y el anfitrión entran solo por rutas
de servidor autenticadas por token. Variables de entorno nuevas: ninguna.

## Qué queda pendiente (honesto)

- **Escaneo de QR con cámara en la recepción**: hoy el código se teclea
  o se busca por nombre. Leer el QR con la cámara del teléfono necesita
  una librería de descodificación en el navegador; entra cuando haga
  falta de verdad en un evento.
- **Adjuntar referencias en la revisión** (imágenes del cliente): el
  texto por sección cubre el 95% de los casos; subir archivos del
  cliente reutilizaría el flujo de fotos del formulario.
- **Notificaciones al CLIENTE** (no solo al equipo): mandarle "tu
  invitación está lista para revisar" por email exige su consentimiento
  y su correo verificado; hoy ese mensaje va por WhatsApp a mano, que es
  como Invifty habla con sus clientes.
- **Recordatorio RSVP automático a invitados**: mismo motivo — el canal
  real es WhatsApp del anfitrión; el panel ya da la lista y el botón.
