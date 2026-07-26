-- =====================================================================
-- DOMINIO PROPIO DE UNA INVITACIÓN
-- =====================================================================
-- El catálogo vende "Dominio Web Propio" (RD$ 1,500) y el formulario
-- pregunta cuál quiere el cliente, pero no había dónde guardarlo: todas
-- las invitaciones vivían en /i/<slug> y el extra solo podía cumplirse
-- configurando cosas a mano, si es que alguien se acordaba.
--
-- Se ejecuta en Supabase → SQL Editor. Es repetible: correrla dos veces
-- no da error.
-- =====================================================================

alter table invitaciones
  add column if not exists dominio text;

comment on column invitaciones.dominio is
  'Dominio propio del cliente, sin protocolo ni www (ej. bodacamila.com). '
  'El DNS y el alta en Vercel se hacen aparte; esto es de quién es.';

-- Dos invitaciones no pueden compartir dominio: la petición llega por el
-- Host y no habría forma de saber cuál servir.
create unique index if not exists invitaciones_dominio_unico
  on invitaciones (lower(dominio))
  where dominio is not null;

-- Comprobación
select
  case when exists (
    select 1 from information_schema.columns
    where table_name = 'invitaciones' and column_name = 'dominio'
  ) then 'OK — columna dominio' else 'FALTA — columna dominio' end as columna,
  case when exists (
    select 1 from pg_indexes
    where tablename = 'invitaciones' and indexname = 'invitaciones_dominio_unico'
  ) then 'OK — índice único' else 'FALTA — índice único' end as indice;
