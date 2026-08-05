-- =====================================================================
-- ESCALA (Etapa F de la mejora integral)
-- =====================================================================
-- 1. EL FRENO COMPARTIDO. El rate limiter de lib/limite.ts vive en la
--    memoria de cada instancia de Vercel: frena el bucle casero, pero
--    diez instancias son diez contadores. Esta tabla + función son el
--    contador ÚNICO: una operación atómica en Postgres que todas las
--    instancias comparten. No sustituye al freno local (que es gratis y
--    corta antes), lo respalda donde el local no llega.
--
-- 2. Índice para el tablero (ordena pedidos por fecha de creación).
--
-- Repetible: correrla dos veces no daña nada.
-- =====================================================================

-- ---------- EL FRENO COMPARTIDO ----------

create table if not exists public.frenos (
  clave     text primary key,          -- "leads:1.2.3.4" — ruta + IP, sin más
  cuenta    integer not null default 0,
  expira_en timestamptz not null
);

-- La limpieza del cron borra lo caducado por aquí.
create index if not exists frenos_expira_idx on public.frenos (expira_en);

alter table public.frenos enable row level security;
-- Sin políticas a propósito: SOLO el servidor (service_role) la toca.
-- Las claves llevan IPs: nadie del navegador tiene por qué verlas.

/**
 * Cuenta una petición y decide, EN UNA SOLA operación atómica:
 * dos peticiones simultáneas desde dos instancias no pueden colarse
 * entre el "leer" y el "escribir" porque no hay leer y escribir — hay
 * un solo upsert con la decisión dentro.
 */
create or replace function public.frenar(p_clave text, p_max integer, p_ventana_s integer)
returns table (permitido boolean, espera_s integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_fila public.frenos%rowtype;
begin
  insert into public.frenos as f (clave, cuenta, expira_en)
  values (p_clave, 1, now() + make_interval(secs => p_ventana_s))
  on conflict (clave) do update
    set cuenta = case when f.expira_en <= now() then 1 else f.cuenta + 1 end,
        expira_en = case when f.expira_en <= now()
                         then now() + make_interval(secs => p_ventana_s)
                         else f.expira_en end
  returning f.* into v_fila;

  return query select
    v_fila.cuenta <= p_max,
    case when v_fila.cuenta <= p_max then 0
         else greatest(1, ceil(extract(epoch from (v_fila.expira_en - now())))::integer)
    end;
end $$;

-- Nadie desde el navegador: ni anónimos ni autenticados. Solo el
-- servidor con la clave secreta (service_role se salta el revoke).
revoke all on function public.frenar(text, integer, integer) from public, anon, authenticated;

-- ---------- ÍNDICE DEL TABLERO ----------

create index if not exists pedidos_creado_idx
  on public.pedidos (creado_en desc);
