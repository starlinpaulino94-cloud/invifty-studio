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
    ('pedidos',       15, 4, 1),
    ('pagos',         16, 3, 1),
    ('formularios',    8, 3, 1),
    ('invitaciones',  13, 5, 1),
    ('confirmaciones',11, 3, 1),
    ('visitas',        5, 3, 1),
    ('invitados',      6, 3, 1),
    ('leads',         19, 4, 1),
    ('demos',          9, 3, 1),
    ('historial_estados', 9, 2, 2),
    ('auditoria',      8, 3, 2),
    ('generaciones',  17, 3, 2),
    ('versiones',     10, 2, 2),
    ('revisiones',    13, 3, 1),
    ('comentarios',   10, 2, 1),
    ('hogares',        6, 4, 1),
    ('entradas',       9, 2, 1),
    ('avisos',        15, 2, 1),
    ('frenos',         3, 2, 0)
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


-- =====================================================================
-- ¿ESTÁ CERRADA LA PUERTA?
-- =====================================================================
-- Lo anterior comprueba que las políticas EXISTEN. Esto comprueba que
-- además sirven de algo: una política `using (true)` existe, cuenta, y
-- deja entrar a cualquiera que se registre con la clave anon (que es
-- pública). Ver README → "Tener sesión no es ser del equipo".
-- =====================================================================

select
  case when to_regclass('public.equipo') is null
    then '❌ falta la tabla equipo — corre migrations/20260726135300_cerrar-acceso-equipo.sql'
    else '✅ existe la lista del equipo' end                    as lista,

  case when to_regclass('public.equipo') is null then '—'
    when (select count(*) from public.equipo) = 0
      then '❌ lista vacía: nadie puede ver nada'
    else '✅ ' || (select count(*) from public.equipo)::text || ' en la lista'
  end                                                          as gente,

  case when exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename in ('clientes','pedidos','pagos','formularios',
                        'invitaciones','confirmaciones','visitas','invitados','leads','demos')
      and qual = 'true'
  ) then '❌ hay políticas abiertas a cualquier registrado'
    else '✅ ninguna política abierta' end                      as politicas,

  case when exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'es_del_equipo'
  ) then '✅ es_del_equipo() instalada'
    else '❌ falta la función es_del_equipo()' end              as funcion;
