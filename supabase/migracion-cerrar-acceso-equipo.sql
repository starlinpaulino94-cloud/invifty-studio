-- =====================================================================
-- CERRAR LA BASE DE DATOS A QUIEN NO SEA DEL EQUIPO
-- =====================================================================
-- EL PROBLEMA
-- -----------
-- Hasta ahora todas las políticas decían:
--
--     for all to authenticated using (true)
--
-- "authenticated" NO quiere decir "del equipo Invifty": quiere decir
-- "cualquiera con una sesión de Supabase en este proyecto". Y la clave
-- anon viaja en el navegador (NEXT_PUBLIC_SUPABASE_ANON_KEY), así que
-- cualquiera que la lea del código de la página puede llamar a
--
--     supabase.auth.signUp({ email, password })
--
-- y quedar autenticado. A partir de ahí no necesita el panel ni el login:
-- habla directo con la API REST de Supabase y lee (y escribe) la tabla de
-- clientes entera — nombres, teléfonos, pedidos, pagos.
--
-- Por eso este arreglo va en la base de datos y no en el proxy de Next:
-- un guardia en /panel no protege nada si el atacante nunca pasa por /panel.
--
-- LA SOLUCIÓN
-- -----------
-- Una lista blanca: la tabla `equipo`. Estar autenticado deja de bastar;
-- hay que estar además en esa lista.
--
-- La migración se siembra sola con los usuarios que YA existen: quien hoy
-- entra al panel sigue entrando igual, sin tocar nada. Quien se registre a
-- partir de ahora queda autenticado pero sin acceso a un solo dato.
--
-- Se ejecuta en Supabase → SQL Editor. Es repetible: correrla dos veces
-- no da error.
-- =====================================================================


-- ---------- 1. La lista del equipo ----------

create table if not exists public.equipo (
  usuario_id  uuid primary key references auth.users(id) on delete cascade,
  email       text,
  creado_en   timestamptz not null default now()
);

comment on table public.equipo is
  'Lista blanca de quién puede ver los datos. Estar autenticado en Supabase '
  'no basta: la clave anon es pública y cualquiera puede registrarse.';

alter table public.equipo enable row level security;

-- Cada quien se ve a sí mismo y nada más. Nadie puede añadirse: las altas
-- se hacen desde el SQL Editor (abajo), con la clave de servicio.
drop policy if exists "cada uno se ve a si mismo" on public.equipo;
create policy "cada uno se ve a si mismo" on public.equipo
  for select to authenticated using (usuario_id = (select auth.uid()));


-- ---------- 2. La comprobación que usarán todas las políticas ----------

-- `security definer` para que la función pueda leer `equipo` sin que la
-- propia RLS de `equipo` se lo impida. `search_path` fijo para que nadie
-- pueda colar una tabla `equipo` suya en otro esquema.
create or replace function public.es_del_equipo()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.equipo where usuario_id = auth.uid()
  );
$$;

comment on function public.es_del_equipo is
  'true si quien hace la petición está en la lista blanca del equipo.';

revoke all on function public.es_del_equipo() from public, anon;
grant execute on function public.es_del_equipo() to authenticated;


-- ---------- 3. Sembrar la lista con quien ya entraba ----------
-- Esto es lo que hace que la migración no rompa nada: los usuarios de hoy
-- son el equipo de hoy. Si esta tabla quedara vacía, el panel se vería
-- vacío para todo el mundo.

insert into public.equipo (usuario_id, email)
select id, email from auth.users
on conflict (usuario_id) do nothing;


-- ---------- 4. Cambiar todas las políticas ----------
-- Mismo nombre que antes, para no dejar dos políticas sobre la misma tabla
-- (bastaría con que una dijera `true` para que todo siguiera abierto).

drop policy if exists "equipo acceso total clientes" on public.clientes;
create policy "equipo acceso total clientes" on public.clientes
  for all to authenticated
  using (public.es_del_equipo()) with check (public.es_del_equipo());

drop policy if exists "equipo acceso total pedidos" on public.pedidos;
create policy "equipo acceso total pedidos" on public.pedidos
  for all to authenticated
  using (public.es_del_equipo()) with check (public.es_del_equipo());

drop policy if exists "equipo acceso total pagos" on public.pagos;
create policy "equipo acceso total pagos" on public.pagos
  for all to authenticated
  using (public.es_del_equipo()) with check (public.es_del_equipo());

drop policy if exists "equipo acceso total formularios" on public.formularios;
create policy "equipo acceso total formularios" on public.formularios
  for all to authenticated
  using (public.es_del_equipo()) with check (public.es_del_equipo());

drop policy if exists "equipo acceso total invitaciones" on public.invitaciones;
create policy "equipo acceso total invitaciones" on public.invitaciones
  for all to authenticated
  using (public.es_del_equipo()) with check (public.es_del_equipo());

drop policy if exists "equipo acceso total confirmaciones" on public.confirmaciones;
create policy "equipo acceso total confirmaciones" on public.confirmaciones
  for all to authenticated
  using (public.es_del_equipo()) with check (public.es_del_equipo());

drop policy if exists "equipo acceso total visitas" on public.visitas;
create policy "equipo acceso total visitas" on public.visitas
  for all to authenticated
  using (public.es_del_equipo()) with check (public.es_del_equipo());

-- Las fotos de los clientes: mismo criterio.
drop policy if exists "equipo lee fotos" on storage.objects;
create policy "equipo lee fotos" on storage.objects
  for select to authenticated
  using (bucket_id = 'fotos-pedidos' and public.es_del_equipo());


-- =====================================================================
-- COMPROBACIÓN
-- =====================================================================
-- Las tres filas tienen que decir OK. Si "gente en la lista" saliera 0,
-- NO cierres esta pestaña: añádete a mano antes de salir, o te quedas
-- fuera de tu propio panel:
--
--     insert into public.equipo (usuario_id, email)
--     select id, email from auth.users where email = 'tu-correo@ejemplo.com';
-- =====================================================================

select
  case when exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'equipo'
  ) then 'OK — tabla equipo' else 'FALTA — tabla equipo' end as tabla,

  case when (select count(*) from public.equipo) > 0
    then 'OK — ' || (select count(*) from public.equipo)::text || ' en la lista'
    else 'CUIDADO — lista vacía, nadie podrá ver nada' end as gente,

  case when not exists (
    -- Ninguna política de nuestras tablas puede seguir diciendo "true".
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename in ('clientes','pedidos','pagos','formularios',
                        'invitaciones','confirmaciones','visitas')
      and qual = 'true'
  ) then 'OK — ninguna política abierta'
    else 'FALTA — queda alguna política con using (true)' end as politicas;
