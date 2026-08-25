-- =====================================================================
-- ARREGLO: el cliente no podía ver SU PROPIA cuenta
-- =====================================================================
-- La política "cliente ve su cuenta" decía `m.cuenta_id = id`, y dentro
-- de la subconsulta ese `id` se resuelve contra miembros_cuenta (que
-- también tiene columna id), no contra cuentas_cliente: la condición
-- comparaba la fila de miembro consigo misma y era SIEMPRE falsa. El
-- cliente nunca veía su cuenta; el portal le decía "esta cuenta no
-- tiene portal" tras activar.
--
-- Lo encontró probar-aislamiento.sql (fila 15 en ❌) — para eso existe.
-- El arreglo: calificar la referencia externa (cuentas_cliente.id).
--
-- Repetible: correrla dos veces no daña nada.
-- =====================================================================

drop policy if exists "cliente ve su cuenta" on public.cuentas_cliente;
create policy "cliente ve su cuenta" on public.cuentas_cliente
  for select to authenticated
  using (exists (
    select 1 from public.miembros_cuenta m
    where m.cuenta_id = cuentas_cliente.id
      and m.usuario_id = (select auth.uid())
  ));

-- ---------- COMPROBACIÓN ----------
-- El qual deparseado debe referirse a cuentas_cliente.id, no a m.id.
select 'política cliente ve su cuenta arreglada' as que,
       case when exists (
         select 1 from pg_policies
         where schemaname = 'public' and tablename = 'cuentas_cliente'
           and policyname = 'cliente ve su cuenta'
           and qual like '%cuentas_cliente.id%'
       ) then '✅ OK' else '❌ FALTA' end as estado;
