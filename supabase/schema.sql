-- ============================================================
-- INVIFTY STUDIO — Esquema de base de datos (Supabase / Postgres)
-- Ejecutar completo en: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- ---------- CLIENTES ----------
create table public.clientes (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  telefono    text not null,            -- WhatsApp, ej: 18092693214
  email       text,
  como_nos_conocio text,                -- instagram / referido / google / otro
  creado_en   timestamptz not null default now()
);

create unique index clientes_telefono_idx on public.clientes (telefono);

-- ---------- PEDIDOS ----------
create table public.pedidos (
  id            uuid primary key default gen_random_uuid(),
  cliente_id    uuid not null references public.clientes(id) on delete cascade,
  tipo_evento   text not null check (tipo_evento in ('boda','cumpleanos','empresarial','otro')),
  plan          text not null check (plan in ('esencial','popular','premium','luxury')),
  extras        text[] not null default '{}',   -- ej: {bilingue, dominio_propio, galeria_post_evento, urgente_24h}
  fecha_evento  date,
  estado        text not null default 'nuevo' check (estado in (
                  'nuevo','formulario_enviado','formulario_completado',
                  'en_diseno','revision_cliente','entregada','activa','vencida')),
  precio        numeric(10,2) not null default 0,   -- precio acordado (DOP)
  url_entregada text,                                -- URL de la invitación publicada
  fecha_entrega date,                                -- cuándo se entregó (base del vencimiento)
  fecha_vencimiento date,                            -- calculada al entregar según el plan
  aviso_vencimiento_en timestamptz,                  -- cuándo se avisó al equipo de que vence
  notas         text,
  creado_en     timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index pedidos_cliente_idx on public.pedidos (cliente_id);
create index pedidos_estado_idx  on public.pedidos (estado);
-- El repaso diario de vencimientos solo mira las que tienen fecha.
create index pedidos_vencimiento_idx on public.pedidos (fecha_vencimiento)
  where fecha_vencimiento is not null;

-- ---------- PAGOS (abonos) ----------
-- El "monto abonado" del pedido es la suma de sus pagos; así queda
-- historial de cada abono con fecha y método.
create table public.pagos (
  id         uuid primary key default gen_random_uuid(),
  pedido_id  uuid not null references public.pedidos(id) on delete cascade,
  monto      numeric(10,2) not null,
  metodo     text,                     -- transferencia / efectivo / zelle / paypal / tarjeta
  nota       text,
  fecha      timestamptz not null default now()
);

create index pagos_pedido_idx on public.pagos (pedido_id);

-- ---------- FORMULARIOS ----------
create table public.formularios (
  id              uuid primary key default gen_random_uuid(),
  pedido_id       uuid not null references public.pedidos(id) on delete cascade,
  token           text not null unique,        -- link público: /f/<token>
  estado          text not null default 'pendiente'
                  check (estado in ('pendiente','en_progreso','completado')),
  respuestas      jsonb not null default '{}'::jsonb,
  fecha_completado timestamptz,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now()
);

create index formularios_pedido_idx on public.formularios (pedido_id);

-- ---------- Trigger de actualizado_en ----------
create or replace function public.tocar_actualizado_en()
returns trigger language plpgsql as $$
begin
  new.actualizado_en = now();
  return new;
end $$;

create trigger pedidos_tocar before update on public.pedidos
  for each row execute function public.tocar_actualizado_en();
create trigger formularios_tocar before update on public.formularios
  for each row execute function public.tocar_actualizado_en();

-- ---------- Seguridad (RLS) ----------
-- El formulario público NUNCA toca la base de datos directamente:
-- pasa por las rutas API del servidor, que usan la service_role key.
--
-- OJO con "authenticated": no quiere decir "del equipo Invifty", quiere
-- decir "cualquiera con una sesión en este proyecto de Supabase". La clave
-- anon viaja en el navegador, así que cualquiera puede registrarse y quedar
-- autenticado. Por eso las políticas piden además estar en la lista blanca
-- `equipo` — ver migrations/20260726135300_cerrar-acceso-equipo.sql.
create table if not exists public.equipo (
  usuario_id  uuid primary key references auth.users(id) on delete cascade,
  email       text,
  creado_en   timestamptz not null default now()
);

alter table public.equipo enable row level security;

create policy "cada uno se ve a si mismo" on public.equipo
  for select to authenticated using (usuario_id = (select auth.uid()));

-- `security definer` para poder leer `equipo` sin que su propia RLS lo
-- impida; `search_path` fijo para que nadie cuele otra tabla `equipo`.
create or replace function public.es_del_equipo()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.equipo where usuario_id = auth.uid());
$$;

revoke all on function public.es_del_equipo() from public, anon;
grant execute on function public.es_del_equipo() to authenticated;

alter table public.clientes     enable row level security;
alter table public.pedidos      enable row level security;
alter table public.pagos        enable row level security;
alter table public.formularios  enable row level security;

