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
   - **¿Instalación que ya existía?** Ejecuta las migraciones de [`supabase/migrations/`](./supabase/migrations)
     que te falten, **en orden de nombre** (empiezan por su fecha). Cada una dice arriba
     qué agrega y todas son repetibles: correr una que ya corriste no daña nada.
     El detalle de cada una y cómo comprobar el resultado está en [`docs/migraciones.md`](./docs/migraciones.md).
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

### Tareas de mantenimiento

Están en **Panel → Mantenimiento** como botones, que es la vía normal. Los
mismos trabajos existen como comandos de terminal, con la misma lógica
compartida en `src/lib/`; se ejecutan dentro de la carpeta del proyecto y con
el `.env.local` puesto. No son SQL: no se pegan en Supabase.

```bash
npm run fotos:ligeras          # versiones ligeras de fotos ya subidas
npm run vencimientos:simular   # qué pasaría al recalcular vigencias
npm run vencimientos:aplicar   # aplicarlo de verdad
```

Cada una está explicada en su sección más abajo.

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

Desde **Panel → Mantenimiento**: "Ver qué cambiaría" enseña la tabla y
"Aplicar" la guarda. O desde la terminal, que hace exactamente lo mismo:

```bash
# Ver qué cambiaría, sin tocar nada
npm run vencimientos:simular

# Si el listado convence, aplicarlo
npm run vencimientos:aplicar
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

### La dirección de la invitación

Cada invitación vive en `tu-dominio/i/<slug>`. El slug sale del título, y a las
**nuevas** se les añade un sufijo corto al azar:

```
camila-y-lucas-v73nd
```

**Por qué.** Sin él, la dirección se adivina probando: `boda-maria-y-jose` no
cuesta nada de acertar, y quien acierte ve la dirección del evento, la fecha, las
fotos privadas y el WhatsApp del anfitrión. La página lleva `noindex`, así que no
sale en Google — pero eso no protege de quien prueba a mano.

Son cinco caracteres sin vocales ni `0/o/1/l/i`: unos 17 millones de
combinaciones por título, se dicta por teléfono sin equivocarse, y sin vocales no
puede salir una palabra desafortunada pegada al nombre de los novios. Se sortea
con el generador criptográfico del sistema, no con `Math.random`.

**Las invitaciones que ya estaban publicadas no se tocan.** Su enlace ya está
repartido entre los invitados y cambiarlo lo rompería. El editor las señala en
ámbar y ofrece un botón **"Añadir sufijo al azar"** por si a alguna hace falta
protegerla — con el aviso de que, si ya está publicada, el enlace viejo deja de
funcionar. La decisión es del equipo, nada se cambia solo.

Guardar una invitación **nunca** cambia su dirección: el editor guarda con
`slugificar`, que solo limpia el texto. El sufijo lo pone `slugConSufijo`, y eso
solo pasa al generar la invitación o al pulsar ese botón.

### La vista previa en vivo del editor

El editor tiene la invitación real al lado, dibujada con lo que hay escrito en
ese momento. Cuatro botones encima del marco:

| Botón | Qué hace |
|---|---|
| Celular / Computadora | Cambia el marco. |
| Señalar | Tocar una parte de la invitación desplaza el editor a la tarjeta que la controla. |
| Editar | Escribe los textos **encima del diseño**, ahí mismo. |
| Reiniciar | Vuelve a ver la apertura del sobre. |

**Modo editar.** Los textos que se pueden cambiar aparecen con un subrayado
tenue. El cambio se guarda al salir del campo (no en cada tecla, o el cursor
saltaría al principio en cada letra), Escape deshace, y lo que se pegue entra
como texto plano. Mientras está encendido la invitación no responde a los clics
y el marco pasa a celular a tamaño real.

Se edita encima **lo que se guarda tal cual**: título, subtítulo, frase,
historia, nombre de cada lugar, actividades del programa, personas especiales,
regalos, avisos y mensaje de cierre. Lo que el sistema arma solo —la hora en
formato de 12, la fecha larga, la etiqueta del código de vestimenta— se sigue
editando en su tarjeta, porque escribir encima no tendría dónde guardarse.

Escribir encima **no guarda en la base de datos**: llena el formulario, igual
que escribir en la tarjeta. Hay que darle a **Guardar cambios**.

Para el código: el componente `Texto` (`src/components/invitacion/base/Texto.tsx`)
envuelve el texto y lleva su ruta dentro de los datos. En la invitación
publicada **no dibuja nada** — devuelve lo que envuelve. Los textos del cuerpo
se marcan una sola vez en `Secciones.tsx`; en una plantilla nueva solo hay que
marcar el título y el subtítulo de la portada, y una prueba avisa si se olvida.

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

### Invitaciones con código propio (por ejemplo hechas con IA)

Si una invitación se diseña fuera del sistema, en el editor se elige la opción
**"Código propio"** y se pega el HTML. A partir de ahí se administra igual que
las demás: misma dirección `tu-dominio/i/<slug>`, misma vista previa al
compartir por WhatsApp, mismo contador de visitas, mismo borrador/publicada y
mismo vencimiento.

**Marcadores.** Para no tener que pegar a mano las direcciones de las fotos
—que además caducan—, el código puede llevar estos marcadores y el sistema pone
el dato real al mostrarla:

| Marcador | Se reemplaza por |
|---|---|
| `{{PORTADA}}` | Dirección de la foto de portada |
| `{{FOTO_1}}`, `{{FOTO_2}}`… | Las fotos del cliente, en el orden del editor |
| `{{TITULO}}` | Título de la invitación |
| `{{FECHA}}` | Fecha del evento, en palabras |

**Seguridad: por qué va aislado.** Ese HTML lo escribe una herramienta externa y
puede traer JavaScript. Servido tal cual compartiría origen con `/panel`, así que
un script podría leer la sesión del equipo. Por eso se muestra dentro de un
iframe con `sandbox` **sin** `allow-same-origin`: el navegador le asigna un
origen opaco y desde ahí no puede tocar cookies, ni almacenamiento, ni la página
que lo contiene. Puede pintar y animar lo que quiera, y nada más.

Como consecuencia, el código **no puede usar rutas relativas** (`/foto.jpg`,
`./estilo.css`): las direcciones tienen que ir completas, o usar los marcadores.
El editor avisa de esto y de otros descuidos habituales antes de publicar.

**Confirmaciones.** Para que las confirmaciones lleguen al panel como las de
cualquier otra invitación, basta un formulario normal marcado con
`data-invifty-rsvp` y campos llamados `nombre`, `asiste`, `cantidad` y `nota`:

```html
<form data-invifty-rsvp>
  <input name="nombre" required>
  <select name="asiste">
    <option value="si">Sí asistiré</option>
    <option value="no">No podré ir</option>
  </select>
  <input name="cantidad" type="number" value="1">
  <textarea name="nota"></textarea>
  <button>Confirmar</button>
  <p data-invifty-mensaje></p>
