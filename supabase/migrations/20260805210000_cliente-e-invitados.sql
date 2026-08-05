-- =====================================================================
-- CLIENTE E INVITADOS (Etapa E de la mejora integral)
-- =====================================================================
-- Seis tablas y tres columnas que cierran el círculo con las dos
-- personas que no son del equipo:
--
--  EL CLIENTE (quien paga la invitación)
--   · versiones    — foto inmutable de la invitación en cada envío a
--                    revisión: "esto es exactamente lo que aprobaste".
--   · revisiones   — el enlace /revision/<token> con el que revisa sin
--                    cuenta: token opaco, con caducidad y revocable.
--   · comentarios  — lo que pide cambiar, por sección, con su estado.
--
--  LOS INVITADOS (quienes reciben la invitación)
--   · hogares      — "Familia Pérez, hasta 4": el cupo agrupado que las
--                    bodas reales usan, con token opaco para el enlace
--                    personal y el QR (el QR nunca lleva nombres).
--   · entradas     — el registro de la puerta el día del evento: quién
--                    entró, cuántos, quién lo anotó y a qué hora.
--
--  Y EL CORREO QUE NO SE PIERDE
--   · avisos       — bandeja de salida (outbox): cada notificación es
--                    una fila con estado e intentos. Si Resend falla,
--                    el repaso diario lo reintenta; nada se esfuma.
--
-- Repetible: correrla dos veces no daña nada.
-- =====================================================================

-- ---------- VERSIONES (fotos inmutables de la invitación) ----------

create table if not exists public.versiones (
  id            uuid primary key default gen_random_uuid(),
  invitacion_id uuid not null references public.invitaciones(id) on delete cascade,
  numero        integer not null,
  plantilla     text not null,
  datos         jsonb not null,
  codigo_html   text,
  motivo        text,
  usuario_id    uuid,
  usuario_email text,
  creado_en     timestamptz not null default now()
);

create unique index if not exists versiones_numero_idx
  on public.versiones (invitacion_id, numero);

-- Una versión que se puede corregir no prueba nada: mismo trato que el
-- historial (la función ya existe desde la migración de operaciones).
drop trigger if exists versiones_no_se_tocan on public.versiones;
create trigger versiones_no_se_tocan
  before update or delete on public.versiones
  for each row execute function public.historial_inmutable();

alter table public.versiones enable row level security;

drop policy if exists "equipo lee versiones" on public.versiones;
create policy "equipo lee versiones" on public.versiones
  for select to authenticated using (public.es_del_equipo());
drop policy if exists "equipo escribe versiones" on public.versiones;
create policy "equipo escribe versiones" on public.versiones
  for insert to authenticated with check (public.es_del_equipo());

-- ---------- REVISIONES (el enlace del cliente) ----------

