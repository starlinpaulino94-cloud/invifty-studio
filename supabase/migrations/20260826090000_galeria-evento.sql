-- =====================================================================
-- GALERÍA COLABORATIVA DEL EVENTO (post-evento)
-- =====================================================================
-- El extra que se vendía sin existir, ahora existe: un QR/enlace en el
-- evento (/galeria/<slug>) donde los INVITADOS suben sus fotos a un
-- álbum común que vive junto a la invitación. El anfitrión la abre y la
-- cierra desde su panel (/lista) y modera: ocultar o borrar.
--
--  · fotos_galeria — una fila por foto subida por un invitado. La foto
--    va al bucket privado bajo galeria/<invitacion>/ en dos tamaños
--    (web + miniatura, como todas las fotos de la casa) y se sirve con
--    URL firmada. "oculta" la saca del álbum sin borrarla.
--  · invitaciones.galeria_abierta — el interruptor del anfitrión. Nace
--    cerrada: nadie sube nada hasta que el anfitrión (o el equipo) la
--    abre, normalmente el día del evento.
--
-- Quién la tiene: el pedido con el extra galeria_post_evento comprado o
-- con la capacidad en su contrato (Luxury). Se valida en el servidor
-- (lib/galeria.ts) — y honra los contratos viejos que la compraron
-- cuando aún decía "vendida sin implementar": la pagaron, la tienen.
--
-- Repetible: correrla dos veces no daña nada.
-- =====================================================================

create table if not exists public.fotos_galeria (
  id             uuid primary key default gen_random_uuid(),
  invitacion_id  uuid not null references public.invitaciones(id) on delete cascade,
  -- Rutas en el bucket privado (fotos-pedidos), versión web y miniatura.
  ruta           text not null,
  miniatura_ruta text not null,
  -- El nombre que el invitado quiso dejar (opcional; sin cuenta, como todo).
  autor          text,
  estado         text not null default 'visible'
                 check (estado in ('visible','oculta')),
  creado_en      timestamptz not null default now()
);

create index if not exists fotos_galeria_invitacion_idx
  on public.fotos_galeria (invitacion_id, creado_en desc);

alter table public.invitaciones
  add column if not exists galeria_abierta boolean not null default false;

-- ---------- RLS ----------
-- Los INVITADOS no tocan la tabla: suben y ven por /galeria/<slug>, que
-- valida en el servidor con la clave secreta (igual que el RSVP).

alter table public.fotos_galeria enable row level security;

drop policy if exists "equipo acceso total galeria" on public.fotos_galeria;
create policy "equipo acceso total galeria" on public.fotos_galeria
  for all to authenticated
  using (public.es_del_equipo()) with check (public.es_del_equipo());

-- El cliente ve las fotos de SU galería desde el portal (solo lectura).
drop policy if exists "cliente ve su galeria" on public.fotos_galeria;
create policy "cliente ve su galeria" on public.fotos_galeria
  for select to authenticated using (public.es_mi_invitacion(invitacion_id));

-- ---------- COMPROBACIÓN ----------

select 'tabla fotos_galeria' as que,
       case when exists (select 1 from information_schema.tables
                         where table_schema = 'public' and table_name = 'fotos_galeria')
            then '✅ OK' else '❌ FALTA' end as estado
union all
select 'invitaciones.galeria_abierta',
       case when exists (select 1 from information_schema.columns
                         where table_schema = 'public' and table_name = 'invitaciones'
                           and column_name = 'galeria_abierta')
            then '✅ OK' else '❌ FALTA' end
union all
select 'políticas de la galería (2)',
       case when (select count(*) from pg_policies
                  where schemaname = 'public' and tablename = 'fotos_galeria') >= 2
            then '✅ OK' else '❌ FALTA' end;
