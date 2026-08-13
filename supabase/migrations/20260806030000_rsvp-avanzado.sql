-- =====================================================================
-- RSVP AVANZADO (fase 11.2 de la mejora integral)
-- =====================================================================
-- Las respuestas a las preguntas extra del RSVP (menú, alergias,
-- transporte, preguntas propias del evento). Van en un jsonb y no en
-- columnas porque las preguntas las decide CADA invitación en el editor
-- (datos.rsvp.preguntas): hoy son tres atajos y mañana las que hagan
-- falta, sin migrar nada más.
--
-- La forma es { "<id de pregunta>": "<respuesta>" } y el servidor solo
-- guarda respuestas validadas contra la configuración real de la
-- invitación (src/lib/rsvp.ts): un id desconocido o una opción
-- inventada no entran.
--
-- Repetible: correrla dos veces no daña nada.
-- =====================================================================

alter table public.confirmaciones
  add column if not exists respuestas jsonb not null default '{}'::jsonb;