</form>
```

No hace falta escribir JavaScript: el sistema inyecta el puente. El aviso al
invitado aparece dentro del elemento con `data-invifty-mensaje`. Para flujos
propios existe `invifty.confirmar({…})`, que devuelve una promesa.

> El título y la fecha de la tarjeta **Portada** se siguen usando aunque el
> diseño venga del código: de ahí salen la vista previa al compartir y la
> dirección web.

### Video de portada (lo que promete el plan Luxury)

El plan Luxury dice que el video del cliente "se verá en bucle en la portada".
El video se subía y se guardaba, pero **ninguna plantilla sabía dibujarlo**: se
quedaba en el bucket ocupando 50 MB sin que nadie lo viera. Ahora, si el cliente
subió un video, va de portada por delante de las fotos, en las doce plantillas.

- **En bucle, mudo y sin controles.** Mudo no es opcional: ningún navegador deja
  que un video con sonido arranque solo. La música de la invitación es aparte,
  con su botón.
- **La primera foto hace de respaldo**: es lo que se ve mientras el video carga.
- Quien tenga activado **"reducir movimiento"** en su teléfono ve esa foto fija
  en vez del bucle. Suele estar activado por mareos o migrañas.
- **No entra en la galería**: ahí abriría el visor de fotos con un archivo que
  no es una foto.
- Se apaga desde el editor, en **Experiencia de apertura → Video en la portada**.
  El interruptor solo aparece si hay video.

Se admite **un solo video** por pedido. El tope se anunciaba en un comentario y
no se aplicaba en ningún sitio; ahora la subida lo rechaza con un mensaje claro.

Para el código: las plantillas piden su portada a `MedioPortada`
(`src/components/invitacion/base/MedioPortada.tsx`) en vez de escribir un
`<img>`, así que da igual si el cliente puso foto o video y una plantilla nueva
lo hereda sin enterarse.

### Dominio propio del cliente (extra de RD$ 1,500)

El catálogo vende "Dominio Web Propio" y el formulario pregunta cuál quiere el
cliente. No había nada detrás: todas las invitaciones vivían en `/i/<slug>` y el
extra solo podía cumplirse a mano, si alguien se acordaba.

Ahora el dominio es un dato de la invitación. En el editor, tarjeta **Portada**,
campo **"Dominio propio del cliente"**. Da igual cómo lo escribas —
`https://www.BodaCamila.com/` y `bodacamila.com` se guardan igual.

