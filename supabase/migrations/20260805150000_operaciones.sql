-- =====================================================================
-- OPERACIONES: roles, historial, auditoría y pagos sin borrado
-- (Etapa C de la mejora integral)
-- =====================================================================
-- Cuatro cambios que comparten un motivo: que el sistema recuerde quién
-- hizo qué, y que nadie pueda hacer lo que no le toca.
--
--  1. `equipo.rol` — hasta ahora ser del equipo era todo o nada. Ahora
--     cada miembro tiene rol y las acciones sensibles lo comprueban EN EL
--     SERVIDOR (lib/roles.ts): esconder un botón no es autorización.
--  2. `historial_estados` — cada cambio de estado de un pedido queda
--     escrito: de qué, a qué, quién y cuándo. Inmutable: se puede leer y
--     añadir, nunca corregir — un historial corregible no es historial.
--  3. `auditoria` — las acciones sensibles (pagos, publicaciones, cambios
--     de dominio, conversiones) dejan rastro con el mismo trato inmutable.
--  4. `pagos` — un pago confirmado YA NO SE BORRA: se anula, con motivo y
--     firma. El dinero mal anotado se tacha a la vista, no desaparece.
--     Y los pedidos ganan el estado `cancelado`, que faltaba: hoy un
--     pedido cancelado se disfraza de "nuevo" para siempre.
--
-- Repetible: correrla dos veces no daña nada.
-- =====================================================================


-- ---------- 1. Roles del equipo ----------

alter table public.equipo
  add column if not exists rol text not null default 'admin'
  check (rol in ('propietario','admin','ventas','operaciones','disenador','lectura'));

comment on column public.equipo.rol is
  'Qué le toca a cada quien. La matriz vive en src/lib/roles.ts y se '
  'valida en servidor. propietario > admin > operaciones/ventas/disenador > lectura.';

-- Si el equipo es una sola persona, esa persona es el propietario.
update public.equipo set rol = 'propietario'
where (select count(*) from public.equipo) = 1;


-- ---------- 2. Historial de estados (inmutable) ----------

create table if not exists public.historial_estados (
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

create index if not exists historial_entidad_idx
  on public.historial_estados (entidad, entidad_id, creado_en desc);

alter table public.historial_estados enable row level security;

-- Leer y añadir, nunca tocar: no hay política de update ni delete, y el
-- trigger de abajo lo hace explícito incluso para quien salte las políticas.
drop policy if exists "equipo lee historial" on public.historial_estados;
create policy "equipo lee historial" on public.historial_estados
  for select to authenticated using (public.es_del_equipo());
drop policy if exists "equipo escribe historial" on public.historial_estados;
create policy "equipo escribe historial" on public.historial_estados
  for insert to authenticated with check (public.es_del_equipo());

create or replace function public.historial_inmutable()
returns trigger language plpgsql as $$
begin
  raise exception 'El historial no se corrige: es un registro, no un borrador.';
end $$;

drop trigger if exists historial_no_se_toca on public.historial_estados;
create trigger historial_no_se_toca
  before update or delete on public.historial_estados
  for each row execute function public.historial_inmutable();


-- ---------- 3. Auditoría de acciones sensibles (inmutable) ----------

create table if not exists public.auditoria (
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

create index if not exists auditoria_fecha_idx on public.auditoria (creado_en desc);
create index if not exists auditoria_entidad_idx on public.auditoria (entidad, entidad_id);

alter table public.auditoria enable row level security;

drop policy if exists "equipo lee auditoria" on public.auditoria;
create policy "equipo lee auditoria" on public.auditoria
  for select to authenticated using (public.es_del_equipo());
drop policy if exists "equipo escribe auditoria" on public.auditoria;
create policy "equipo escribe auditoria" on public.auditoria
  for insert to authenticated with check (public.es_del_equipo());

drop trigger if exists auditoria_no_se_toca on public.auditoria;
create trigger auditoria_no_se_toca
  before update or delete on public.auditoria
  for each row execute function public.historial_inmutable();


-- ---------- 4. Pagos que se anulan, no se borran ----------

alter table public.pagos
  add column if not exists tipo text not null default 'pago'
    check (tipo in ('pago','reembolso','ajuste')),
  add column if not exists anulado_en timestamptz,
  add column if not exists anulado_por uuid,
  add column if not exists motivo_anulacion text;

comment on column public.pagos.anulado_en is
  'Un pago anulado se tacha, no desaparece: el balance lo ignora '
  '(lib/pagos.ts) pero el rastro queda. Borrar dinero sin rastro, jamás.';


-- ---------- 5. El estado que faltaba: cancelado ----------

alter table public.pedidos drop constraint if exists pedidos_estado_check;
alter table public.pedidos add constraint pedidos_estado_check check (estado in (
  'nuevo','formulario_enviado','formulario_completado',
  'en_diseno','revision_cliente','entregada','activa','vencida','cancelado'));


-- =====================================================================
-- COMPROBACIÓN — las cinco columnas deben decir OK
-- =====================================================================

select
  case when exists (select 1 from information_schema.columns
    where table_schema='public' and table_name='equipo' and column_name='rol')
    then 'OK — roles' else 'FALTA — equipo.rol' end as roles,

  case when to_regclass('public.historial_estados') is not null
    then 'OK — historial' else 'FALTA — historial_estados' end as historial,

  case when to_regclass('public.auditoria') is not null
    then 'OK — auditoría' else 'FALTA — auditoria' end as auditoria,

  case when exists (select 1 from information_schema.columns
    where table_schema='public' and table_name='pagos' and column_name='anulado_en')
    then 'OK — pagos anulables' else 'FALTA — pagos.anulado_en' end as pagos,

  case when exists (select 1 from information_schema.check_constraints
    where constraint_name='pedidos_estado_check' and check_clause like '%cancelado%')
    then 'OK — estado cancelado' else 'FALTA — cancelado en pedidos' end as cancelado;
