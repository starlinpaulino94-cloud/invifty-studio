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
   - `NEXT_PUBLIC_APP_URL` → la URL final, ej. `https://invifty-studio.vercel.app` (o tu dominio `studio.invifty.com`)
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

## 6. Seguridad

- Las tablas tienen **RLS activado**: solo usuarios autenticados (el equipo) pueden leerlas/escribirlas.
- El formulario público **nunca toca Supabase directamente**: pasa por rutas API del servidor que validan el token único del pedido y usan la `service_role` key solo en el backend.
- El bucket de fotos es **privado**; las vistas y descargas usan URLs firmadas temporales.
