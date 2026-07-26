-- ============================================================
-- INVITACIONES CON CÓDIGO PROPIO
-- Si ya ejecutaste schema.sql antes de esta función, ejecuta SOLO
-- este archivo. (Las instalaciones nuevas pueden ejecutar schema.sql
-- completo, que ya incluye esta columna.)
--
-- Guarda el HTML de una invitación hecha fuera del sistema (por ejemplo
-- con IA) para poder publicarla y administrarla como cualquier otra.
-- Se usa cuando la columna `plantilla` vale 'codigo'.
-- ============================================================

alter table public.invitaciones
  add column if not exists codigo_html text;