create table if not exists public.revisiones (
  id            uuid primary key default gen_random_uuid(),
  invitacion_id uuid not null references public.invitaciones(id) on delete cascade,
  version_id    uuid not null references public.versiones(id) on delete cascade,
  token         text not null unique,
  estado        text not null default 'abierta'
                check (estado in ('abierta','cambios_solicitados','aprobada')),
  expira_en     timestamptz not null,
  revocada_en   timestamptz,
  aprobada_en   timestamptz,
  -- El nombre que el cliente escribe al aprobar: la evidencia de quién
  -- dijo que sí, junto con la fecha y la versión exacta.
  aprobada_por  text,
  usuario_id    uuid,
  usuario_email text,
  creado_en     timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index if not exists revisiones_invitacion_idx
  on public.revisiones (invitacion_id, creado_en desc);

drop trigger if exists revisiones_tocar on public.revisiones;
create trigger revisiones_tocar before update on public.revisiones
  for each row execute function public.tocar_actualizado_en();

alter table public.revisiones enable row level security;

drop policy if exists "equipo acceso total revisiones" on public.revisiones;
create policy "equipo acceso total revisiones" on public.revisiones
  for all to authenticated
  using (public.es_del_equipo()) with check (public.es_del_equipo());
-- El cliente NO toca la tabla: entra por /revision/<token>, que valida
-- el token en el servidor con la clave secreta.

-- ---------- COMENTARIOS (lo que el cliente pide cambiar) ----------

create table if not exists public.comentarios (
  id            uuid primary key default gen_random_uuid(),
  revision_id   uuid not null references public.revisiones(id) on delete cascade,
  seccion       text not null default 'general',
  texto         text not null,
  autor         text not null default 'cliente',
  estado        text not null default 'abierto'
                check (estado in ('abierto','en_proceso','resuelto','descartado')),
  resuelto_por  text,
  creado_en     timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index if not exists comentarios_revision_idx
  on public.comentarios (revision_id, creado_en);

drop trigger if exists comentarios_tocar on public.comentarios;
create trigger comentarios_tocar before update on public.comentarios
  for each row execute function public.tocar_actualizado_en();

alter table public.comentarios enable row level security;

drop policy if exists "equipo acceso total comentarios" on public.comentarios;
create policy "equipo acceso total comentarios" on public.comentarios
  for all to authenticated
  using (public.es_del_equipo()) with check (public.es_del_equipo());

-- ---------- HOGARES (cupo agrupado por familia) ----------

create table if not exists public.hogares (
  id            uuid primary key default gen_random_uuid(),
  invitacion_id uuid not null references public.invitaciones(id) on delete cascade,
  nombre        text not null,              -- "Familia Pérez"
  cupo          integer not null default 2 check (cupo >= 1 and cupo <= 20),
  -- Token opaco: va en el enlace personal (/i/<slug>?h=<token>) y en el
  -- QR de la puerta. NUNCA lleva nombre, teléfono ni dirección.
  token         text not null unique,
  creado_en     timestamptz not null default now()
);

-- "Familia Pérez" dos veces en la misma boda es un error de dedo.
create unique index if not exists hogares_nombre_idx
  on public.hogares (invitacion_id, lower(nombre));
create index if not exists hogares_invitacion_idx
  on public.hogares (invitacion_id);

alter table public.hogares enable row level security;

drop policy if exists "equipo acceso total hogares" on public.hogares;
create policy "equipo acceso total hogares" on public.hogares
  for all to authenticated
  using (public.es_del_equipo()) with check (public.es_del_equipo());
-- El anfitrión los gestiona desde /lista/<token>, vía rutas de servidor.

-- Un invitado puede pertenecer a un hogar; borrado el hogar, el invitado
-- queda suelto (no desaparece de la lista).
alter table public.invitados
  add column if not exists hogar_id uuid references public.hogares(id) on delete set null;

-- La confirmación recuerda por qué puerta llegó (enlace personal del
-- hogar) para poder aplicar el cupo y cruzar la recepción.
alter table public.confirmaciones
  add column if not exists hogar_id uuid references public.hogares(id) on delete set null;

-- ---------- ENTRADAS (la puerta el día del evento) ----------

create table if not exists public.entradas (
  id            uuid primary key default gen_random_uuid(),
  invitacion_id uuid not null references public.invitaciones(id) on delete cascade,
  hogar_id      uuid references public.hogares(id) on delete set null,
  -- A quién se registró, con sus palabras: "Familia Pérez" o "Juan (sin
  -- hogar)". Queda escrito aunque el hogar se borre después.
  nombre        text not null,
  personas      integer not null check (personas >= 1 and personas <= 20),
  operador      text,
  nota          text,
  -- Una entrada mal anotada se ANULA, no se borra: la puerta es historial.
  anulada_en    timestamptz,
  creado_en     timestamptz not null default now()
);

create index if not exists entradas_invitacion_idx
  on public.entradas (invitacion_id, creado_en desc);

alter table public.entradas enable row level security;

drop policy if exists "equipo acceso total entradas" on public.entradas;
create policy "equipo acceso total entradas" on public.entradas
  for all to authenticated
  using (public.es_del_equipo()) with check (public.es_del_equipo());

-- ---------- AVISOS (bandeja de salida de notificaciones) ----------

create table if not exists public.avisos (
  id             uuid primary key default gen_random_uuid(),
  tipo           text not null,     -- formulario_completado / revision_aprobada / …
  canal          text not null default 'email',
  destinatario   text not null,     -- correo del equipo (interno)
  referencia_tipo text,             -- pedido / invitacion / revision
  referencia_id  uuid,
  asunto         text not null,
  cuerpo_html    text not null,
  estado         text not null default 'pendiente'
                 check (estado in ('pendiente','enviado','fallido')),
  intentos       integer not null default 0,
  error          text,
  proveedor      text not null default 'resend',
  programado_en  timestamptz not null default now(),
  enviado_en     timestamptz,
  creado_en      timestamptz not null default now()
);

-- El repaso solo mira lo pendiente: índice parcial, no tabla entera.
create index if not exists avisos_pendientes_idx
  on public.avisos (programado_en) where estado = 'pendiente';

alter table public.avisos enable row level security;

drop policy if exists "equipo lee avisos" on public.avisos;
create policy "equipo lee avisos" on public.avisos
  for select to authenticated using (public.es_del_equipo());
-- Se escribe solo desde el servidor (clave secreta): encolar y procesar
-- no dependen de la sesión de nadie.

-- ---------- EL CANDADO DE LA APROBACIÓN ----------
-- Cuando el cliente aprueba, la invitación se bloquea contra ediciones
-- accidentales. Publicar sigue permitido (aprobar ES la luz verde);
-- editar exige desbloquear a propósito, y eso queda en auditoría.
alter table public.invitaciones
  add column if not exists bloqueada_en timestamptz;