create policy "equipo acceso total clientes" on public.clientes
  for all to authenticated
  using (public.es_del_equipo()) with check (public.es_del_equipo());
create policy "equipo acceso total pedidos" on public.pedidos
  for all to authenticated
  using (public.es_del_equipo()) with check (public.es_del_equipo());
create policy "equipo acceso total pagos" on public.pagos
  for all to authenticated
  using (public.es_del_equipo()) with check (public.es_del_equipo());
create policy "equipo acceso total formularios" on public.formularios
  for all to authenticated
  using (public.es_del_equipo()) with check (public.es_del_equipo());

-- INSTALACIÓN NUEVA: crea tu usuario en Authentication → Users y añádelo
-- aquí, o el panel se verá vacío:
--   insert into public.equipo (usuario_id, email)
--   select id, email from auth.users;

-- ---------- Storage (fotos de los clientes) ----------
-- Bucket privado; las subidas y descargas pasan por el servidor.
insert into storage.buckets (id, name, public)
values ('fotos-pedidos', 'fotos-pedidos', false)
on conflict (id) do nothing;

create policy "equipo lee fotos" on storage.objects
  for select to authenticated
  using (bucket_id = 'fotos-pedidos' and public.es_del_equipo());
create table public.invitaciones (
  id            uuid primary key default gen_random_uuid(),
  pedido_id     uuid not null references public.pedidos(id) on delete cascade,
  slug          text not null unique,          -- URL pública: /i/<slug>
  plantilla     text not null default 'clasica',
  datos         jsonb not null default '{}'::jsonb,  -- contenido editable de la invitación
  -- HTML de una invitación hecha fuera del sistema (por ejemplo con IA).
  -- Se usa cuando `plantilla` vale 'codigo'.
  codigo_html   text,
  -- Dominio propio del cliente (extra del catálogo), sin protocolo ni www.
  -- El DNS y el alta en Vercel se hacen aparte; esto es de quién es.
  dominio       text,
  -- Enlace secreto del panel del anfitrión: /lista/<token_lista>.
  -- Como el token del formulario: sin cuenta, largo e imposible de adivinar.
  token_lista   text unique,
  estado        text not null default 'borrador' check (estado in ('borrador','publicada')),
  publicada_en  timestamptz,
  creado_en     timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index invitaciones_pedido_idx on public.invitaciones (pedido_id);

-- Dos invitaciones no pueden compartir dominio: la petición llega por el
-- Host y no habría forma de saber cuál servir.
create unique index invitaciones_dominio_unico
  on public.invitaciones (lower(dominio))
  where dominio is not null;

create trigger invitaciones_tocar before update on public.invitaciones
  for each row execute function public.tocar_actualizado_en();

alter table public.invitaciones enable row level security;

create policy "equipo acceso total invitaciones" on public.invitaciones
  for all to authenticated
  using (public.es_del_equipo()) with check (public.es_del_equipo());
-- El público NO accede a la tabla: la página /i/<slug> se sirve desde el
-- servidor con la clave secreta y solo muestra invitaciones publicadas.

-- ---------- CONFIRMACIONES DE ASISTENCIA (RSVP) ----------
-- La confirmación del invitado queda guardada aquí, además de abrirse en
-- WhatsApp: así el anfitrión tiene una lista real con su conteo.
create table public.confirmaciones (
  id            uuid primary key default gen_random_uuid(),
  invitacion_id uuid not null references public.invitaciones(id) on delete cascade,
  nombre        text not null,
  -- Nombre en minúsculas y sin espacios sobrantes: sirve para reconocer
  -- que un invitado está corrigiendo su respuesta en vez de duplicarla.
  nombre_normalizado text not null,
  asiste        boolean not null,
  -- Personas que asistirán en total, incluyendo al invitado.
  -- 0 cuando la respuesta es "no podré ir", para poder sumar la columna.
  cantidad      integer not null default 1 check (cantidad >= 0 and cantidad <= 20),
  nota          text,
  creado_en     timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index confirmaciones_invitacion_idx
  on public.confirmaciones (invitacion_id, creado_en desc);

-- Una fila por invitado: si vuelve a confirmar, se actualiza su respuesta.
create unique index confirmaciones_invitado_idx
  on public.confirmaciones (invitacion_id, nombre_normalizado);

create trigger confirmaciones_tocar before update on public.confirmaciones
  for each row execute function public.tocar_actualizado_en();

-- ---------- INVITADOS (a quién invitó el anfitrión) ----------
-- Opcional, y lo carga el propio anfitrión desde su panel /lista/<token>.
-- Sin esta lista no se puede responder "¿quién NO ha confirmado?": el
-- sistema solo conoce a quien contesta, y el que nunca abre la invitación
-- no deja rastro. Ver lib/lista.ts.
create table public.invitados (
  id                 uuid primary key default gen_random_uuid(),
  invitacion_id      uuid not null references public.invitaciones(id) on delete cascade,
  nombre             text not null,
  -- Lo calcula el servidor con lib/nombres.ts, el mismo código que usa el
  -- RSVP: si cada uno normalizara a su manera, el cruce fallaría.
  nombre_normalizado text not null,
  creado_en          timestamptz not null default now()
);

-- El mismo nombre dos veces en la misma boda es un error de dedo, no dos
-- personas: así pegar la lista dos veces no la duplica.
create unique index invitados_unicos_idx
  on public.invitados (invitacion_id, nombre_normalizado);
create index invitados_invitacion_idx on public.invitados (invitacion_id);

alter table public.invitados enable row level security;

create policy "equipo acceso total invitados" on public.invitados
  for all to authenticated
  using (public.es_del_equipo()) with check (public.es_del_equipo());

-- ---------- LEADS (interesados que llegan desde la web pública) ----------
-- Entran por POST /api/public/leads con estado, atribución (fuente/UTM) e
-- idempotencia: el doble clic del visitante no crea dos leads. El equipo
-- los trabaja en /panel/leads y al convertirlos queda el rastro.
create table public.leads (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null,
  telefono      text not null,               -- normalizado a dígitos (18091234567)
  tipo_evento   text not null,
  fecha_evento  date,
  plan_id       text,
  demo_slug     text,
  mensaje       text,
  idioma        text not null default 'es',
  fuente        text not null,
  utm           jsonb not null default '{}'::jsonb,
  consentimiento boolean not null default false,
  clave_idempotencia text not null,
  estado        text not null default 'nuevo' check (estado in
                  ('nuevo','contactado','calificado','convertido','perdido')),
  cliente_id    uuid references public.clientes(id) on delete set null,
  convertido_en timestamptz,
  convertido_por uuid,
  creado_en     timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create unique index leads_idempotencia_idx on public.leads (clave_idempotencia);
create index leads_estado_idx on public.leads (estado, creado_en desc);
create index leads_telefono_idx on public.leads (telefono);

create trigger leads_tocar before update on public.leads
  for each row execute function public.tocar_actualizado_en();

alter table public.leads enable row level security;

create policy "equipo acceso total leads" on public.leads
  for all to authenticated
  using (public.es_del_equipo()) with check (public.es_del_equipo());

-- ---------- DEMOS (invitaciones que la web enseña de muestra) ----------
-- La web pregunta por GET /api/public/demos; los datos visibles salen de
-- la invitación real (título, plantilla, slug), aquí solo va la marca.
create table public.demos (
  id            uuid primary key default gen_random_uuid(),
  invitacion_id uuid not null unique references public.invitaciones(id) on delete cascade,
  tipo_evento   text not null default 'boda',
  plan_minimo   text not null default 'esencial',
  orden         integer not null default 0,
  destacada     boolean not null default false,
  activa        boolean not null default true,
  idioma        text not null default 'es',
  creado_en     timestamptz not null default now()
);

create index demos_activas_idx on public.demos (activa, orden);

alter table public.demos enable row level security;

create policy "equipo acceso total demos" on public.demos
  for all to authenticated
  using (public.es_del_equipo()) with check (public.es_del_equipo());

alter table public.confirmaciones enable row level security;

create policy "equipo acceso total confirmaciones" on public.confirmaciones
  for all to authenticated
  using (public.es_del_equipo()) with check (public.es_del_equipo());
-- Los invitados NO tocan la tabla: confirman por la ruta
-- /api/invitacion/<slug>/rsvp, que valida en el servidor que la
-- invitación existe y está publicada antes de guardar nada.

-- ---------- VISITAS A LAS INVITACIONES ----------
-- Para poder decirle al cliente cuántas veces se abrió su invitación.
-- PRIVACIDAD: no se guarda ninguna IP ni cookie, solo un hash
-- irreversible que además cambia de una invitación a otra.
create table public.visitas (
  id            uuid primary key default gen_random_uuid(),
  invitacion_id uuid not null references public.invitaciones(id) on delete cascade,
  huella        text not null,
  -- Hora redondeada hacia abajo: una fila por dispositivo y hora, para que
  -- recargar la página no infle el conteo.
  hora          timestamptz not null,
  creado_en     timestamptz not null default now()
);

create unique index visitas_unicas_idx
  on public.visitas (invitacion_id, huella, hora);

create index visitas_invitacion_idx
  on public.visitas (invitacion_id, creado_en desc);

alter table public.visitas enable row level security;

create policy "equipo acceso total visitas" on public.visitas
  for all to authenticated
  using (public.es_del_equipo()) with check (public.es_del_equipo());
-- Los invitados NO tocan la tabla: la visita se registra desde
-- /api/invitacion/<slug>/visita, en el servidor.
