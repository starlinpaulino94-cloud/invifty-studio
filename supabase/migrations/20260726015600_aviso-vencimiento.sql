-- ============================================================
-- AVISO DE VENCIMIENTO
-- Si ya ejecutaste schema.sql antes de esta función, ejecuta SOLO
-- este archivo. (Las instalaciones nuevas pueden ejecutar schema.sql
-- completo, que ya incluye esta columna.)
--
-- Guarda cuándo se avisó al equipo de que una invitación está por
-- vencer, para no repetir el mismo correo todos los días.
-- ============================================================

alter table public.pedidos
  add column if not exists aviso_vencimiento_en timestamptz;

-- El repaso diario solo mira las invitaciones publicadas con fecha.
create index if not exists pedidos_vencimiento_idx
  on public.pedidos (fecha_vencimiento)
  where fecha_vencimiento is not null;
