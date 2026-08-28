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
                  'en_diseno','revision_cliente','entregada','activa','vencida','cancelado')),
  precio        numeric(10,2) not null default 0,   -- precio acordado (DOP)
  url_entregada text,                                -- URL de la invitación publicada
  fecha_entrega date,                                -- cuándo se entregó (base del vencimiento)
  fecha_vencimiento date,                            -- calculada al entregar según el plan
  aviso_vencimiento_en timestamptz,                  -- cuándo se avisó al equipo de que vence
  -- Enlace de cobro del pedido (/pagar/<token>): opaco, lo genera el
  -- equipo desde la ficha y viaja por WhatsApp con el saldo.
  token_cobro   text unique,
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
  tipo       text not null default 'pago' check (tipo in ('pago','reembolso','ajuste')),
  -- Un pago confirmado no se borra: se anula con motivo y firma, y el
  -- balance lo ignora (lib/pagos.ts). Borrar dinero sin rastro, jamás.
  anulado_en timestamptz,
  anulado_por uuid,
  motivo_anulacion text,
  -- La transacción completa: referencia bancaria, cuándo ENTRÓ el dinero
  -- (vs. cuándo se anotó), quién la registró, idempotencia contra el
  -- doble clic y el comprobante en el bucket privado (comprobantes/).
  referencia text,
  fecha_efectiva date,
  usuario_id uuid,
  usuario_email text,
  clave_idempotencia text,
  comprobante_ruta text,
  fecha      timestamptz not null default now()
);

create index pagos_pedido_idx on public.pagos (pedido_id);
create unique index pagos_idempotencia_idx
  on public.pagos (clave_idempotencia)
  where clave_idempotencia is not null;

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
  -- Qué le toca a cada quien; la matriz vive en src/lib/roles.ts y se
  -- valida en servidor. El primer miembro debe ser 'propietario'.
  rol         text not null default 'admin'
              check (rol in ('propietario','admin','ventas','operaciones','disenador','lectura')),
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
  -- Cuando el cliente aprueba una versión, la invitación se bloquea contra
  -- ediciones accidentales; desbloquear es explícito y queda en auditoría.
  bloqueada_en  timestamptz,
  -- El interruptor de la galería colaborativa: el anfitrión la abre
  -- (normalmente el día del evento) y la cierra cuando quiera.
  galeria_abierta boolean not null default false,
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
  -- Respuestas a las preguntas extra del RSVP (menú, alergias…), con la
  -- forma { "<id>": "<respuesta>" }. Las preguntas las configura cada
  -- invitación en el editor; el servidor valida antes de guardar.
  respuestas    jsonb not null default '{}'::jsonb,
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

-- ---------- HISTORIAL DE ESTADOS Y AUDITORÍA (inmutables) ----------
-- Se puede leer y añadir, nunca corregir: un historial corregible no es
-- historial. El trigger lo hace explícito incluso saltándose políticas.
create table public.historial_estados (
  id             uuid primary key default gen_random_uuid(),
  entidad        text not null,            -- 'pedido' / 'invitacion' / 'lead'
  entidad_id     uuid not null,
  estado_anterior text,
  estado_nuevo   text not null,
  motivo         text,
  usuario_id     uuid,
  usuario_email  text,
  creado_en      timestamptz not null default now()
);

create index historial_entidad_idx
  on public.historial_estados (entidad, entidad_id, creado_en desc);

create table public.auditoria (
  id            uuid primary key default gen_random_uuid(),
  accion        text not null,             -- 'pago:registrar' / 'invitacion:publicar' …
  entidad       text not null,
  entidad_id    uuid,
  usuario_id    uuid,
  usuario_email text,
  -- Contexto NO sensible: montos, slugs, estados. Nunca datos de invitados.
  detalles      jsonb not null default '{}'::jsonb,
  creado_en     timestamptz not null default now()
);

create index auditoria_fecha_idx on public.auditoria (creado_en desc);
create index auditoria_entidad_idx on public.auditoria (entidad, entidad_id);

create or replace function public.historial_inmutable()
returns trigger language plpgsql as $$
begin
  raise exception 'El historial no se corrige: es un registro, no un borrador.';
end $$;

