-- =====================================================================
-- ORGANIZADOR DE MESAS (seating)
-- =====================================================================
-- El anfitrión organiza sus mesas y asigna HOGARES completos (las
-- familias se sientan juntas: el modelo de hogares ya dice quiénes van
-- juntos). La ocupación se calcula contra las personas CONFIRMADAS de
-- cada hogar — el número que de verdad se sienta — y el día del evento
-- la puerta puede decirle a cada familia su mesa al registrarla.
--
--  · mesas — nombre y capacidad, por invitación.
--  · hogares.mesa_id — a qué mesa va cada hogar. Borrar una mesa deja a
--    sus hogares "sin mesa" (set null), nunca borra hogares.
--
-- Repetible: correrla dos veces no daña nada.
-- =====================================================================

create table if not exists public.mesas (
  id            uuid primary key default gen_random_uuid(),
  invitacion_id uuid not null references public.invitaciones(id) on delete cascade,
  nombre        text not null,
  capacidad     integer not null default 10 check (capacidad between 1 and 100),
  creado_en     timestamptz not null default now()
);

create index if not exists mesas_invitacion_idx
  on public.mesas (invitacion_id, creado_en);

alter table public.hogares
  add column if not exists mesa_id uuid references public.mesas(id) on delete set null;

-- ---------- RLS ----------
-- El anfitrión opera por /lista/<token> (servidor con clave secreta);
-- el cliente del portal las VE.

alter table public.mesas enable row level security;

drop policy if exists "equipo acceso total mesas" on public.mesas;
create policy "equipo acceso total mesas" on public.mesas
  for all to authenticated
  using (public.es_del_equipo()) with check (public.es_del_equipo());

drop policy if exists "cliente ve sus mesas" on public.mesas;
create policy "cliente ve sus mesas" on public.mesas
  for select to authenticated using (public.es_mi_invitacion(invitacion_id));

-- ---------- COMPROBACIÓN ----------

select 'tabla mesas' as que,
       case when exists (select 1 from information_schema.tables
                         where table_schema = 'public' and table_name = 'mesas')
            then '✅ OK' else '❌ FALTA' end as estado
union all
select 'hogares.mesa_id',
       case when exists (select 1 from information_schema.columns
                         where table_schema = 'public' and table_name = 'hogares'
                           and column_name = 'mesa_id')
            then '✅ OK' else '❌ FALTA' end
union all
select 'políticas de mesas (2)',
       case when (select count(*) from pg_policies
                  where schemaname = 'public' and tablename = 'mesas') >= 2
            then '✅ OK' else '❌ FALTA' end;
