-- =====================================================================
-- COBRO POR TRANSFERENCIA GUIADO
-- =====================================================================
-- Hoy cada cobro es una conversación: el equipo manda los datos del
-- banco, el cliente transfiere y manda una captura, el equipo la busca
-- en el chat y registra el pago a mano. Esta migración le da al dinero
-- un camino con barandillas:
--
--  · pedidos.token_cobro — el enlace de cobro del pedido (/pagar/<token>),
--    opaco y de larga vida como el del formulario. El equipo lo genera
--    desde la ficha y lo manda por WhatsApp con el saldo.
--  · pagos_reportados — lo que el CLIENTE dice que pagó: monto,
--    referencia y comprobante (bucket privado). NO es un pago: es un
--    reporte que el equipo CONFIRMA (se vuelve fila de `pagos`, con
--    idempotencia para no duplicar) o RECHAZA con motivo. El balance
--    solo se mueve con pagos confirmados — la verdad la sigue teniendo
--    el banco y quien lo mira.
--
-- Repetible: correrla dos veces no daña nada.
-- =====================================================================

alter table public.pedidos
  add column if not exists token_cobro text unique;

create table if not exists public.pagos_reportados (
  id               uuid primary key default gen_random_uuid(),
  pedido_id        uuid not null references public.pedidos(id) on delete cascade,
  monto            numeric(10,2) not null check (monto > 0),
  -- Número de transferencia/confirmación que el cliente dice tener.
  referencia       text,
  -- Captura del comprobante en el bucket privado (comprobantes/<pedido>/).
  comprobante_ruta text,
  nota             text,
  estado           text not null default 'pendiente'
                   check (estado in ('pendiente','confirmado','rechazado')),
  motivo_rechazo   text,
  revisado_en      timestamptz,
  revisado_por_email text,
  creado_en        timestamptz not null default now()
);

create index if not exists pagos_reportados_pedido_idx
  on public.pagos_reportados (pedido_id, creado_en desc);
-- El tablero pregunta "¿cuántos pendientes hay?" en cada visita.
create index if not exists pagos_reportados_pendientes_idx
  on public.pagos_reportados (creado_en) where estado = 'pendiente';

-- ---------- RLS ----------
-- El cliente reporta por /pagar/<token> (servidor con clave secreta);
-- desde su portal puede VER sus reportes y en qué quedaron.

alter table public.pagos_reportados enable row level security;

drop policy if exists "equipo acceso total pagos reportados" on public.pagos_reportados;
create policy "equipo acceso total pagos reportados" on public.pagos_reportados
  for all to authenticated
  using (public.es_del_equipo()) with check (public.es_del_equipo());

drop policy if exists "cliente ve sus pagos reportados" on public.pagos_reportados;
create policy "cliente ve sus pagos reportados" on public.pagos_reportados
  for select to authenticated
  using (public.es_mi_pedido(pedido_id) and public.mi_permiso('ver_pagos'));

-- ---------- COMPROBACIÓN ----------

select 'tabla pagos_reportados' as que,
       case when exists (select 1 from information_schema.tables
                         where table_schema = 'public' and table_name = 'pagos_reportados')
            then '✅ OK' else '❌ FALTA' end as estado
union all
select 'pedidos.token_cobro',
       case when exists (select 1 from information_schema.columns
                         where table_schema = 'public' and table_name = 'pedidos'
                           and column_name = 'token_cobro')
            then '✅ OK' else '❌ FALTA' end
union all
select 'políticas de pagos reportados (2)',
       case when (select count(*) from pg_policies
                  where schemaname = 'public' and tablename = 'pagos_reportados') >= 2
            then '✅ OK' else '❌ FALTA' end;
