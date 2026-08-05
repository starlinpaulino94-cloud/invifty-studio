# Observabilidad

Qué se puede ver cuando algo falla, dónde mirarlo, y qué falta por conectar.

## Lo que existe hoy

**Logs del servidor** — `src/lib/registro.ts`. Los errores de las rutas API
se registran con ámbito y contexto (`[rsvp] ... slug=boda-x codigo=23505`) y
salen por la salida estándar, que en producción es **Vercel → proyecto →
Logs** y en local la terminal. Antes de esto, un 500 en el RSVP o en la
lista de invitados era indiagnosticable: la ruta devolvía "no se pudo
guardar" y tiraba el error real.

Regla de oro, probada en `pruebas/registro.prueba.ts`: **al log no entran
datos personales ni secretos**. El redactor tapa JWT, claves `sb_*` y
tokens hex antes de escribir, y los puntos de llamada solo pasan slug,
código de error y paso — nunca nombres, teléfonos ni notas de invitados.

**Dónde está cableado:**

| Ámbito | Qué cubre |
|---|---|
| `rsvp` | Fallos al guardar/actualizar confirmaciones |
| `lista-invitados` | Fallos al guardar o quitar nombres del anfitrión |
| (directo) | Derivados de imagen (`imagenes.ts`), Resend (`notificaciones.ts`) |

**Señales que ya existen fuera del log:**

- El cron de vencimientos (`vercel.json`, 13:00 UTC diario) — si falla,
  Vercel lo marca en Logs → Cron.
- Emails de Resend al completarse un formulario y al acercarse vencimientos.
- CI en GitHub Actions: lint, tipos, 220 pruebas y build en cada push.

## Cómo se mira un problema (runbook corto)

1. **"Un invitado dice que no pudo confirmar"** → Vercel → Logs → buscar
   `[rsvp]`. El contexto trae slug y código Postgres del fallo.
2. **"El panel del anfitrión no guarda la lista"** → buscar `[lista-invitados]`.
3. **"No llegaron los avisos de vencimiento"** → Logs → Cron: ¿corrió a las
   13:00 UTC? ¿Devolvió 401? (CRON_SECRET mal puesto) ¿500? (buscar el error).
4. **"No llegan los emails"** → buscar `Notificación Resend` en los logs; el
   fallo trae el status de Resend.

## Lo que falta (pendiente, por orden de valor)

1. **Sentry (o similar)** — errores del NAVEGADOR: hoy un error en el editor
   del panel o en una plantilla solo se ve si alguien lo reporta. Al
   conectarlo: el DSN va en variable de entorno nueva, el `beforeSend` debe
   tapar lo mismo que `redactar()` (y URLs firmadas de fotos), y el punto de
   entrada del servidor es `registrarError` — se conecta ahí y todos los
   ámbitos quedan cubiertos sin tocar las rutas. Requiere cuenta y clave:
   acción manual del propietario.
2. **Alertas** — hoy nadie avisa si el cron deja de correr o los errores
   suben. Lo mínimo viable: las alertas de fallo de deployment de Vercel
   (Settings → Notifications) y una mirada semanal a Logs. Con Sentry, sus
   alertas por tasa de error.
3. **Web Vitals de invitaciones** — LCP/INP/CLS reales de los invitados.
   Vercel Speed Insights lo da con un toggle + paquete; decisión pendiente
   porque añade un script a las invitaciones.

## Reglas para añadir registro nuevo

- Siempre por `registrarError(ambito, error, contexto)` — nunca
  `console.error` a mano en rutas: el redactor solo protege a quien pasa
  por él.
- Al contexto van identificadores técnicos (slug, código, paso, tabla).
  Nombres, teléfonos, notas, tokens y URLs firmadas NO — ni "recortados".
- El ámbito es el sustantivo de la ruta (`rsvp`, `fotos`, `cron`), estable,
  porque es la clave de búsqueda en el log.