**Faltan dos pasos que el código no puede dar** (ninguna plataforma deja que una
aplicación reclame dominios por su cuenta):

1. En **Vercel** → el proyecto → **Domains** → añadir el dominio.
2. Apuntar el **DNS** del dominio a donde Vercel indique.

Hecho eso, el dominio abre la invitación sin tocar nada más.

| | |
|---|---|
| Qué se sirve en ese dominio | Solo esa invitación. `midominio.com/panel` también la muestra: ahí no hay panel. |
| Borradores | 404. En el dominio del cliente no hay sesión del equipo. |
| La API | Responde igual en el dominio del cliente — de ahí salen sus confirmaciones y su conteo de visitas. |
| La dirección de siempre | Sigue funcionando. Tener dominio no apaga `/i/<slug>`. |
| Al publicar | La URL que se guarda en la ficha del pedido pasa a ser la del dominio. |

Dos invitaciones no pueden compartir dominio: la petición llega por el `Host` y
no habría forma de saber cuál servir. La base de datos lo impide y el editor lo
dice con un mensaje en vez de un error.

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

Desde **Panel → Mantenimiento**, con el botón "Revisar fotos", o desde la
terminal:

```bash
npm run fotos:ligeras
```

Es seguro repetirlo: salta las que ya están hechas y nunca modifica el original.
Requiere Node 22.6 o superior.

### El sistema de diseño

Las invitaciones no salen de una sola plantilla con colores intercambiables:
hay un catálogo real, visible en **Panel → Plantillas** (cada una se puede
abrir en vivo con datos de ejemplo, también sirve para enseñárselo al cliente).

| Pieza | Cuántas | Dónde se edita |
|---|---|---|
| Plantillas (estructura y ornamentos) | 12 | `src/config/plantillas.ts` + `src/components/invitacion/plantillas/` |
| Paletas de color | 24 | `src/config/diseno.ts` |
| Parejas tipográficas | 10 | `src/config/diseno.ts` |

**Las 12 plantillas:** Editorial Luxe (bodas de gala), Botánica (aire libre),
Moderna (minimalista), Art Déco (15 años y galas), Tropical Caribe (playa),
Arco (bodas modernas), Celestial (bodas de noche), Acuarela (baby showers y
bautizos), Cinema (lanzamientos y bodas de destino) Boho Retro (fiestas al
aire libre), Jardín Encantado (bodas al aire libre y 15 años románticos) y
Barroco (galas y 15 años de etiqueta). Cada una tiene su propia portada, sus
propios ornamentos vectoriales y su propio ritmo — no son variaciones de color.

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

