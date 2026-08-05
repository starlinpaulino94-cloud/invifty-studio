-- ============================================================
-- VISITAS A LAS INVITACIONES
-- Si ya ejecutaste schema.sql antes de esta función, ejecuta SOLO
-- este archivo. (Las instalaciones nuevas pueden ejecutar schema.sql
-- completo, que ya incluye esta tabla.)
--
-- Permite decirle al cliente cuántas veces se abrió su invitación y
-- cuánta gente la vio: prueba del trabajo entregado y el mejor momento
-- para ofrecer la renovación.
--
-- PRIVACIDAD: no se guarda ninguna IP, ni cookies, ni identificadores
-- que sigan a una persona entre invitaciones. Solo un hash irreversible
-- (ver src/lib/visitas.ts).
-- ============================================================

create table public.visitas (
  id            uuid primary key default gen_random_uuid(),
  invitacion_id uuid not null references public.invitaciones(id) on delete cascade,
  -- Hash de (id de invitación + IP + navegador). No permite identificar a
  -- nadie ni relacionar visitas entre invitaciones distintas.
  huella        text not null,
  -- Hora de la visita redondeada hacia abajo: una fila por dispositivo y
  -- hora, para que recargar la página no infle el conteo.
  hora          timestamptz not null,
  creado_en     timestamptz not null default now()
);

create unique index visitas_unicas_idx
  on public.visitas (invitacion_id, huella, hora);

create index visitas_invitacion_idx
  on public.visitas (invitacion_id, creado_en desc);

alter table public.visitas enable row level security;

-- El equipo lee las visitas desde el panel.
-- NOTA: esta política se endureció después. "authenticated" no quiere decir
-- "del equipo": la clave anon es pública y cualquiera puede registrarse.
-- Ver 20260726135300_cerrar-acceso-equipo.sql.
create policy "equipo acceso total visitas" on public.visitas
  for all to authenticated
  using (public.es_del_equipo()) with check (public.es_del_equipo());

-- Los invitados NO tocan la tabla: la visita se registra desde
-- /api/invitacion/<slug>/visita, en el servidor.
