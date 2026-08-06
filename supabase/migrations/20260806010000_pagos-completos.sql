-- =====================================================================
-- PAGOS COMPLETOS (fase 10 de la mejora integral)
-- =====================================================================
-- Seis columnas que convierten un abono anotado en una TRANSACCIÓN con
-- todas sus preguntas respondidas:
--
--  · referencia          — el número de la transferencia/Zelle, para
--                          cruzar con el banco sin adivinar.
--  · fecha_efectiva      — cuándo ENTRÓ el dinero (no cuándo se anotó):
--                          la cifra del mes se cuenta por esta.
--  · usuario_id/email    — quién lo registró. El dinero siempre firma.
--  · clave_idempotencia  — el doble clic del formulario no crea dos
--                          pagos: la segunda inserción choca y se trata
--                          como la primera.
--  · comprobante_ruta    — el voucher (imagen o PDF) en el bucket
--                          PRIVADO de siempre, bajo comprobantes/.
--
-- Lo que NO cambia: el monto siempre es positivo (el TIPO dice si suma
-- o resta), una sola moneda (DOP) por diseño, y los pagos se ANULAN,
-- nunca se borran. El estado del cobro se deriva de las transacciones
-- en lib/pagos.ts — no hay columna de estado que se desincronice.
--
-- Repetible: correrla dos veces no daña nada.
-- =====================================================================

alter table public.pagos
  add column if not exists referencia text,
  add column if not exists fecha_efectiva date,
  add column if not exists usuario_id uuid,
  add column if not exists usuario_email text,
  add column if not exists clave_idempotencia text,
  add column if not exists comprobante_ruta text;

-- Única solo cuando existe: los pagos históricos (sin clave) no chocan.
create unique index if not exists pagos_idempotencia_idx
  on public.pagos (clave_idempotencia)
  where clave_idempotencia is not null;