- Las tablas tienen **RLS activado** y solo dejan pasar a quien esté en la lista
  `equipo` (ver más abajo: *tener sesión no es ser del equipo*).
- El formulario público **nunca toca Supabase directamente**: pasa por rutas API del servidor que validan el token único del pedido y usan la `service_role` key solo en el backend.
- El bucket de fotos es **privado**; las vistas y descargas usan URLs firmadas temporales.
- **Nunca subas un `.env`.** `.gitignore` tiene el patrón, pero *no desrastrea lo que
  ya está rastreado*: por eso `.env.local` llegó a subirse con la clave secreta
  dentro y siguió ahí commit tras commit. Hay una prueba que falla si vuelve a
  pasar (`pruebas/configuracion.prueba.ts`).

### Tener sesión no es ser del equipo

Este fue el agujero más grande que tuvo el sistema, y no se notaba porque todo
funcionaba bien con él puesto.

Las políticas de la base decían `for all to authenticated using (true)`. Eso
suena a "solo el equipo" y no lo es: **`authenticated` es cualquiera con una
sesión en nuestro proyecto de Supabase**. Y la clave anon viaja en el navegador
—está en el código de cualquier página—, así que cualquiera podía leerla, llamar
a `supabase.auth.signUp()` y quedar autenticado. A partir de ahí no necesitaba ni
el panel ni el login: hablando directo con la API de Supabase leía la tabla de
clientes entera, con nombres, teléfonos, pedidos y pagos.

Por eso el arreglo va en la base de datos y no en el proxy de Next: **un guardia
en `/panel` no protege nada si el atacante nunca pasa por `/panel`**.

Ahora hay una lista blanca, la tabla `equipo`. Estar autenticado no basta: hay
que estar además en esa lista, y las políticas lo comprueban con
`public.es_del_equipo()`. Quien se registre por su cuenta queda autenticado y sin
acceso a un solo dato.

**Para ponerlo al día** (una vez, en Supabase → SQL Editor):

1. Corre `supabase/migrations/20260726135300_cerrar-acceso-equipo.sql`. Se siembra sola con los
   usuarios que ya existen, así que quien hoy entra al panel sigue entrando
   igual. Las tres filas de comprobación del final tienen que decir OK.
2. **Apaga el registro público**: Supabase → *Authentication* → *Sign In / Up* →
   *Email* → desactiva **Allow new users to sign up**. La lista blanca ya
   protege los datos; esto además evita que se acumulen cuentas fantasma.
3. Comprueba que puedes entrar al panel. Si se ve el aviso *"Esta cuenta no
   tiene acceso al panel"*, es que tu usuario no quedó en la lista:

   ```sql
   insert into public.equipo (usuario_id, email)
   select id, email from auth.users where email = 'tu-correo@ejemplo.com';
   ```

**Para dar de alta a alguien nuevo del equipo**: créale el usuario en
*Authentication* → *Users* y añádelo a la lista con ese mismo `insert`. Nadie
puede añadirse a sí mismo: sobre `equipo` solo hay política de lectura.

El orden de despliegue no importa. Si el código llega antes que la migración, el
panel sigue funcionando como hasta ahora (ver `src/lib/equipo.ts`, que explica
por qué cede cuando la tabla no existe todavía).

### Cabeceras de seguridad y el CSP que no se puede poner

`next.config.ts` pone `X-Content-Type-Options`, `Referrer-Policy`,
`Permissions-Policy` y `Strict-Transport-Security` en todo, y `X-Frame-Options:
DENY` más `Cache-Control: no-store` en `/panel`, `/login` y `/api`.

