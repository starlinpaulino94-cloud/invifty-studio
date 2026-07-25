-- ============================================================
-- FASE 2 — Invitaciones generadas desde las respuestas
-- Si ya ejecutaste schema.sql antes, ejecuta SOLO este archivo.
-- (Las instalaciones nuevas pueden ejecutar schema.sql completo,
--  que ya incluye esta tabla.)
-- ============================================================

create table public.invitaciones (
  id            uuid primary key default gen_random_uuid(),
  pedido_id     uuid not null references public.pedidos(id) on delete cascade,
  slug          text not null unique,          -- URL pública: /i/<slug>
  plantilla     text not null default 'clasica',
  datos         jsonb not null default '{}'::jsonb,  -- contenido editable de la invitación
  estado        text not null default 'borrador' check (estado in ('borrador','publicada')),
  publicada_en  timestamptz,
  creado_en     timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index invitaciones_pedido_idx on public.invitaciones (pedido_id);

create trigger invitaciones_tocar before update on public.invitaciones
  for each row execute function public.tocar_actualizado_en();

alter table public.invitaciones enable row level security;

create policy "equipo acceso total invitaciones" on public.invitaciones
  for all to authenticated using (true) with check (true);
-- El público NO accede a la tabla: la página /i/<slug> se sirve desde el
-- servidor con la clave secreta y solo muestra invitaciones publicadas.
