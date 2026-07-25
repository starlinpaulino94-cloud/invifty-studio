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
3. Verifica en **Table Editor** que existen las tablas `clientes`, `pedidos`, `pagos` y `formularios`, y en **Storage** que existe el bucket `fotos-pedidos`.

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

**Nota sobre vigencias:** este sistema está configurado con 3 meses para Esencial/Popular/Premium y 12 para Luxury (instrucción interna). La página pública anuncia 3/6/9/12 — cuando definan la política final, ajusta `VIGENCIA_MESES` en `src/lib/planes.ts`.

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
que llega por WhatsApp directo al anfitrión.

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

**Para añadir una plantilla nueva:** duplica un archivo de
`src/components/invitacion/plantillas/`, regístralo en
`src/config/plantillas.ts` y añádelo al `switch` de
`src/components/invitacion/Renderizador.tsx`.

## 8. Seguridad

- Las tablas tienen **RLS activado**: solo usuarios autenticados (el equipo) pueden leerlas/escribirlas.
- El formulario público **nunca toca Supabase directamente**: pasa por rutas API del servidor que validan el token único del pedido y usan la `service_role` key solo en el backend.
- El bucket de fotos es **privado**; las vistas y descargas usan URLs firmadas temporales.
