-- ============================================================
-- CONFIRMACIONES DE ASISTENCIA (RSVP)
-- Si ya ejecutaste schema.sql antes de esta función, ejecuta SOLO
-- este archivo. (Las instalaciones nuevas pueden ejecutar schema.sql
-- completo, que ya incluye esta tabla.)
--
-- Antes, la confirmación solo abría WhatsApp: si el invitado no llegaba
-- a pulsar "enviar", se perdía sin rastro. Ahora queda guardada aquí y
-- el anfitrión tiene una lista real, con su conteo y su exportación.
-- ============================================================

create table public.confirmaciones (
  id            uuid primary key default gen_random_uuid(),
  invitacion_id uuid not null references public.invitaciones(id) on delete cascade,
  nombre        text not null,
  -- Nombre en minúsculas y sin espacios sobrantes: sirve para reconocer
  -- que un invitado está corrigiendo su respuesta en vez de duplicarla.
  nombre_normalizado text not null,
  asiste        boolean not null,
  -- Personas que asistirán en total, incluyendo al invitado.
  -- 0 cuando la respuesta es "no podré ir", para poder sumar la columna.
  cantidad      integer not null default 1 check (cantidad >= 0 and cantidad <= 20),
  nota          text,
  creado_en     timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index confirmaciones_invitacion_idx
  on public.confirmaciones (invitacion_id, creado_en desc);

-- Una fila por invitado: si vuelve a confirmar, se actualiza su respuesta.
create unique index confirmaciones_invitado_idx
  on public.confirmaciones (invitacion_id, nombre_normalizado);

create trigger confirmaciones_tocar before update on public.confirmaciones
  for each row execute function public.tocar_actualizado_en();

alter table public.confirmaciones enable row level security;

-- El equipo lee y administra las confirmaciones desde el panel.
create policy "equipo acceso total confirmaciones" on public.confirmaciones
  for all to authenticated using (true) with check (true);

-- Los invitados NO tocan la tabla: confirman por la ruta
-- /api/invitacion/<slug>/rsvp, que valida en el servidor que la
-- invitación existe y está publicada antes de guardar nada.
