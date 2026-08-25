-- =====================================================================
-- COLABORADORES DE CUENTA + RECUPERACIÓN DE CONTRASEÑA (Fase 4)
-- =====================================================================
-- El propietario puede invitar a un colaborador (su pareja, el
-- organizador del evento) con permisos ACOTADOS, y el equipo puede
-- generar un enlace de recuperación cuando un cliente pierde su
-- contraseña. Todo con el mismo patrón de la casa: tokens opacos que
-- caducan y se usan UNA vez; ninguna contraseña viaja por WhatsApp.
--
--  · invitaciones_cuenta — la invitación pendiente de un colaborador.
--    La crea el propietario desde su portal; al activar, el colaborador
--    pone SU contraseña y nace su fila en miembros_cuenta.
--  · recuperaciones — el enlace de restablecer contraseña. Lo genera el
--    EQUIPO (el negocio entero corre por WhatsApp: el cliente escribe,
--    el equipo manda el enlace). Caduca en horas, no en días.
--  · miembros_cuenta.email — para que el propietario vea QUIÉN tiene
--    acceso sin necesitar leer auth.users (que RLS no alcanza).
--
-- PERMISOS EN LA BASE, no solo en la pantalla: la política de pagos
-- ahora exige mi_permiso('ver_pagos') — un colaborador sin ese permiso
-- no ve los pagos NI hablando directo con la API de Supabase. Esconder
-- la sección habría sido teatro.
--
-- Repetible: correrla dos veces no daña nada.
-- =====================================================================

-- ---------- QUIÉN ES QUIÉN, VISIBLE PARA EL PROPIETARIO ----------

alter table public.miembros_cuenta
  add column if not exists email text;

-- ---------- INVITACIONES DE COLABORADOR ----------

create table if not exists public.invitaciones_cuenta (
  id          uuid primary key default gen_random_uuid(),
  cuenta_id   uuid not null references public.cuentas_cliente(id) on delete cascade,
  email       text not null,
  rol         text not null default 'colaborador'
              check (rol in ('colaborador')),
  -- Permisos acotados que tendrá el miembro al activar (ej. ver_pagos).
  permisos    jsonb not null default '{}'::jsonb,
  token       text not null unique,
  expira_en   timestamptz not null,
  usado_en    timestamptz,
  revocada_en timestamptz,
  creado_por  uuid,
  creado_en   timestamptz not null default now()
);

create index if not exists invitaciones_cuenta_cuenta_idx
  on public.invitaciones_cuenta (cuenta_id, creado_en desc);

-- ---------- RECUPERACIÓN DE CONTRASEÑA ----------

create table if not exists public.recuperaciones (
  id         uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  email      text not null,
  token      text not null unique,
  expira_en  timestamptz not null,
  usado_en   timestamptz,
  creado_por_email text,
  creado_en  timestamptz not null default now()
);

create index if not exists recuperaciones_usuario_idx
  on public.recuperaciones (usuario_id, creado_en desc);

-- ---------- LAS DOS FUNCIONES NUEVAS DE PERTENENCIA ----------

-- ¿El usuario firmado es PROPIETARIO de esta cuenta (y la cuenta está
-- activa)? Security definer para no recursar sobre el RLS de la propia
-- tabla de miembros.
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
-- Una cuenta suspendida no tiene ninguno.
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

-- ---------- RLS ----------

alter table public.invitaciones_cuenta enable row level security;
alter table public.recuperaciones enable row level security;

drop policy if exists "equipo acceso total invitaciones cuenta" on public.invitaciones_cuenta;
create policy "equipo acceso total invitaciones cuenta" on public.invitaciones_cuenta
  for all to authenticated
  using (public.es_del_equipo()) with check (public.es_del_equipo());

-- El propietario ve las invitaciones de SU cuenta (para reenviar o
-- revocar). Solo lectura: crear y revocar pasan por acciones de servidor.
drop policy if exists "propietario ve invitaciones de su cuenta" on public.invitaciones_cuenta;
create policy "propietario ve invitaciones de su cuenta" on public.invitaciones_cuenta
  for select to authenticated
  using (public.soy_propietario(cuenta_id));

-- El propietario ve TODOS los miembros de su cuenta (quién tiene acceso).
drop policy if exists "propietario ve los miembros" on public.miembros_cuenta;
create policy "propietario ve los miembros" on public.miembros_cuenta
  for select to authenticated
  using (public.soy_propietario(cuenta_id));

-- Recuperaciones: solo el equipo las ve. El cliente nunca las consulta —
-- canjea su token por una ruta pública que valida en el servidor.
drop policy if exists "equipo lee recuperaciones" on public.recuperaciones;
create policy "equipo lee recuperaciones" on public.recuperaciones
  for select to authenticated using (public.es_del_equipo());

-- ---------- PAGOS: EL PERMISO SE EXIGE EN LA BASE ----------

drop policy if exists "cliente ve sus pagos" on public.pagos;
create policy "cliente ve sus pagos" on public.pagos
  for select to authenticated
  using (public.es_mi_pedido(pedido_id) and public.mi_permiso('ver_pagos'));

-- ---------- COMPROBACIÓN (una sola consulta: el editor solo enseña la última) ----------

select 'tabla invitaciones_cuenta' as que,
       case when exists (select 1 from information_schema.tables
                         where table_schema = 'public' and table_name = 'invitaciones_cuenta')
            then '✅ OK' else '❌ FALTA' end as estado
union all
select 'tabla recuperaciones',
       case when exists (select 1 from information_schema.tables
                         where table_schema = 'public' and table_name = 'recuperaciones')
            then '✅ OK' else '❌ FALTA' end
union all
select 'miembros_cuenta.email',
       case when exists (select 1 from information_schema.columns
                         where table_schema = 'public' and table_name = 'miembros_cuenta'
                           and column_name = 'email')
            then '✅ OK' else '❌ FALTA' end
union all
select 'funciones soy_propietario y mi_permiso',
       case when (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                  where n.nspname = 'public'
                    and p.proname in ('soy_propietario','mi_permiso')) = 2
            then '✅ OK' else '❌ FALTA' end
union all
select 'pagos exige el permiso ver_pagos',
       case when exists (select 1 from pg_policies
                         where schemaname = 'public' and tablename = 'pagos'
                           and policyname = 'cliente ve sus pagos'
                           and qual like '%mi_permiso%')
            then '✅ OK' else '❌ FALTA' end;
