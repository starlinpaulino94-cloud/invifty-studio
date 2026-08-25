-- =====================================================================
-- PORTAL DE CLIENTES — CUENTAS (Fase 2 del portal)
-- =====================================================================
-- Hasta hoy, solo el EQUIPO tiene cuenta; los clientes usan enlaces con
-- token. Esta migración crea la capa de CUENTAS DEL CLIENTE encima de lo
-- existente, sin tocar el flujo de tokens (que sigue siendo la puerta de
-- invitados y personal de recepción):
--
--  · cuentas_cliente — una por cliente. Nace 'pendiente' con un token de
--    activación que CADUCA (7 días) y es de un solo uso: al activar, el
--    cliente pone SU contraseña (jamás una que viaje por WhatsApp) y la
--    cuenta queda 'activa'. 'suspendida' la cierra entera sin borrar nada.
--  · miembros_cuenta — quién entra a la cuenta. Hoy: el propietario que
--    se crea al activar. Mañana: colaboradores con permisos acotados
--    (fase 7), sin cambiar ninguna política.
--  · pedidos.capacidades_contratadas — la FOTO del plan al contratar.
--    Cambiar el catálogo mañana no reescribe contratos de ayer: el
--    servicio de capacidades (lib/capacidades.ts) lee primero esta foto.
--
-- RLS MULTICUENTA — la parte que no perdona errores:
-- El cliente firmado puede LEER lo suyo (sus pedidos, su invitación, sus
-- confirmaciones…) y nada más. Tres funciones security definer resuelven
-- la pertenencia; las políticas nuevas son SOLO de lectura — toda
-- escritura del portal pasa por acciones de servidor que validan — y
-- conviven con las del equipo (políticas permisivas: cualquiera de las
-- dos abre). Una cuenta suspendida devuelve null y lo cierra todo.
--
-- Repetible: correrla dos veces no daña nada.
-- =====================================================================

-- ---------- CUENTAS DEL CLIENTE ----------