create trigger historial_no_se_toca
  before update or delete on public.historial_estados
  for each row execute function public.historial_inmutable();
create trigger auditoria_no_se_toca
  before update or delete on public.auditoria
  for each row execute function public.historial_inmutable();

alter table public.historial_estados enable row level security;
alter table public.auditoria enable row level security;

create policy "equipo lee historial" on public.historial_estados
  for select to authenticated using (public.es_del_equipo());
create policy "equipo escribe historial" on public.historial_estados
  for insert to authenticated with check (public.es_del_equipo());
create policy "equipo lee auditoria" on public.auditoria
  for select to authenticated using (public.es_del_equipo());
create policy "equipo escribe auditoria" on public.auditoria
  for insert to authenticated with check (public.es_del_equipo());

-- ---------- GENERACIONES DE IA ----------
-- Registro trazable de cada tanda de conceptos propuesta por un proveedor
-- (mock o Claude): quién pidió, qué salió, si validó y cuánto costó.
-- Sin cadenas de razonamiento ni claves. Ver src/lib/ia/.
create table public.generaciones (
  id             uuid primary key default gen_random_uuid(),
  invitacion_id  uuid references public.invitaciones(id) on delete set null,
  tipo           text not null default 'conceptos',
  proveedor      text not null,               -- mock / anthropic
  modelo         text not null,
  prompt_version text not null,
  hash_brief     text not null,
  intento        integer not null default 1,
  resultado      jsonb,
  valido         boolean not null default false,
  error          text,
  tokens_entrada integer not null default 0,
  tokens_salida  integer not null default 0,
  costo_usd      numeric(10,6) not null default 0,
  latencia_ms    integer not null default 0,
  usuario_id     uuid,
  usuario_email  text,
  creado_en      timestamptz not null default now()
);

create index generaciones_invitacion_idx
  on public.generaciones (invitacion_id, creado_en desc);
create index generaciones_fecha_idx on public.generaciones (creado_en desc);

alter table public.generaciones enable row level security;

create policy "equipo lee generaciones" on public.generaciones
  for select to authenticated using (public.es_del_equipo());
create policy "equipo escribe generaciones" on public.generaciones
  for insert to authenticated with check (public.es_del_equipo());

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

-- ============================================================
-- CLIENTE E INVITADOS (Etapa E): versiones, revisiones, comentarios,
-- hogares, entradas y la bandeja de salida de avisos.
-- ============================================================

-- ---------- VERSIONES (fotos inmutables de la invitación) ----------

create table public.versiones (
  id            uuid primary key default gen_random_uuid(),
  invitacion_id uuid not null references public.invitaciones(id) on delete cascade,
  numero        integer not null,
  plantilla     text not null,
  datos         jsonb not null,
  codigo_html   text,
  motivo        text,
  usuario_id    uuid,
  usuario_email text,
  creado_en     timestamptz not null default now()
);

create unique index versiones_numero_idx
  on public.versiones (invitacion_id, numero);

-- Una versión que se puede corregir no prueba nada: mismo trato que el
-- historial (la función ya existe desde la migración de operaciones).
create trigger versiones_no_se_tocan
  before update or delete on public.versiones
  for each row execute function public.historial_inmutable();

alter table public.versiones enable row level security;

create policy "equipo lee versiones" on public.versiones
  for select to authenticated using (public.es_del_equipo());
create policy "equipo escribe versiones" on public.versiones
  for insert to authenticated with check (public.es_del_equipo());

-- ---------- REVISIONES (el enlace del cliente) ----------