**Lo que NO lleva es un CSP que limite scripts, y es a propósito.** Las
invitaciones de código propio son HTML de terceros que se muestra en un iframe
con `srcDoc`. Un documento srcdoc no hace petición de red: hereda el CSP de la
página que lo contiene. Un `script-src 'self'` dejaría sin JavaScript, sin
tipografías y sin imágenes externas al diseño del cliente — invitaciones ya
pagadas y repartidas. Y no valdría ponerlo solo en el panel, porque el editor
enseña esa misma vista previa en vivo.

Ese HTML no se aísla con el CSP, se aísla con el iframe: `sandbox` sin
`allow-same-origin`, o sea con origen opaco y sin acceso a la sesión del equipo
(ver `src/lib/codigo.ts`). Contra el clickjacking del panel se usa
`X-Frame-Options`, que es cabecera de respuesta y no lo hereda ningún srcdoc.

Hay pruebas que vigilan las dos direcciones en `pruebas/seguridad.prueba.ts`:
que las cabeceras estén, y que a nadie se le ocurra añadir el `script-src`.

### Freno de peticiones en las rutas públicas

Tres rutas abiertas llevan límite por ventana (`src/lib/limite.ts`): confirmar
asistencia (20 cada 10 min por IP), guardar el formulario (300 cada 10 min por
token) y subir fotos (120 cada 15 min por token, comprobado **antes** de leer el
archivo, que puede pesar 50 MB). Al pasarse responden `429` con `Retry-After`.

El contador vive en la memoria del proceso, así que en Vercel cada instancia
lleva el suyo: frena el bucle casero, que es lo que de verdad pasa, no un ataque
repartido entre muchas máquinas. Si algún día hiciera falta más, lo único que
habría que cambiar es esa función.

El contador de visitas queda **sin freno a propósito**: en el salón del evento
cien invitados abren la invitación desde el mismo wifi, o sea desde la misma IP,
y frenarlos dejaría sin contar justo el día que importa. Ahí el abuso lo corta el
índice único `(invitacion_id, huella, hora)`, que solo admite una fila por
dispositivo y hora.

### Rotar la clave secreta de Supabase

La clave secreta (`SUPABASE_SECRET_KEY`, antes `service_role`) **se salta el RLS
por completo**: quien la tenga lee y escribe los datos de todos los clientes. Si
alguna vez estuvo en el repositorio, en un chat o en una captura, hay que
cambiarla — sacarla del repositorio no basta, porque el historial la conserva.

**El orden importa.** Primero se crea la nueva y se despliega; solo después se
revoca la vieja. Al revés, el sistema se queda sin acceso hasta el despliegue.

1. **Supabase** → tu proyecto → *Project Settings* → *API Keys* → sección
   *Secret keys* → **Create new secret key**. Cópiala; solo se ve una vez.
2. **Vercel** → el proyecto → *Settings* → *Environment Variables* → edita
   `SUPABASE_SECRET_KEY` y pega la nueva. (Si también tienes
   `SUPABASE_SERVICE_ROLE_KEY`, cámbiala o bórrala: el código acepta las dos y
   usa la primera que encuentre.)
3. **Redespliega.** Las variables de entorno se leen al construir: sin
   redesplegar, Vercel sigue usando la vieja. *Deployments* → el último → *Redeploy*.
4. **Comprueba que todo sigue vivo** antes de romper nada: abre el panel, entra a
   un pedido con fotos y ábrelas. Si cargan, la clave nueva funciona.
5. **Ahora sí, revoca la vieja** en la misma pantalla de Supabase.
6. **Tu `.env.local`**: pega la clave nueva ahí también, o los comandos de
   terminal (`npm run fotos:ligeras`, `npm run vencimientos:*`) dejarán de entrar.

**¿Y borrar la clave del historial de git?** Rotarla ya deja la vieja sin valor,
que es lo que de verdad arregla el problema. Reescribir el historial
(`git filter-repo`, BFG) es opcional: rompe todos los clones existentes y hay
copias en caché que no siempre desaparecen. Si el repositorio es privado y la
clave ya está rotada, no hace falta.
