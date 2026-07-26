# Invifty Studio

Sistema interno de operaciones de **Invifty** (invitaciones digitales premium).
Dos caras:

- **Panel privado** (`/panel`): pipeline de pedidos, clientes, pagos, vencimientos y métricas. Requiere login.
- **Formulario público** (`/f/<token>`): asistente conversacional que el cliente llena desde su celular con un link único. Sin cuenta, con guardado automático y subida de fotos.

**Stack:** Next.js 16 (App Router) · Tailwind CSS 4 · Supabase (Postgres + Auth + Storage) · Vercel.

---

## 1. Configurar Supabase (paso a paso)

### 1.1 Crear el proyecto

1. Entra a [supabase.com](https://supabase.com) y crea una cuenta (gratis).
2. Clic en **New project** → elige nombre (`invifty-studio`), una contraseña fuerte para la base de datos y la región **East US (North Virginia)** (la más cercana a RD).
3. Espera 1-2 minutos a que el proyecto se aprovisione.

### 1.2 Crear las tablas y el bucket de fotos

1. En el menú lateral: **SQL Editor** → **New query**.
2. Abre el archivo [`supabase/schema.sql`](./supabase/schema.sql) de este repo, copia TODO su contenido, pégalo y presiona **Run**.
   - **¿Ya habías ejecutado el schema antes de la Fase 2?** Entonces ejecuta solo [`supabase/migracion-fase2-invitaciones.sql`](./supabase/migracion-fase2-invitaciones.sql), que agrega la tabla `invitaciones`.
   - **¿Ya lo habías ejecutado antes de las confirmaciones (RSVP)?** Ejecuta también [`supabase/migracion-rsvp-confirmaciones.sql`](./supabase/migracion-rsvp-confirmaciones.sql), que agrega la tabla `confirmaciones`. Sin ella, las confirmaciones de los invitados no se guardan.
   - **¿Y antes del contador de visitas?** Ejecuta [`supabase/migracion-visitas.sql`](./supabase/migracion-visitas.sql), que agrega la tabla `visitas`. Sin ella el panel muestra el contador en cero, pero nada se rompe.
   - **¿Y antes de los avisos de vencimiento?** Ejecuta [`supabase/migracion-aviso-vencimiento.sql`](./supabase/migracion-aviso-vencimiento.sql), que agrega la columna `aviso_vencimiento_en` a `pedidos`.
   - **¿Dudas de si quedó todo bien?** Pega [`supabase/verificar-instalacion.sql`](./supabase/verificar-instalacion.sql) en el SQL Editor: comprueba tablas, columnas, índices, RLS y políticas, y no modifica nada. Las siete filas deben decir `OK`.
3. Verifica en **Table Editor** que existen las tablas `clientes`, `pedidos`, `pagos`, `formularios`, `invitaciones`, `confirmaciones` y `visitas`, y en **Storage** que existe el bucket `fotos-pedidos`.

### 1.3 Crear el primer usuario del panel

1. Menú lateral: **Authentication** → **Users** → **Add user** → **Create new user**.
2. Escribe tu correo y una contraseña. Marca **Auto Confirm User**.
3. Con ese correo y contraseña entrarás en `/login`. (Repite para cada miembro del equipo.)

### 1.4 Copiar las llaves

1. Menú lateral: **Project Settings** → **API Keys**.
2. Necesitas tres valores:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon / public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** (clic en "Reveal") → `SUPABASE_SERVICE_ROLE_KEY` ⚠️ *Esta es secreta: solo va en variables de entorno del servidor, nunca en el navegador ni en el repo.*

---

## 2. Correr en local

```bash
cd invifty-studio
npm install
cp .env.example .env.local     # pega los 3 valores de Supabase
npm run dev                    # abre http://localhost:3000
```

### Comprobaciones antes de subir un cambio

```bash
npm run lint       # estilo de código
npx tsc --noEmit   # tipos
npm test           # pruebas
npm run build      # compilación
```

Las cuatro corren solas en cada push y cada pull request
(`.github/workflows/ci.yml`).

**Las pruebas** (`pruebas/`) usan el ejecutor que trae Node, sin dependencias
extra, y corren TypeScript directamente (requiere **Node 22.6+**). Cubren sobre
todo las costuras entre el formulario y el sistema de diseño: que ninguna paleta
ofrecida al cliente falte del catálogo, que toda plantilla sugerida exista, que
no haya identificadores de pregunta repetidos y que las respuestas lleguen
enteras a la invitación. Es justo el tipo de fallo que no rompe el build y llega
al cliente sin que nadie lo note.

`NEXT_PUBLIC_APP_URL` en local es `http://localhost:3000` — se usa para armar los links de formulario que envías por WhatsApp.

---

## 3. Desplegar en Vercel

1. Sube este código a un repositorio de GitHub (puede ser este mismo monorepo).
2. En [vercel.com](https://vercel.com): **Add New → Project** → importa el repositorio.
3. **Importante si está en un monorepo:** en "Root Directory" selecciona la carpeta `invifty-studio`.
4. En **Environment Variables** agrega las 4 variables de `.env.example`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_APP_URL` → la URL final, ej. `https://invifty-studio.vercel.app` (o tu dominio `studio.invifty.com`).
     Si la olvidas, el sistema detecta solo el dominio de Vercel; defínela igualmente para que
     los enlaces usen siempre tu dominio definitivo.
5. **Deploy**. Al terminar, entra a `https://tu-url/login` con el usuario creado en el paso 1.3.

> Consejo: agrega un dominio propio (ej. `studio.invifty.com`) en Vercel → Settings → Domains, y actualiza `NEXT_PUBLIC_APP_URL` para que los links de formularios usen ese dominio.

---

## 4. Recorrido de prueba (5 minutos)

1. **Entra al panel**: `/login` con tu usuario de Supabase.
2. **Crea un pedido**: Tablero → *Crear pedido*. Ejemplo: María Pérez · 809-555-0101 · Boda · Plan Popular · RD$ 2,500 · fecha en 2 meses. Guarda.
3. **Envía el formulario**: en la ficha aparece el banner "¡Pedido creado!". Clic en **Copiar mensaje para WhatsApp** (el pedido pasa solo a *Formulario enviado*). Copia el link del formulario.
4. **Llénalo como cliente**: abre el link en una ventana de incógnito (o en tu celular). Verás el asistente paso a paso: responde algunas preguntas, sube 2-3 fotos, cierra la pestaña a mitad de camino y vuelve a abrir el link — continúa donde quedaste. Termina y envía.
5. **Revísalo en el panel**: el tablero mostrará la alerta "Formularios completados, listos para diseño". Entra a la ficha: verás las respuestas organizadas por secciones (con botón *Copiar sección*), las fotos descargables, y podrás registrar un abono de RD$ 1,000 para ver el saldo pendiente.
6. **Simula la entrega**: cambia el estado a *Entregada* — el sistema calcula la fecha de vencimiento según el plan y el pedido aparece en la vista **Vencimientos**. Pega la URL de la invitación en "Entrega y notas".
7. **Métricas**: revisa pedidos e ingresos del mes en la pestaña Métricas.

---

## 5. Cómo se edita el sistema

| Quiero cambiar… | Archivo |
|---|---|
| Preguntas del formulario (por evento y plan) | `src/config/formularios.ts` |
| Precios, vigencias, límites de fotos, extras | `src/lib/planes.ts` |
| El mensaje de WhatsApp que se copia | `mensajeWhatsAppFormulario` en `src/lib/planes.ts` |
| Estados del pipeline | `src/lib/planes.ts` (constante `ESTADOS`) + constraint en `supabase/schema.sql` |

### Vigencias

Meses que la invitación queda en línea desde la entrega. Es la misma política que
anuncia la página pública:

| Esencial | Popular | Premium | Luxury |
|---|---|---|---|
| 3 meses | 6 meses | 9 meses | 12 meses |

Se cambia en un solo sitio: `VIGENCIA_MESES` en
[`src/lib/planes.ts`](./src/lib/planes.ts). El repaso diario apaga las
invitaciones según ese valor, así que **tiene que coincidir con lo que anuncia la
web**; antes el sistema aplicaba 3/3/3/12 mientras la web prometía 3/6/9/12, y un
cliente Premium se quedaba sin invitación a los 3 meses.

**Si vuelve a cambiar:** los pedidos ya entregados llevan su fecha congelada con
la política vieja. Para aplicarles la nueva:

```bash
# Ver qué cambiaría, sin tocar nada
node --experimental-strip-types --env-file=.env.local scripts/recalcular-vencimientos.mts

# Si el listado convence, aplicarlo
node --experimental-strip-types --env-file=.env.local scripts/recalcular-vencimientos.mts --aplicar
```

El script **solo alarga, nunca acorta**: si la política nueva diera una fecha
anterior a la que ya tiene un pedido, lo deja como está y te lo dice. A un cliente
no se le quita algo que ya se le prometió. A las invitaciones que revive las
devuelve a estado *Activa* y les limpia el aviso, para que el repaso diario vuelva
a avisar con la fecha nueva.

## 6. Funciones adicionales

### Exportar el brief de diseño (PDF)

En la ficha de cada pedido hay un botón **"Exportar brief (PDF)"** que abre un
documento limpio con todos los datos: cliente, plan, pagos, respuestas por
sección y fotos. Desde ahí, **Imprimir / Guardar como PDF** usa el diálogo del
navegador — perfecto para pasárselo al diseñador o archivarlo.

### Dictado por voz en el formulario

En los campos donde el cliente tiene que escribir aparece un botón
**"Dictar respuesta"**: toca el micrófono, habla con naturalidad y su voz se
va transcribiendo sola en el campo. Ahorra mucho tiempo sobre todo en la
historia de la pareja y en los detalles largos.

- Funciona en Chrome, Edge y Safari (iPhone iOS 14.5+), que cubre casi todo
  el público que abre un enlace por WhatsApp. Si el navegador no lo soporta,
  el botón no aparece y el cliente escribe con el teclado como siempre.
- No cuesta nada ni requiere claves: usa el reconocimiento de voz del propio
  navegador.
- **Privacidad:** la transcripción la realiza el servicio de voz del navegador
  (Google en Chrome, Apple en Safari), no un servidor de Invifty. El audio no
  se almacena: solo se guarda el texto resultante. Conviene mencionarlo en la
  política de privacidad de la web pública.

### Aviso por email cuando un cliente completa su formulario

1. Crea una cuenta gratis en [resend.com](https://resend.com) (3,000 emails/mes gratis).
2. Copia tu API key en la variable `RESEND_API_KEY` (en `.env.local` y en Vercel).
3. Pon tu correo (o varios, separados por coma) en `NOTIFICACIONES_EMAIL`.
4. Listo: cada vez que un cliente termine su formulario, te llega un email con
   el resumen y el botón directo a la ficha del pedido.

> Nota: sin dominio verificado, Resend solo permite enviarte a ti mismo (el
> correo de tu cuenta Resend) usando el remitente `onboarding@resend.dev`.
> Para avisar a todo el equipo con remitente propio, verifica tu dominio en
> Resend → Domains y define `NOTIFICACIONES_REMITENTE="Invifty Studio <studio@invifty.com>"`.

## 7. Fase 2 — Generador de invitaciones

El ciclo completo ya vive en el Studio:

1. **Generar**: en la ficha del pedido (con el formulario completado), clic en
   **"Generar invitación"**. El sistema convierte las respuestas en una
   invitación en borrador: título, fecha, lugares, paleta, historia,
   cronograma, regalos y RSVP quedan pre-llenados automáticamente.
2. **Ajustar**: se abre el editor, donde el equipo pule textos, cambia la
   paleta, activa/desactiva secciones y define la dirección web (slug).
   El botón **"Vista previa"** muestra la invitación real — los borradores
   solo son visibles para el equipo con sesión iniciada.
3. **Publicar**: un clic y la invitación queda pública en `tu-dominio/i/<slug>`,
   lista para que el cliente la comparta por WhatsApp. Al publicar, el pedido
   se marca automáticamente como **Entregada**, se guarda la URL en la ficha y
   se calcula la fecha de vencimiento según el plan.

La invitación pública incluye: portada con foto y cuenta regresiva en vivo,
botón de Google Calendar, lugares con enlaces a Google Maps y Waze, código de
vestimenta, historia, programa del día, galería (las fotos que subió el
cliente), mesa de regalos con botón de copiar, y confirmación de asistencia
que queda registrada en el sistema.

### Confirmaciones de asistencia (RSVP)

Cuando un invitado confirma, su respuesta **queda guardada** y aparece en la
ficha del pedido: total de personas, quiénes confirmaron, quiénes no podrán ir
y las notas que dejaron. Desde ahí el equipo puede **copiar el resumen** para
mandárselo al anfitrión por WhatsApp, o **exportar la lista** a CSV para abrirla
en Excel.

- Después de guardar, al invitado se le ofrece **avisar también por WhatsApp**.
  Es un paso opcional: aunque no lo pulse, su confirmación ya está registrada.
  (Antes era al revés — solo se abría WhatsApp y no se guardaba nada, así que
  quien no llegaba a enviar el mensaje se perdía sin rastro.)
- Si un invitado confirma dos veces con el mismo nombre, **se actualiza su
  respuesta** en lugar de duplicarla, para que el total de personas sea real.
  Los nombres se comparan sin acentos ni mayúsculas ("José Pérez" y
  "jose perez" son la misma persona).
- Solo las invitaciones **publicadas** aceptan confirmaciones. En la vista
  previa del equipo el formulario funciona pero no guarda nada, para no
  ensuciar la lista del cliente con pruebas.
- La confirmación se envía a `/api/invitacion/<slug>/rsvp`, que valida todo en
  el servidor. Los invitados nunca tocan la base de datos directamente.

### Avisos de vencimiento y renovación

Cada plan incluye la invitación en línea durante unos meses. Antes ese
vencimiento llegaba sin que nadie avisara, y ningún pedido pasaba nunca al
estado *Vencida* por sí solo: se quedaban en *Entregada* para siempre.

Ahora una tarea programada repasa las invitaciones **una vez al día**:

1. Marca como **Vencida** toda invitación cuya fecha ya pasó.
2. Manda **un solo correo** al equipo con las que vencen en los próximos
   **15 días**, con el enlace directo a cada ficha. Cada pedido se avisa una
   vez, no todas las mañanas.

En **Panel → Vencimientos** cada invitación muestra cuántos días le quedan y,
si está cerca o ya venció, un botón **"Copiar renovación"** con el mensaje ya
escrito para mandárselo al cliente por WhatsApp.

**Para activarlo en Vercel:**

1. En **Settings → Environment Variables** agrega `CRON_SECRET` con una cadena
   larga al azar. Vercel la enviará sola en cada ejecución.
2. El horario ya está en [`vercel.json`](./vercel.json): todos los días a las
   9:00 de la mañana (hora de RD). Se aplica en el siguiente despliegue.
3. Los avisos por correo usan la misma configuración de Resend de la sección
   anterior. Sin `RESEND_API_KEY` el repaso igual marca las vencidas, pero no
   manda correo — y no las da por avisadas, así que lo reintenta al día
   siguiente.

> Sin `CRON_SECRET` la ruta responde 401 y el repaso no corre. Es a propósito:
> escribe en la base de datos y no puede quedar abierta.

### Cuántas veces se abrió la invitación

En la ficha del pedido, la tarjeta **"Cómo va la invitación"** muestra cuántas
veces se abrió, cuánta gente la vio y el movimiento de los últimos 7 días, con
un botón para **copiar el mensaje** listo para mandárselo al cliente. Es prueba
del trabajo entregado y la mejor excusa para hablar de renovar la vigencia.

- Una **apertura** es un dispositivo en una hora: si un invitado recarga quince
  veces seguidas, cuenta una. Así el número significa algo.
- **Personas** es una aproximación por dispositivo: una pareja que abre la
  invitación desde el mismo celular cuenta como una.
- Se cuenta **desde el navegador**, no al servir la página, para que los
  rastreadores y las vistas previas de WhatsApp —que piden el HTML pero no
  ejecutan JavaScript— no inflen el número.
- Los **borradores no cuentan**: las pruebas del equipo no ensucian el dato.

**Privacidad:** no se guarda ninguna IP, ni cookies, ni identificadores que
sigan a una persona entre invitaciones. Solo se guarda un hash irreversible de
(id de la invitación + IP + navegador). Como el id de la invitación no es
público —lo que se comparte es el slug—, la misma persona produce huellas
distintas en invitaciones distintas y no se la puede seguir de una a otra.

### Fotos ligeras

Los clientes suben las fotos tal como salen del celular (3-6 MB cada una). Al
subirlas, el sistema genera automáticamente dos versiones en WebP:

| Versión | Tamaño | Dónde se usa |
|---|---|---|
| Original | tal cual | Descarga del equipo de diseño (nunca se toca) |
| `web` | lado mayor 1600 px | Portada y visor a pantalla completa |
| `min` | lado mayor 600 px | Cuadrícula de la galería y vistas previas |

Los derivados viven en `<pedido>/derivados/` dentro del mismo bucket, así que no
aparecen en el listado del cliente ni cuentan para el límite de fotos del plan.
Se respeta la orientación EXIF (las fotos verticales no salen acostadas) y las
imágenes pequeñas no se agrandan.

Si la conversión falla (un formato que el servidor no sabe leer), la foto se
guarda igual y se sirve desde el original: la subida del cliente nunca se rompe.

**Fotos subidas antes de esta mejora:** siguen funcionando desde el original, pero
no se benefician. Para procesarlas una sola vez:

```bash
node --experimental-strip-types --env-file=.env.local scripts/generar-derivados.mts
```

Es seguro repetirlo: salta las que ya están hechas y nunca modifica el original.
Requiere Node 22.6 o superior.

### El sistema de diseño

Las invitaciones no salen de una sola plantilla con colores intercambiables:
hay un catálogo real, visible en **Panel → Plantillas** (cada una se puede
abrir en vivo con datos de ejemplo, también sirve para enseñárselo al cliente).

| Pieza | Cuántas | Dónde se edita |
|---|---|---|
| Plantillas (estructura y ornamentos) | 10 | `src/config/plantillas.ts` + `src/components/invitacion/plantillas/` |
| Paletas de color | 24 | `src/config/diseno.ts` |
| Parejas tipográficas | 10 | `src/config/diseno.ts` |

**Las 10 plantillas:** Editorial Luxe (bodas de gala), Botánica (aire libre),
Moderna (minimalista), Art Déco (15 años y galas), Tropical Caribe (playa),
Arco (bodas modernas), Celestial (bodas de noche), Acuarela (baby showers y
bautizos), Cinema (lanzamientos y bodas de destino) y Boho Retro (fiestas al
aire libre). Cada una tiene su propia portada, sus propios ornamentos
vectoriales y su propio ritmo — no son variaciones de color.

**Detalles que elevan la experiencia:**

- **Sobre lacrado**: el invitado ve un sobre cerrado con el monograma y lo
  toca para abrirlo. Es el primer momento "wow".
- **Aparición al desplazar**: cada bloque entra con un fundido suave.
- **Textura de papel** y viñeta: le quitan el aspecto plano de pantalla.
- **Música de fondo** con botón flotante (sube el audio y pega el enlace).
- **Galería con visor** a pantalla completa, navegable con flechas.
- **Cuenta regresiva** en tres estilos según la plantilla.
- **Secciones opcionales**: historia, personas especiales (padrinos, corte de
  honor, ponentes), programa del día, mesa de regalos con botón de copiar,
  avisos para invitados, RSVP por WhatsApp, hashtag y mensaje de cierre.

Al generar la invitación, el sistema **elige plantilla, paleta y tipografía**
según el estilo que el cliente pidió en su formulario; el equipo lo ajusta
todo desde el editor.

### "Lo que pidió el cliente" (notas del equipo)

Hay respuestas del formulario que el sistema no puede convertir solo en
invitación: el ambiente musical (el audio lo sube el equipo), las referencias de
diseño del plan Luxury, el recordatorio que se enviará días antes, el dominio
deseado. Todas quedan recogidas en un panel **"Lo que pidió el cliente"** arriba
del editor de la invitación.

Ese panel **nunca se publica**: va en el campo `notasEquipo`, separado de las
`notas` que sí ven los invitados (parqueo, niños, acceso con QR…). Así activar
la sección de avisos para invitados no publica por error una instrucción interna.

**Para añadir una plantilla nueva:** duplica un archivo de
`src/components/invitacion/plantillas/`, regístralo en
`src/config/plantillas.ts` y añádelo al `switch` de
`src/components/invitacion/Renderizador.tsx`.

## 8. Seguridad

- Las tablas tienen **RLS activado**: solo usuarios autenticados (el equipo) pueden leerlas/escribirlas.
- El formulario público **nunca toca Supabase directamente**: pasa por rutas API del servidor que validan el token único del pedido y usan la `service_role` key solo en el backend.
- El bucket de fotos es **privado**; las vistas y descargas usan URLs firmadas temporales.