create table public.revisiones (
  id            uuid primary key default gen_random_uuid(),
  invitacion_id uuid not null references public.invitaciones(id) on delete cascade,
  version_id    uuid not null references public.versiones(id) on delete cascade,
  token         text not null unique,
  estado        text not null default 'abierta'
                check (estado in ('abierta','cambios_solicitados','aprobada')),
  expira_en     timestamptz not null,
  revocada_en   timestamptz,
  aprobada_en   timestamptz,
  -- El nombre que el cliente escribe al aprobar: la evidencia de quién
  -- dijo que sí, junto con la fecha y la versión exacta.
  aprobada_por  text,
  usuario_id    uuid,
  usuario_email text,
  creado_en     timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index revisiones_invitacion_idx
  on public.revisiones (invitacion_id, creado_en desc);

create trigger revisiones_tocar before update on public.revisiones
  for each row execute function public.tocar_actualizado_en();

alter table public.revisiones enable row level security;

create policy "equipo acceso total revisiones" on public.revisiones
  for all to authenticated
  using (public.es_del_equipo()) with check (public.es_del_equipo());
-- El cliente NO toca la tabla: entra por /revision/<token>, que valida
-- el token en el servidor con la clave secreta.

-- ---------- COMENTARIOS (lo que el cliente pide cambiar) ----------

create table public.comentarios (
  id            uuid primary key default gen_random_uuid(),
  revision_id   uuid not null references public.revisiones(id) on delete cascade,
  seccion       text not null default 'general',
  texto         text not null,
  autor         text not null default 'cliente',
  -- Imagen de referencia adjunta ("quiero algo así"): ruta en el bucket
  -- privado bajo referencias/; se enseña con URL firmada.
  imagen_ruta   text,
  estado        text not null default 'abierto'
                check (estado in ('abierto','en_proceso','resuelto','descartado')),
  resuelto_por  text,
  creado_en     timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index comentarios_revision_idx
  on public.comentarios (revision_id, creado_en);

create trigger comentarios_tocar before update on public.comentarios
  for each row execute function public.tocar_actualizado_en();

alter table public.comentarios enable row level security;

create policy "equipo acceso total comentarios" on public.comentarios
  for all to authenticated
  using (public.es_del_equipo()) with check (public.es_del_equipo());

-- ---------- HOGARES (cupo agrupado por familia) ----------

create table public.hogares (
  id            uuid primary key default gen_random_uuid(),
  invitacion_id uuid not null references public.invitaciones(id) on delete cascade,
  nombre        text not null,              -- "Familia Pérez"
  cupo          integer not null default 2 check (cupo >= 1 and cupo <= 20),
  -- Token opaco: va en el enlace personal (/i/<slug>?h=<token>) y en el
  -- QR de la puerta. NUNCA lleva nombre, teléfono ni dirección.
  token         text not null unique,
  creado_en     timestamptz not null default now()
);

-- "Familia Pérez" dos veces en la misma boda es un error de dedo.
create unique index hogares_nombre_idx
  on public.hogares (invitacion_id, lower(nombre));
create index hogares_invitacion_idx
  on public.hogares (invitacion_id);

alter table public.hogares enable row level security;

create policy "equipo acceso total hogares" on public.hogares
  for all to authenticated
  using (public.es_del_equipo()) with check (public.es_del_equipo());
-- El anfitrión los gestiona desde /lista/<token>, vía rutas de servidor.

-- Un invitado puede pertenecer a un hogar; borrado el hogar, el invitado
-- queda suelto (no desaparece de la lista).
alter table public.invitados
  add column hogar_id uuid references public.hogares(id) on delete set null;

-- La confirmación recuerda por qué puerta llegó (enlace personal del
-- hogar) para poder aplicar el cupo y cruzar la recepción.
alter table public.confirmaciones
  add column hogar_id uuid references public.hogares(id) on delete set null;

-- ---------- ENTRADAS (la puerta el día del evento) ----------

create table public.entradas (
  id            uuid primary key default gen_random_uuid(),
  invitacion_id uuid not null references public.invitaciones(id) on delete cascade,
  hogar_id      uuid references public.hogares(id) on delete set null,
  -- A quién se registró, con sus palabras: "Familia Pérez" o "Juan (sin
  -- hogar)". Queda escrito aunque el hogar se borre después.
  nombre        text not null,
  personas      integer not null check (personas >= 1 and personas <= 20),
  operador      text,
  nota          text,
  -- Una entrada mal anotada se ANULA, no se borra: la puerta es historial.
  anulada_en    timestamptz,
  creado_en     timestamptz not null default now()
);

create index entradas_invitacion_idx
  on public.entradas (invitacion_id, creado_en desc);

alter table public.entradas enable row level security;

create policy "equipo acceso total entradas" on public.entradas
  for all to authenticated
  using (public.es_del_equipo()) with check (public.es_del_equipo());

-- ---------- AVISOS (bandeja de salida de notificaciones) ----------

create table public.avisos (
  id             uuid primary key default gen_random_uuid(),
  tipo           text not null,     -- formulario_completado / revision_aprobada / …
  canal          text not null default 'email',
  destinatario   text not null,     -- correo del equipo (interno)
  referencia_tipo text,             -- pedido / invitacion / revision
  referencia_id  uuid,
  asunto         text not null,
  cuerpo_html    text not null,
  estado         text not null default 'pendiente'
                 check (estado in ('pendiente','enviado','fallido')),
  intentos       integer not null default 0,
  error          text,
  proveedor      text not null default 'resend',
  programado_en  timestamptz not null default now(),
  enviado_en     timestamptz,
  creado_en      timestamptz not null default now()
);

-- El repaso solo mira lo pendiente: índice parcial, no tabla entera.
create index avisos_pendientes_idx
  on public.avisos (programado_en) where estado = 'pendiente';

alter table public.avisos enable row level security;

create policy "equipo lee avisos" on public.avisos
  for select to authenticated using (public.es_del_equipo());
-- Se escribe solo desde el servidor (clave secreta): encolar y procesar
-- no dependen de la sesión de nadie.

-- ============================================================
-- ESCALA (Etapa F): freno compartido e índice del tablero.
-- ============================================================

-- ---------- EL FRENO COMPARTIDO ----------

create table public.frenos (
  clave     text primary key,          -- "leads:1.2.3.4" — ruta + IP, sin más
  cuenta    integer not null default 0,
  expira_en timestamptz not null
);

-- La limpieza del cron borra lo caducado por aquí.
create index frenos_expira_idx on public.frenos (expira_en);

alter table public.frenos enable row level security;
-- Sin políticas a propósito: SOLO el servidor (service_role) la toca.
-- Las claves llevan IPs: nadie del navegador tiene por qué verlas.

/**
 * Cuenta una petición y decide, EN UNA SOLA operación atómica:
 * dos peticiones simultáneas desde dos instancias no pueden colarse
 * entre el "leer" y el "escribir" porque no hay leer y escribir — hay
 * un solo upsert con la decisión dentro.
 */
create or replace function public.frenar(p_clave text, p_max integer, p_ventana_s integer)
returns table (permitido boolean, espera_s integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_fila public.frenos%rowtype;
begin
  insert into public.frenos as f (clave, cuenta, expira_en)
  values (p_clave, 1, now() + make_interval(secs => p_ventana_s))
  on conflict (clave) do update
    set cuenta = case when f.expira_en <= now() then 1 else f.cuenta + 1 end,
        expira_en = case when f.expira_en <= now()
                         then now() + make_interval(secs => p_ventana_s)
                         else f.expira_en end
  returning f.* into v_fila;

  return query select
    v_fila.cuenta <= p_max,
    case when v_fila.cuenta <= p_max then 0
         else greatest(1, ceil(extract(epoch from (v_fila.expira_en - now())))::integer)
    end;
end $$;

-- Nadie desde el navegador: ni anónimos ni autenticados. Solo el
-- servidor con la clave secreta (service_role se salta el revoke).
revoke all on function public.frenar(text, integer, integer) from public, anon, authenticated;

-- ---------- ÍNDICE DEL TABLERO ----------

create index pedidos_creado_idx
  on public.pedidos (creado_en desc);

-- ============================================================
-- PORTAL DE CLIENTES (Fase 2): cuentas, miembros, snapshot del
-- contrato y RLS multicuenta de solo lectura.
-- ============================================================

-- ---------- CUENTAS DEL CLIENTE ----------

create table public.cuentas_cliente (
  id                uuid primary key default gen_random_uuid(),
  cliente_id        uuid not null unique references public.clientes(id) on delete cascade,
  -- Se llena al activar; si el usuario de auth se borrara, la cuenta
  -- queda desvinculada pero el historial comercial no desaparece.
  usuario_id        uuid unique references auth.users(id) on delete set null,
  -- El correo ES el usuario del portal. Se captura al crear el acceso.
  email             text not null,
  estado            text not null default 'pendiente'
                    check (estado in ('pendiente','activa','suspendida')),
  token_activacion  text unique,
  activacion_expira timestamptz,
  creado_por_email  text,
  creado_en         timestamptz not null default now(),
  actualizado_en    timestamptz not null default now()
);

create trigger cuentas_cliente_tocar before update on public.cuentas_cliente
  for each row execute function public.tocar_actualizado_en();

-- ---------- MIEMBROS DE LA CUENTA ----------

create table public.miembros_cuenta (
  id         uuid primary key default gen_random_uuid(),
  cuenta_id  uuid not null references public.cuentas_cliente(id) on delete cascade,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  rol        text not null default 'propietario'
             check (rol in ('propietario','colaborador')),
  -- Permisos finos del colaborador (ej. ver_pagos); el propietario los ignora.
  permisos   jsonb not null default '{}'::jsonb,
  -- Para que el propietario vea QUIÉN tiene acceso (auth.users no se lee).
  email      text,
  creado_en  timestamptz not null default now()
);

create unique index miembros_cuenta_unicos_idx
  on public.miembros_cuenta (cuenta_id, usuario_id);
create index miembros_cuenta_usuario_idx
  on public.miembros_cuenta (usuario_id);

-- ---------- LA FOTO DEL CONTRATO ----------

alter table public.pedidos
  add column capacidades_contratadas jsonb;

-- ---------- PERTENENCIA (las tres funciones del portal) ----------

-- ¿De qué cliente es el usuario firmado? null si no es de ninguno o su
-- cuenta no está activa (suspendida = todo cerrado, sin borrar nada).
create or replace function public.mi_cliente_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select c.cliente_id
  from public.cuentas_cliente c
  join public.miembros_cuenta m on m.cuenta_id = c.id
  where m.usuario_id = auth.uid()
    and c.estado = 'activa'
  limit 1;
$$;

create or replace function public.es_mi_pedido(p_pedido uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.pedidos p
    where p.id = p_pedido and p.cliente_id = public.mi_cliente_id()
  );
$$;

create or replace function public.es_mi_invitacion(p_invitacion uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.invitaciones i
    join public.pedidos p on p.id = i.pedido_id
    where i.id = p_invitacion and p.cliente_id = public.mi_cliente_id()
  );
$$;

revoke all on function public.mi_cliente_id() from public, anon;
revoke all on function public.es_mi_pedido(uuid) from public, anon;
revoke all on function public.es_mi_invitacion(uuid) from public, anon;
grant execute on function public.mi_cliente_id() to authenticated;
grant execute on function public.es_mi_pedido(uuid) to authenticated;
grant execute on function public.es_mi_invitacion(uuid) to authenticated;

-- ¿El usuario firmado es PROPIETARIO de esta cuenta (activa)? Security
-- definer para no recursar sobre el RLS de la propia tabla de miembros.
create or replace function public.soy_propietario(p_cuenta uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.miembros_cuenta m
    join public.cuentas_cliente c on c.id = m.cuenta_id
    where m.cuenta_id = p_cuenta
      and m.usuario_id = auth.uid()
      and m.rol = 'propietario'
      and c.estado = 'activa'
  );
$$;

-- ¿El usuario firmado tiene este permiso en su cuenta? El propietario
-- los tiene todos; el colaborador, solo los que le dieron al invitarlo.
create or replace function public.mi_permiso(p_permiso text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.miembros_cuenta m
    join public.cuentas_cliente c on c.id = m.cuenta_id
    where m.usuario_id = auth.uid()
      and c.estado = 'activa'
      and (m.rol = 'propietario'
           or coalesce((m.permisos ->> p_permiso)::boolean, false))
  );
$$;

revoke all on function public.soy_propietario(uuid) from public, anon;
revoke all on function public.mi_permiso(text) from public, anon;
grant execute on function public.soy_propietario(uuid) to authenticated;
grant execute on function public.mi_permiso(text) to authenticated;

-- ---------- INVITACIONES DE COLABORADOR (Fase 4) ----------
-- El propietario invita con permisos acotados; el colaborador activa con
-- SU contraseña. Token opaco, caduca, un solo uso — como todo aquí.

create table public.invitaciones_cuenta (
  id          uuid primary key default gen_random_uuid(),
  cuenta_id   uuid not null references public.cuentas_cliente(id) on delete cascade,
  email       text not null,
  rol         text not null default 'colaborador'
              check (rol in ('colaborador')),
  permisos    jsonb not null default '{}'::jsonb,
  token       text not null unique,
  expira_en   timestamptz not null,
  usado_en    timestamptz,
  revocada_en timestamptz,
  creado_por  uuid,
  creado_en   timestamptz not null default now()
);

create index invitaciones_cuenta_cuenta_idx
  on public.invitaciones_cuenta (cuenta_id, creado_en desc);

-- ---------- RECUPERACIÓN DE CONTRASEÑA (Fase 4) ----------
-- La genera el EQUIPO (el negocio corre por WhatsApp: el cliente escribe,
-- el equipo manda el enlace). Caduca en horas y se usa una vez.

create table public.recuperaciones (
  id         uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  email      text not null,
  token      text not null unique,
  expira_en  timestamptz not null,
  usado_en   timestamptz,
  creado_por_email text,
  creado_en  timestamptz not null default now()
);

create index recuperaciones_usuario_idx
  on public.recuperaciones (usuario_id, creado_en desc);

-- ---------- PAGOS REPORTADOS (cobro por transferencia guiado) ----------
-- Lo que el CLIENTE dice que pagó (por /pagar/<token>): monto,
-- referencia y comprobante. NO es un pago: el equipo lo confirma (se
-- vuelve fila de `pagos`) o lo rechaza con motivo. El balance solo se
-- mueve con pagos confirmados.

create table public.pagos_reportados (
  id               uuid primary key default gen_random_uuid(),
  pedido_id        uuid not null references public.pedidos(id) on delete cascade,
  monto            numeric(10,2) not null check (monto > 0),
  referencia       text,
  comprobante_ruta text,
  nota             text,
  estado           text not null default 'pendiente'
                   check (estado in ('pendiente','confirmado','rechazado')),
  motivo_rechazo   text,
  revisado_en      timestamptz,
  revisado_por_email text,
  creado_en        timestamptz not null default now()
);

create index pagos_reportados_pedido_idx
  on public.pagos_reportados (pedido_id, creado_en desc);
create index pagos_reportados_pendientes_idx
  on public.pagos_reportados (creado_en) where estado = 'pendiente';

alter table public.pagos_reportados enable row level security;

create policy "equipo acceso total pagos reportados" on public.pagos_reportados
  for all to authenticated
  using (public.es_del_equipo()) with check (public.es_del_equipo());

create policy "cliente ve sus pagos reportados" on public.pagos_reportados
  for select to authenticated
  using (public.es_mi_pedido(pedido_id) and public.mi_permiso('ver_pagos'));

-- ---------- GALERÍA COLABORATIVA DEL EVENTO ----------
-- Los invitados suben sus fotos por /galeria/<slug> (validado en el
-- servidor con la clave secreta, como el RSVP); el anfitrión modera.
-- "oculta" saca la foto del álbum sin borrarla.

create table public.fotos_galeria (
  id             uuid primary key default gen_random_uuid(),
  invitacion_id  uuid not null references public.invitaciones(id) on delete cascade,
  ruta           text not null,
  miniatura_ruta text not null,
  autor          text,
  estado         text not null default 'visible'
                 check (estado in ('visible','oculta')),
  creado_en      timestamptz not null default now()
);

create index fotos_galeria_invitacion_idx
  on public.fotos_galeria (invitacion_id, creado_en desc);

alter table public.fotos_galeria enable row level security;

create policy "equipo acceso total galeria" on public.fotos_galeria
  for all to authenticated
  using (public.es_del_equipo()) with check (public.es_del_equipo());

create policy "cliente ve su galeria" on public.fotos_galeria
  for select to authenticated using (public.es_mi_invitacion(invitacion_id));

-- ---------- RLS: el cliente LEE lo suyo ----------

alter table public.cuentas_cliente enable row level security;
alter table public.miembros_cuenta enable row level security;

create policy "equipo acceso total cuentas" on public.cuentas_cliente
  for all to authenticated
  using (public.es_del_equipo()) with check (public.es_del_equipo());

-- El cliente ve SU cuenta (aunque esté suspendida: para poder decírselo).
create policy "cliente ve su cuenta" on public.cuentas_cliente
  for select to authenticated
  using (exists (
    select 1 from public.miembros_cuenta m
    -- OJO: cuentas_cliente.id CALIFICADO. Un `id` a secas se resuelve
    -- contra miembros_cuenta (que también tiene id) y la condición se
    -- vuelve siempre falsa — pasó de verdad y lo cazó probar-aislamiento.
    where m.cuenta_id = cuentas_cliente.id
      and m.usuario_id = (select auth.uid())
  ));

create policy "equipo acceso total miembros" on public.miembros_cuenta
  for all to authenticated
  using (public.es_del_equipo()) with check (public.es_del_equipo());

create policy "miembro ve su fila" on public.miembros_cuenta
  for select to authenticated
  using (usuario_id = (select auth.uid()));

-- El propietario ve TODOS los miembros de su cuenta (quién tiene acceso).
create policy "propietario ve los miembros" on public.miembros_cuenta
  for select to authenticated
  using (public.soy_propietario(cuenta_id));

alter table public.invitaciones_cuenta enable row level security;
alter table public.recuperaciones enable row level security;

create policy "equipo acceso total invitaciones cuenta" on public.invitaciones_cuenta
  for all to authenticated
  using (public.es_del_equipo()) with check (public.es_del_equipo());

-- Solo lectura para el propietario: crear y revocar van por acciones de
-- servidor que validan.
create policy "propietario ve invitaciones de su cuenta" on public.invitaciones_cuenta
  for select to authenticated
  using (public.soy_propietario(cuenta_id));

-- Recuperaciones: solo el equipo. El cliente canjea su token por una
-- ruta pública que valida en el servidor; nunca consulta la tabla.
create policy "equipo lee recuperaciones" on public.recuperaciones
  for select to authenticated using (public.es_del_equipo());

-- Lo suyo, tabla por tabla. SOLO lectura: las escrituras del portal van
-- por acciones de servidor que validan pertenencia y capacidad.
create policy "cliente ve su ficha" on public.clientes
  for select to authenticated using (id = public.mi_cliente_id());

create policy "cliente ve sus pedidos" on public.pedidos
  for select to authenticated using (cliente_id = public.mi_cliente_id());

-- Los pagos exigen ADEMÁS el permiso ver_pagos: un colaborador sin él no
-- los ve ni hablando directo con la API. El propietario lo tiene siempre.
create policy "cliente ve sus pagos" on public.pagos
  for select to authenticated
  using (public.es_mi_pedido(pedido_id) and public.mi_permiso('ver_pagos'));

create policy "cliente ve sus formularios" on public.formularios
  for select to authenticated using (public.es_mi_pedido(pedido_id));

create policy "cliente ve su invitacion" on public.invitaciones
  for select to authenticated using (public.es_mi_pedido(pedido_id));

create policy "cliente ve sus confirmaciones" on public.confirmaciones
  for select to authenticated using (public.es_mi_invitacion(invitacion_id));

create policy "cliente ve sus invitados" on public.invitados
  for select to authenticated using (public.es_mi_invitacion(invitacion_id));

create policy "cliente ve sus hogares" on public.hogares
  for select to authenticated using (public.es_mi_invitacion(invitacion_id));

create policy "cliente ve sus entradas" on public.entradas
  for select to authenticated using (public.es_mi_invitacion(invitacion_id));

create policy "cliente ve sus visitas" on public.visitas
  for select to authenticated using (public.es_mi_invitacion(invitacion_id));

create policy "cliente ve sus versiones" on public.versiones
  for select to authenticated using (public.es_mi_invitacion(invitacion_id));

create policy "cliente ve sus revisiones" on public.revisiones
  for select to authenticated using (public.es_mi_invitacion(invitacion_id));

create policy "cliente ve sus comentarios" on public.comentarios
  for select to authenticated
  using (exists (
    select 1 from public.revisiones r
    where r.id = revision_id and public.es_mi_invitacion(r.invitacion_id)
  ));

-- Lo que el cliente NO ve, a propósito: leads, demos, equipo, auditoría,
-- historial, generaciones de IA, avisos internos y frenos. Son de la
-- operación de Invifty, no del contrato del cliente.
