-- =====================================================================
-- MESA DE REGALOS CON TRANSFERENCIA LOCAL
-- =====================================================================
-- La sección de regalos deja de ser texto decorativo: una página propia
-- (/regalos/<slug>) con las cuentas del ANFITRIÓN listas para copiar,
-- donde el invitado registra su regalo — y el anfitrión recibe su lista
-- de agradecimientos con el total. Invifty NO custodia dinero: el
-- invitado transfiere directo al anfitrión; aquí solo se organiza.
--
--  · aportes — lo que cada invitado registró: su nombre, el monto (si
--    quiso decirlo) y su mensaje. Es la lista de agradecimientos.
--    "oculta" la saca de la lista sin borrarla.
--  · invitaciones.cuentas_regalo — las cuentas bancarias del anfitrión
--    (las gestiona él desde /lista, con su token). Distintas de las de
--    Invifty (config/cobro.ts): este dinero es del anfitrión.
--
-- Los montos de los aportes son PRIVADOS del anfitrión: la página
-- pública jamás lista quién dio qué.
--
-- Repetible: correrla dos veces no daña nada.
-- =====================================================================

create table if not exists public.aportes (
  id            uuid primary key default gen_random_uuid(),
  invitacion_id uuid not null references public.invitaciones(id) on delete cascade,
  nombre        text not null,
  -- null = prefirió no decir el monto (o el regalo no fue dinero).
  monto         numeric(10,2) check (monto is null or monto > 0),
  mensaje       text,
  estado        text not null default 'visible'
                check (estado in ('visible','oculta')),
  creado_en     timestamptz not null default now()
);

create index if not exists aportes_invitacion_idx
  on public.aportes (invitacion_id, creado_en desc);

alter table public.invitaciones
  add column if not exists cuentas_regalo jsonb not null default '[]'::jsonb;

-- ---------- RLS ----------
-- El invitado registra por /regalos/<slug> (servidor con clave secreta);
-- el anfitrión gestiona por /lista/<token>; el cliente del portal VE.

alter table public.aportes enable row level security;

drop policy if exists "equipo acceso total aportes" on public.aportes;
create policy "equipo acceso total aportes" on public.aportes
  for all to authenticated
  using (public.es_del_equipo()) with check (public.es_del_equipo());

drop policy if exists "cliente ve sus aportes" on public.aportes;
create policy "cliente ve sus aportes" on public.aportes
  for select to authenticated using (public.es_mi_invitacion(invitacion_id));

-- ---------- COMPROBACIÓN ----------

select 'tabla aportes' as que,
       case when exists (select 1 from information_schema.tables
                         where table_schema = 'public' and table_name = 'aportes')
            then '✅ OK' else '❌ FALTA' end as estado
union all
select 'invitaciones.cuentas_regalo',
       case when exists (select 1 from information_schema.columns
                         where table_schema = 'public' and table_name = 'invitaciones'
                           and column_name = 'cuentas_regalo')
            then '✅ OK' else '❌ FALTA' end
union all
select 'políticas de aportes (2)',
       case when (select count(*) from pg_policies
                  where schemaname = 'public' and tablename = 'aportes') >= 2
            then '✅ OK' else '❌ FALTA' end;
