-- ============================================================
-- INVIFTY STUDIO — Esquema de base de datos (Supabase / Postgres)
-- Ejecutar completo en: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- ---------- CLIENTES ----------
create table public.clientes (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  telefono    text not null,            -- WhatsApp, ej: 18092693214
  email       text,
  como_nos_conocio text,                -- instagram / referido / google / otro
  creado_en   timestamptz not null default now()
);

create unique index clientes_telefono_idx on public.clientes (telefono);

-- ---------- PEDIDOS ----------
create table public.pedidos (
  id            uuid primary key default gen_random_uuid(),
  cliente_id    uuid not null references public.clientes(id) on delete cascade,
  tipo_evento   text not null check (tipo_evento in ('boda','cumpleanos','empresarial','otro')),
  plan          text not null check (plan in ('esencial','popular','premium','luxury')),
  extras        text[] not null default '{}',   -- ej: {bilingue, dominio_propio, galeria_post_evento, urgente_24h}
  fecha_evento  date,
  estado        text not null default 'nuevo' check (estado in (
                  'nuevo','formulario_enviado','formulario_completado',
                  'en_diseno','revision_cliente','entregada','activa','vencida')),
  precio        numeric(10,2) not null default 0,   -- precio acordado (DOP)
  url_entregada text,                                -- URL de la invitación publicada
  fecha_entrega date,                                -- cuándo se entregó (base del vencimiento)
  fecha_vencimiento date,                            -- calculada al entregar según el plan
  notas         text,
  creado_en     timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index pedidos_cliente_idx on public.pedidos (cliente_id);
create index pedidos_estado_idx  on public.pedidos (estado);

-- ---------- PAGOS (abonos) ----------
-- El "monto abonado" del pedido es la suma de sus pagos; así queda
-- historial de cada abono con fecha y método.
create table public.pagos (
  id         uuid primary key default gen_random_uuid(),
  pedido_id  uuid not null references public.pedidos(id) on delete cascade,
  monto      numeric(10,2) not null,
  metodo     text,                     -- transferencia / efectivo / zelle / paypal / tarjeta
  nota       text,
  fecha      timestamptz not null default now()
);

create index pagos_pedido_idx on public.pagos (pedido_id);

-- ---------- FORMULARIOS ----------
create table public.formularios (
  id              uuid primary key default gen_random_uuid(),
  pedido_id       uuid not null references public.pedidos(id) on delete cascade,
  token           text not null unique,        -- link público: /f/<token>
  estado          text not null default 'pendiente'
                  check (estado in ('pendiente','en_progreso','completado')),
  respuestas      jsonb not null default '{}'::jsonb,
  fecha_completado timestamptz,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now()
);

create index formularios_pedido_idx on public.formularios (pedido_id);

-- ---------- Trigger de actualizado_en ----------
create or replace function public.tocar_actualizado_en()
returns trigger language plpgsql as $$
begin
  new.actualizado_en = now();
  return new;
end $$;

create trigger pedidos_tocar before update on public.pedidos
  for each row execute function public.tocar_actualizado_en();
create trigger formularios_tocar before update on public.formularios
  for each row execute function public.tocar_actualizado_en();

-- ---------- Seguridad (RLS) ----------
-- El panel entra como usuario autenticado (acceso total).
-- El formulario público NUNCA toca la base de datos directamente:
-- pasa por las rutas API del servidor, que usan la service_role key.
alter table public.clientes     enable row level security;
alter table public.pedidos      enable row level security;
alter table public.pagos        enable row level security;
alter table public.formularios  enable row level security;

create policy "equipo acceso total clientes" on public.clientes
  for all to authenticated using (true) with check (true);
create policy "equipo acceso total pedidos" on public.pedidos
  for all to authenticated using (true) with check (true);
create policy "equipo acceso total pagos" on public.pagos
  for all to authenticated using (true) with check (true);
create policy "equipo acceso total formularios" on public.formularios
  for all to authenticated using (true) with check (true);

-- ---------- Storage (fotos de los clientes) ----------
-- Bucket privado; las subidas y descargas pasan por el servidor.
insert into storage.buckets (id, name, public)
values ('fotos-pedidos', 'fotos-pedidos', false)
on conflict (id) do nothing;

create policy "equipo lee fotos" on storage.objects
  for select to authenticated using (bucket_id = 'fotos-pedidos');
