-- =====================================================================
-- LEADS DESDE LA WEB + DEMOS PÚBLICAS (Etapa B de la mejora integral)
-- =====================================================================
-- Hasta ahora un interesado de la web llegaba por WhatsApp y vivía en la
-- memoria de quien lo atendió: sin lista, sin estados, sin saber de qué
-- campaña vino ni cuántos se perdieron. Esta migración le da sitio:
--
--  1. `leads` — lo que la web manda a POST /api/public/leads. Con estado
--     (nuevo → contactado → calificado → convertido/perdido), atribución
--     (fuente y UTM) e idempotencia: el doble clic del visitante no crea
--     dos leads.
--  2. `demos` — qué invitaciones publicadas se enseñan como demostración
--     en la web (GET /api/public/demos). Marca, orden y tipo; los datos
--     visibles salen de la invitación real.
--
-- Repetible: correrla dos veces no daña nada.
-- =====================================================================


-- ---------- 1. LEADS ----------

create table if not exists public.leads (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null,
  telefono      text not null,               -- normalizado a dígitos (18091234567)
  tipo_evento   text not null,
  fecha_evento  date,
  plan_id       text,                        -- id del catálogo, si eligió uno
  demo_slug     text,                        -- desde qué demo llegó, si aplica
  mensaje       text,
  idioma        text not null default 'es',
  fuente        text not null,               -- web / instagram / referido…
  utm           jsonb not null default '{}'::jsonb,
  consentimiento boolean not null default false,
  -- La manda el navegador de la web: el doble envío trae la misma clave y
  -- el índice único lo convierte en un solo lead.
  clave_idempotencia text not null,
  estado        text not null default 'nuevo' check (estado in
                  ('nuevo','contactado','calificado','convertido','perdido')),
  -- Al convertirlo queda el rastro: quién, cuándo y en qué cliente acabó.
  cliente_id    uuid references public.clientes(id) on delete set null,
  convertido_en timestamptz,
  convertido_por uuid,
  creado_en     timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create unique index if not exists leads_idempotencia_idx
  on public.leads (clave_idempotencia);
create index if not exists leads_estado_idx on public.leads (estado, creado_en desc);
create index if not exists leads_telefono_idx on public.leads (telefono);

drop trigger if exists leads_tocar on public.leads;
create trigger leads_tocar before update on public.leads
  for each row execute function public.tocar_actualizado_en();

alter table public.leads enable row level security;

drop policy if exists "equipo acceso total leads" on public.leads;
create policy "equipo acceso total leads" on public.leads
  for all to authenticated
  using (public.es_del_equipo()) with check (public.es_del_equipo());


-- ---------- 2. DEMOS PÚBLICAS ----------

create table if not exists public.demos (
  id            uuid primary key default gen_random_uuid(),
  -- Única: una invitación o es demo o no lo es, sin duplicados.
  invitacion_id uuid not null unique references public.invitaciones(id) on delete cascade,
  tipo_evento   text not null default 'boda',
  plan_minimo   text not null default 'esencial',
  orden         integer not null default 0,
  destacada     boolean not null default false,
  activa        boolean not null default true,
  idioma        text not null default 'es',
  creado_en     timestamptz not null default now()
);

create index if not exists demos_activas_idx on public.demos (activa, orden);

alter table public.demos enable row level security;

drop policy if exists "equipo acceso total demos" on public.demos;
create policy "equipo acceso total demos" on public.demos
  for all to authenticated
  using (public.es_del_equipo()) with check (public.es_del_equipo());


-- =====================================================================
-- COMPROBACIÓN — las cuatro columnas deben decir OK
-- =====================================================================

select
  case when to_regclass('public.leads') is not null
    then 'OK — tabla leads' else 'FALTA — tabla leads' end as leads,

  case when exists (select 1 from pg_indexes where schemaname='public'
                    and indexname='leads_idempotencia_idx')
    then 'OK — idempotencia' else 'FALTA — índice de idempotencia' end as idempotencia,

  case when to_regclass('public.demos') is not null
    then 'OK — tabla demos' else 'FALTA — tabla demos' end as demos,

  case when (select count(*) from pg_policies where schemaname='public'
             and tablename in ('leads','demos')
             and qual like '%es_del_equipo%') = 2
    then 'OK — políticas cerradas' else 'FALTA — políticas' end as politicas;