create table if not exists public.cuentas_cliente (
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

drop trigger if exists cuentas_cliente_tocar on public.cuentas_cliente;
create trigger cuentas_cliente_tocar before update on public.cuentas_cliente
  for each row execute function public.tocar_actualizado_en();

-- ---------- MIEMBROS DE LA CUENTA ----------

create table if not exists public.miembros_cuenta (
  id         uuid primary key default gen_random_uuid(),
  cuenta_id  uuid not null references public.cuentas_cliente(id) on delete cascade,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  rol        text not null default 'propietario'
             check (rol in ('propietario','colaborador')),
  -- Permisos finos del colaborador (fase 7); el propietario los ignora.
  permisos   jsonb not null default '{}'::jsonb,
  creado_en  timestamptz not null default now()
);

create unique index if not exists miembros_cuenta_unicos_idx
  on public.miembros_cuenta (cuenta_id, usuario_id);
create index if not exists miembros_cuenta_usuario_idx
  on public.miembros_cuenta (usuario_id);

-- ---------- LA FOTO DEL CONTRATO ----------

alter table public.pedidos
  add column if not exists capacidades_contratadas jsonb;

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

-- ---------- RLS: el cliente LEE lo suyo ----------

alter table public.cuentas_cliente enable row level security;
alter table public.miembros_cuenta enable row level security;

drop policy if exists "equipo acceso total cuentas" on public.cuentas_cliente;
create policy "equipo acceso total cuentas" on public.cuentas_cliente
  for all to authenticated
  using (public.es_del_equipo()) with check (public.es_del_equipo());

-- El cliente ve SU cuenta (aunque esté suspendida: para poder decírselo).
drop policy if exists "cliente ve su cuenta" on public.cuentas_cliente;
create policy "cliente ve su cuenta" on public.cuentas_cliente
  for select to authenticated
  using (exists (
    select 1 from public.miembros_cuenta m
    where m.cuenta_id = id and m.usuario_id = (select auth.uid())
  ));

drop policy if exists "equipo acceso total miembros" on public.miembros_cuenta;
create policy "equipo acceso total miembros" on public.miembros_cuenta
  for all to authenticated
  using (public.es_del_equipo()) with check (public.es_del_equipo());

drop policy if exists "miembro ve su fila" on public.miembros_cuenta;
create policy "miembro ve su fila" on public.miembros_cuenta
  for select to authenticated
  using (usuario_id = (select auth.uid()));

-- Lo suyo, tabla por tabla. SOLO lectura: las escrituras del portal van
-- por acciones de servidor que validan pertenencia y capacidad.
drop policy if exists "cliente ve su ficha" on public.clientes;
create policy "cliente ve su ficha" on public.clientes
  for select to authenticated using (id = public.mi_cliente_id());

drop policy if exists "cliente ve sus pedidos" on public.pedidos;
create policy "cliente ve sus pedidos" on public.pedidos
  for select to authenticated using (cliente_id = public.mi_cliente_id());

drop policy if exists "cliente ve sus pagos" on public.pagos;
create policy "cliente ve sus pagos" on public.pagos
  for select to authenticated using (public.es_mi_pedido(pedido_id));

drop policy if exists "cliente ve sus formularios" on public.formularios;
create policy "cliente ve sus formularios" on public.formularios
  for select to authenticated using (public.es_mi_pedido(pedido_id));

drop policy if exists "cliente ve su invitacion" on public.invitaciones;
create policy "cliente ve su invitacion" on public.invitaciones
  for select to authenticated using (public.es_mi_pedido(pedido_id));

drop policy if exists "cliente ve sus confirmaciones" on public.confirmaciones;
create policy "cliente ve sus confirmaciones" on public.confirmaciones
  for select to authenticated using (public.es_mi_invitacion(invitacion_id));

drop policy if exists "cliente ve sus invitados" on public.invitados;
create policy "cliente ve sus invitados" on public.invitados
  for select to authenticated using (public.es_mi_invitacion(invitacion_id));

drop policy if exists "cliente ve sus hogares" on public.hogares;
create policy "cliente ve sus hogares" on public.hogares
  for select to authenticated using (public.es_mi_invitacion(invitacion_id));

drop policy if exists "cliente ve sus entradas" on public.entradas;
create policy "cliente ve sus entradas" on public.entradas
  for select to authenticated using (public.es_mi_invitacion(invitacion_id));

drop policy if exists "cliente ve sus visitas" on public.visitas;
create policy "cliente ve sus visitas" on public.visitas
  for select to authenticated using (public.es_mi_invitacion(invitacion_id));

drop policy if exists "cliente ve sus versiones" on public.versiones;
create policy "cliente ve sus versiones" on public.versiones
  for select to authenticated using (public.es_mi_invitacion(invitacion_id));

drop policy if exists "cliente ve sus revisiones" on public.revisiones;
create policy "cliente ve sus revisiones" on public.revisiones
  for select to authenticated using (public.es_mi_invitacion(invitacion_id));

drop policy if exists "cliente ve sus comentarios" on public.comentarios;
create policy "cliente ve sus comentarios" on public.comentarios
  for select to authenticated
  using (exists (
    select 1 from public.revisiones r
    where r.id = revision_id and public.es_mi_invitacion(r.invitacion_id)
  ));

-- Lo que el cliente NO ve, a propósito: leads, demos, equipo, auditoría,
-- historial, generaciones de IA, avisos internos y frenos. Son de la
-- operación de Invifty, no del contrato del cliente.

-- ---------- COMPROBACIÓN (una sola consulta: el editor solo enseña la última) ----------

select 'tabla cuentas_cliente' as que,
       case when exists (select 1 from information_schema.tables
                         where table_schema = 'public' and table_name = 'cuentas_cliente')
            then '✅ OK' else '❌ FALTA' end as estado
union all
select 'tabla miembros_cuenta',
       case when exists (select 1 from information_schema.tables
                         where table_schema = 'public' and table_name = 'miembros_cuenta')
            then '✅ OK' else '❌ FALTA' end
union all
select 'pedidos.capacidades_contratadas',
       case when exists (select 1 from information_schema.columns
                         where table_schema = 'public' and table_name = 'pedidos'
                           and column_name = 'capacidades_contratadas')
            then '✅ OK' else '❌ FALTA' end
union all
select 'función mi_cliente_id',
       case when exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                         where n.nspname = 'public' and p.proname = 'mi_cliente_id')
            then '✅ OK' else '❌ FALTA' end
union all
select 'políticas del portal (15 en total)',
       case when (select count(*) from pg_policies
                  where schemaname = 'public'
                    and (policyname like 'cliente %' or policyname like 'miembro %')) >= 15
            then '✅ OK' else '❌ FALTA' end;
