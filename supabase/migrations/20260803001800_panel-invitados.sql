-- =====================================================================
-- PANEL DE INVITADOS PARA EL ANFITRIÓN
-- =====================================================================
-- Hasta ahora las confirmaciones solo las veía el equipo, dentro de
-- /panel. El cliente que pagó la invitación tenía que pedirlas por
-- WhatsApp, y el equipo copiarlas y mandárselas a mano cada vez.
--
-- Esto le da su propia página: /lista/<token>. Sin cuenta ni contraseña,
-- igual que el formulario del cliente (/f/<token>) — un enlace secreto y
-- largo que se le manda una vez.
--
-- Además guarda A QUIÉN INVITÓ. Sin eso, "quién no ha confirmado" no se
-- puede responder: el sistema solo conoce a quien contesta, y el que nunca
-- abre la invitación no deja rastro. Cargar la lista es opcional.
--
-- Se ejecuta en Supabase → SQL Editor. Es repetible: correrla dos veces
-- no da error.
-- =====================================================================


-- ---------- 1. El enlace secreto de cada invitación ----------

alter table public.invitaciones
  add column if not exists token_lista text;

comment on column public.invitaciones.token_lista is
  'Enlace secreto del panel del anfitrión: /lista/<token_lista>. '
  'Como el token del formulario: sin cuenta, largo e imposible de adivinar.';

-- Las invitaciones que ya existen también lo necesitan: el anfitrión de una
-- boda entregada el mes pasado quiere su lista igual que el de mañana.
update public.invitaciones
set token_lista = replace(gen_random_uuid()::text, '-', '')
where token_lista is null;

-- Único de verdad: por él se entra, así que dos iguales darían acceso
-- cruzado a la lista de otra boda.
create unique index if not exists invitaciones_token_lista_idx
  on public.invitaciones (token_lista)
  where token_lista is not null;


-- ---------- 2. A quién invitó el anfitrión ----------

create table if not exists public.invitados (
  id                 uuid primary key default gen_random_uuid(),
  invitacion_id      uuid not null references public.invitaciones(id) on delete cascade,
  nombre             text not null,
  -- Sin acentos y en minúsculas, para cruzarlo con la confirmación aunque
  -- el invitado escriba "jose perez" y la lista diga "José Pérez".
  -- Lo calcula el servidor con lib/nombres.ts, el mismo código que usa el
  -- RSVP: si cada uno normalizara a su manera, el cruce fallaría.
  nombre_normalizado text not null,
  creado_en          timestamptz not null default now()
);

comment on table public.invitados is
  'Lista de a quién invitó el anfitrión. Opcional: sirve para saber quién '
  'NO ha contestado, que es lo que el sistema no podía responder.';

-- El mismo nombre dos veces en la misma boda es un error de dedo, no dos
-- personas. Así pegar la lista dos veces no la duplica.
create unique index if not exists invitados_unicos_idx
  on public.invitados (invitacion_id, nombre_normalizado);

create index if not exists invitados_invitacion_idx
  on public.invitados (invitacion_id);


-- ---------- 3. Seguridad ----------
-- Igual que las demás tablas: el equipo entra por la lista blanca, y el
-- anfitrión NUNCA toca Supabase directamente. Su panel pasa por rutas del
-- servidor que validan el token y usan la clave de servicio.
-- Ver 20260726135300_cerrar-acceso-equipo.sql.

alter table public.invitados enable row level security;

drop policy if exists "equipo acceso total invitados" on public.invitados;
create policy "equipo acceso total invitados" on public.invitados
  for all to authenticated
  using (public.es_del_equipo()) with check (public.es_del_equipo());


-- =====================================================================
-- COMPROBACIÓN — las cuatro filas tienen que decir OK
-- =====================================================================

select
  case when exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'invitaciones'
      and column_name = 'token_lista'
  ) then 'OK — columna token_lista' else 'FALTA — columna token_lista' end as columna,

  case when not exists (
    select 1 from public.invitaciones where token_lista is null
  ) then 'OK — todas tienen enlace'
    else 'FALTA — ' || (select count(*) from public.invitaciones
                        where token_lista is null)::text || ' sin enlace' end as enlaces,

  case when to_regclass('public.invitados') is not null
    then 'OK — tabla invitados' else 'FALTA — tabla invitados' end as tabla,

  case when exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'invitados'
      and qual like '%es_del_equipo%'
  ) then 'OK — política cerrada' else 'FALTA — política de invitados' end as politica;
