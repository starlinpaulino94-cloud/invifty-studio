-- ============================================================
-- VERIFICAR LA INSTALACIÓN
-- Pega esto en Supabase → SQL Editor → Run. No modifica nada:
-- solo mira qué hay y te dice si falta algo.
--
-- Todas las filas deben decir OK en la última columna.
-- ============================================================

with esperado(tabla, columnas, indices, politicas) as (
  values
    ('clientes',       6, 2, 1),
    ('pedidos',       14, 3, 1),
    ('pagos',          6, 2, 1),
    ('formularios',    8, 3, 1),
    ('invitaciones',   9, 3, 1),
    ('confirmaciones', 9, 3, 1),
    ('visitas',        5, 3, 1)
)
select
  e.tabla,

  case when to_regclass('public.' || e.tabla) is null
       then '❌ NO EXISTE' else '✅' end                                as tabla,

  coalesce((select count(*)::int from information_schema.columns
            where table_schema = 'public' and table_name = e.tabla), 0)
    || ' / ' || e.columnas                                             as columnas,

  coalesce((select count(*)::int from pg_indexes
            where schemaname = 'public' and tablename = e.tabla), 0)
    || ' / ' || e.indices                                              as indices,

  case when (select relrowsecurity from pg_class
             where oid = to_regclass('public.' || e.tabla))
       then '✅' else '❌ RLS APAGADO' end                              as rls,

  coalesce((select count(*)::int from pg_policies
            where schemaname = 'public' and tablename = e.tabla), 0)
    || ' / ' || e.politicas                                            as politicas,

  case
    when to_regclass('public.' || e.tabla) is null then '❌ falta la tabla'
    when (select count(*) from information_schema.columns
          where table_schema = 'public' and table_name = e.tabla) < e.columnas
      then '❌ faltan columnas'
    when (select count(*) from pg_indexes
          where schemaname = 'public' and tablename = e.tabla) < e.indices
      then '❌ faltan índices'
    when not coalesce((select relrowsecurity from pg_class
                       where oid = to_regclass('public.' || e.tabla)), false)
      then '❌ RLS apagado'
    when (select count(*) from pg_policies
          where schemaname = 'public' and tablename = e.tabla) < e.politicas
      then '❌ faltan políticas'
    else 'OK'
  end                                                                  as resultado

from esperado e
order by e.tabla;
