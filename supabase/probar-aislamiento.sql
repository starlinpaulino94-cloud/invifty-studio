-- =====================================================================
-- PROBAR EL AISLAMIENTO ENTRE CUENTAS (portal de clientes)
-- =====================================================================
-- Pega esto en Supabase → SQL Editor → Run. Crea DOS cuentas de mentira
-- (dominios @aislamiento.invifty.test), se hace pasar por cada usuario
-- con los mismos claims que usaría una sesión real, y comprueba que el
-- RLS multicuenta no deja ver NADA ajeno. Al final borra todo lo que
-- creó: tu base queda exactamente igual que antes.
--
-- Todas las filas del resultado deben decir ✅ OK. Un ❌ FUGA significa
-- que un cliente puede ver datos de otro hablando directo con la API —
-- no despliegues con eso en rojo.
--
-- Seguro de correr: todo pasa dentro de UNA transacción (el editor de
-- Supabase ejecuta el script como una sola); si algo falla a mitad, se
-- revierte entero y no queda rastro.
-- =====================================================================

-- ---------- Los resultados se acumulan aquí (temporal) ----------
create temp table resultados (orden int, que text, estado text) on commit drop;
grant select, insert on resultados to authenticated, anon;

-- ---------- Dos cuentas de mentira ----------
-- Usuarios de auth: propietario A, colaborador de A (SIN ver_pagos) y
-- propietario B. UUIDs fijos y reconocibles.
insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
   raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-00000000000a',
   'authenticated', 'authenticated', 'propietario-a@aislamiento.invifty.test', '',
   now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'ac000000-0000-4000-8000-00000000000c',
   'authenticated', 'authenticated', 'colaborador-a@aislamiento.invifty.test', '',
   now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'b0000000-0000-4000-8000-00000000000b',
   'authenticated', 'authenticated', 'propietario-b@aislamiento.invifty.test', '',
   now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

insert into public.clientes (id, nombre, telefono) values
  ('a1000000-0000-4000-8000-000000000001', 'Cliente A (prueba aislamiento)', '+18090000001'),
  ('b1000000-0000-4000-8000-000000000001', 'Cliente B (prueba aislamiento)', '+18090000002');

insert into public.cuentas_cliente (id, cliente_id, usuario_id, email, estado) values
  ('a2000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-00000000000a', 'propietario-a@aislamiento.invifty.test', 'activa'),
  ('b2000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-00000000000b', 'propietario-b@aislamiento.invifty.test', 'activa');

insert into public.miembros_cuenta (cuenta_id, usuario_id, rol, permisos, email) values
  ('a2000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-00000000000a',
   'propietario', '{}', 'propietario-a@aislamiento.invifty.test'),
  -- El colaborador de A NO tiene ver_pagos: la base debe negarle el dinero.
  ('a2000000-0000-4000-8000-000000000002', 'ac000000-0000-4000-8000-00000000000c',
   'colaborador', '{}', 'colaborador-a@aislamiento.invifty.test'),
  ('b2000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-00000000000b',
   'propietario', '{}', 'propietario-b@aislamiento.invifty.test');

insert into public.pedidos (id, cliente_id, tipo_evento, plan, precio, estado) values
  ('a3000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000001', 'boda', 'popular', 2500, 'nuevo'),
  ('b3000000-0000-4000-8000-000000000003', 'b1000000-0000-4000-8000-000000000001', 'boda', 'popular', 2500, 'nuevo');

insert into public.pagos (id, pedido_id, monto) values
  ('a4000000-0000-4000-8000-000000000004', 'a3000000-0000-4000-8000-000000000003', 1000),
  ('b4000000-0000-4000-8000-000000000004', 'b3000000-0000-4000-8000-000000000003', 1000);

insert into public.invitaciones (id, pedido_id, slug, plantilla, datos) values
  ('a5000000-0000-4000-8000-000000000005', 'a3000000-0000-4000-8000-000000000003', 'prueba-aislamiento-a', 'clasica', '{}'),
  ('b5000000-0000-4000-8000-000000000005', 'b3000000-0000-4000-8000-000000000003', 'prueba-aislamiento-b', 'clasica', '{}');

-- =====================================================================
-- AHORA, A SUPLANTAR. `set role authenticated` + los claims del JWT es
-- exactamente lo que ve el RLS cuando ese usuario entra por la API.
-- =====================================================================

