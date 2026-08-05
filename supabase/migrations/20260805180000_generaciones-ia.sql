-- =====================================================================
-- REGISTRO DE GENERACIONES DE IA (Etapa D de la mejora integral)
-- =====================================================================
-- Cada vez que un proveedor (mock o Claude) propone conceptos para una
-- invitación, queda una fila: quién pidió, qué proveedor y modelo, qué
-- versión de prompt, qué salió, si pasó la validación y cuánto costó.
--
-- Sin esto, la IA es un gasto invisible y un resultado indiscutible: no
-- se puede responder "¿cuánto llevamos gastado?", "¿qué prompt produjo
-- esta belleza/desastre?" ni "¿el proveedor está alucinando paletas?".
--
-- NO se guardan cadenas de razonamiento ni claves — solo entradas y
-- salidas del contrato público del proveedor.
--
-- Repetible: correrla dos veces no daña nada.
-- =====================================================================

create table if not exists public.generaciones (
  id             uuid primary key default gen_random_uuid(),
  invitacion_id  uuid references public.invitaciones(id) on delete set null,
  tipo           text not null default 'conceptos',
  proveedor      text not null,               -- mock / anthropic
  modelo         text not null,
  prompt_version text not null,
  -- Huella del brief: permite ver si el mismo input dio outputs distintos.
  hash_brief     text not null,
  intento        integer not null default 1,
  -- El resultado tal cual lo devolvió el proveedor (ya sin secretos).
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

create index if not exists generaciones_invitacion_idx
  on public.generaciones (invitacion_id, creado_en desc);
create index if not exists generaciones_fecha_idx on public.generaciones (creado_en desc);

alter table public.generaciones enable row level security;

drop policy if exists "equipo lee generaciones" on public.generaciones;
create policy "equipo lee generaciones" on public.generaciones
  for select to authenticated using (public.es_del_equipo());
drop policy if exists "equipo escribe generaciones" on public.generaciones;
create policy "equipo escribe generaciones" on public.generaciones
  for insert to authenticated with check (public.es_del_equipo());

-- =====================================================================
-- COMPROBACIÓN — las dos columnas deben decir OK
-- =====================================================================

select
  case when to_regclass('public.generaciones') is not null
    then 'OK — tabla generaciones' else 'FALTA — tabla generaciones' end as tabla,
  case when (select count(*) from pg_policies where schemaname='public'
             and tablename='generaciones' and qual like '%es_del_equipo%') >= 1
    then 'OK — políticas cerradas' else 'FALTA — políticas' end as politicas;