-- ---------- Como PROPIETARIO de A ----------
set role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);

insert into resultados values
  (1, 'A ve su propio cliente',
   case when (select count(*) from public.clientes) = 1 then '✅ OK' else '❌ FUGA' end),
  (2, 'A NO ve el cliente de B',
   case when (select count(*) from public.clientes where id = 'b1000000-0000-4000-8000-000000000001') = 0
        then '✅ OK' else '❌ FUGA' end),
  (3, 'A ve su pedido y solo el suyo',
   case when (select count(*) from public.pedidos) = 1
         and (select count(*) from public.pedidos where id = 'a3000000-0000-4000-8000-000000000003') = 1
        then '✅ OK' else '❌ FUGA' end),
  (4, 'A (propietario) ve sus pagos',
   case when (select count(*) from public.pagos) = 1 then '✅ OK' else '❌ FALLA' end),
  (5, 'A NO ve pagos de B',
   case when (select count(*) from public.pagos where id = 'b4000000-0000-4000-8000-000000000004') = 0
        then '✅ OK' else '❌ FUGA' end),
  (6, 'A ve su invitación y no la de B',
   case when (select count(*) from public.invitaciones) = 1
         and (select count(*) from public.invitaciones where id = 'b5000000-0000-4000-8000-000000000005') = 0
        then '✅ OK' else '❌ FUGA' end),
  (7, 'A ve los miembros de SU cuenta (2)',
   case when (select count(*) from public.miembros_cuenta) = 2 then '✅ OK' else '❌ FALLA' end),
  (8, 'A NO ve la cuenta de B',
   case when (select count(*) from public.cuentas_cliente where id = 'b2000000-0000-4000-8000-000000000002') = 0
        then '✅ OK' else '❌ FUGA' end);

-- ---------- Como COLABORADOR de A (sin ver_pagos) ----------
select set_config('request.jwt.claims',
  '{"sub":"ac000000-0000-4000-8000-00000000000c","role":"authenticated"}', true);

insert into resultados values
  (9, 'El colaborador ve el pedido de su cuenta',
   case when (select count(*) from public.pedidos) = 1 then '✅ OK' else '❌ FALLA' end),
  (10, 'El colaborador SIN permiso NO ve pagos (ni por la API)',
   case when (select count(*) from public.pagos) = 0 then '✅ OK' else '❌ FUGA' end),
  (11, 'El colaborador solo ve su propia fila de miembro',
   case when (select count(*) from public.miembros_cuenta) = 1 then '✅ OK' else '❌ FUGA' end);

-- ---------- Como PROPIETARIO de B ----------
select set_config('request.jwt.claims',
  '{"sub":"b0000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);

insert into resultados values
  (12, 'B no ve nada de A (pedidos)',
   case when (select count(*) from public.pedidos where cliente_id = 'a1000000-0000-4000-8000-000000000001') = 0
        then '✅ OK' else '❌ FUGA' end);

-- ---------- Como ANÓNIMO (la clave pública del navegador) ----------
reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set role anon;

insert into resultados values
  (13, 'Un anónimo no ve pedidos ni cuentas',
   case when (select count(*) from public.pedidos) = 0
         and (select count(*) from public.cuentas_cliente) = 0
        then '✅ OK' else '❌ FUGA' end);

reset role;

-- ---------- SUSPENDER CIERRA TODO ----------
update public.cuentas_cliente set estado = 'suspendida'
 where id = 'a2000000-0000-4000-8000-000000000002';

set role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);

insert into resultados values
  (14, 'Suspendida la cuenta, A ya no ve sus pedidos',
   case when (select count(*) from public.pedidos) = 0 then '✅ OK' else '❌ FUGA' end),
  (15, 'Suspendida, A todavía ve SU cuenta (para poder decírselo)',
   case when (select count(*) from public.cuentas_cliente) = 1 then '✅ OK' else '❌ FALLA' end);

reset role;

-- ---------- LIMPIEZA TOTAL: no queda ni rastro ----------
-- clientes arrastra en cascada pedidos, pagos, invitaciones y cuentas;
-- auth.users arrastra los miembros.
delete from public.clientes where id in
  ('a1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001');
delete from auth.users where email like '%@aislamiento.invifty.test';

-- ---------- EL VEREDICTO (la única salida que enseña el editor) ----------
select orden, que, estado from resultados order by orden;
