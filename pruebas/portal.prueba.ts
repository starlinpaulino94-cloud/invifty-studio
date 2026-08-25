import test from "node:test";
import assert from "node:assert/strict";

import { readFileSync } from "node:fs";
import path from "node:path";

import {
  resumenRsvp,
  capacidadesDelCliente,
  NOTA_ESTADO_CAPACIDAD,
  ACCIONES_PORTAL,
  describirActividad,
  haceCuanto,
} from "@/lib/portal";
import { contratoDePedido } from "@/lib/capacidades";
import { construirAviso } from "@/lib/avisos";
import { PERMISOS_COLABORADOR } from "@/lib/cuentas";

/**
 * LO QUE EL PORTAL LE ENSEÑA AL CLIENTE
 * ======================================
 * Los números del RSVP pagan el catering: contarlos mal cuesta dinero.
 * Y las capacidades del contrato tienen que salir con su estado honesto:
 * ni esconder lo pagado, ni pintar como botón lo que no funciona.
 */

test("el resumen del RSVP suma personas, no filas", () => {
  const r = resumenRsvp([
    { asiste: true, cantidad: 2 },
    { asiste: true, cantidad: 5 },
    { asiste: false, cantidad: 0 },
  ]);
  assert.equal(r.confirmaciones, 2);
  assert.equal(r.personas, 7);
  assert.equal(r.noVienen, 1);
});

test("una cantidad rara cuenta al menos a quien confirmó", () => {
  // Si la cantidad llega en 0 o corrupta, el que dijo "sí voy" existe:
  // contarlo como cero personas descuadraría el catering hacia abajo.
  const r = resumenRsvp([
    { asiste: true, cantidad: 0 },
    { asiste: true, cantidad: Number.NaN },
  ]);
  assert.equal(r.personas, 2);
});

test("sin confirmaciones, todo en cero", () => {
  assert.deepEqual(resumenRsvp([]), { confirmaciones: 0, personas: 0, noVienen: 0 });
});

test("los que no vienen no suman personas", () => {
  // Aunque la fila traiga una cantidad vieja, "no voy" son cero personas.
  const r = resumenRsvp([{ asiste: false, cantidad: 4 }]);
  assert.equal(r.personas, 0);
  assert.equal(r.noVienen, 1);
});

test("el cliente ve lo pagado con su estado, nunca lo apagado", () => {
  const contrato = contratoDePedido({ plan: "premium" });
  const visibles = capacidadesDelCliente(contrato);

  assert.ok(visibles.some((c) => c.id === "qr_individual"), "lo vendido sin implementar SE VE: lo pagó");
  assert.ok(visibles.every((c) => c.estado !== "no_disponible"), "lo apagado no existe para el cliente");
});

/* ---------- La actividad del portal en el tablero (Fase 6) ---------- */

test("toda acción del portal que se registra tiene su frase en el tablero", () => {
  // Si una acción de servidor registra en auditoría una acción cuenta:*
  // o *:*_cliente que no está en ACCIONES_PORTAL, el tablero la ignora
  // en silencio y el equipo no se entera. La lista y el código se
  // comparan aquí para que no se separen.
  const raiz = path.resolve(import.meta.dirname, "..");
  const codigo =
    readFileSync(path.join(raiz, "src/lib/acciones-cuentas.ts"), "utf8") +
    readFileSync(path.join(raiz, "src/lib/acciones-portal.ts"), "utf8");
  // Solo las acciones cuyo ACTOR es el cliente: los inserts directos de
  // auditoría (accion: "…") y las llamadas a auditarPortal. Lo que firma
  // el equipo (registrarAccion) es trabajo del panel, no del portal.
  const registradas = [
    ...codigo.matchAll(/accion: "([a-z_:]+)"/g),
    ...codigo.matchAll(/auditarPortal\(quien, "([a-z_:]+)"/g),
  ].map((m) => m[1]);

  assert.ok(registradas.length >= 6, "el escaneo de acciones dejó de encontrar el código");
  for (const accion of new Set(registradas)) {
    assert.ok(
      accion in ACCIONES_PORTAL,
      `la acción "${accion}" se registra pero el tablero no sabe contarla`
    );
  }
});

test("describirActividad habla en cristiano y calla lo que no es del portal", () => {
  const fila = { accion: "cuenta:activar", usuario_email: "ana@x.com", creado_en: "2026-08-25T10:00:00Z" };
  assert.equal(describirActividad(fila), "ana@x.com activó su portal");
  assert.equal(
    describirActividad({ ...fila, usuario_email: null }),
    "Alguien activó su portal",
    "sin correo no se inventa uno"
  );
  assert.equal(
    describirActividad({ ...fila, accion: "pedido:crear" }),
    null,
    "las acciones del equipo no son actividad del portal"
  );
});

test("haceCuanto redondea hacia lo humano", () => {
  const ahora = new Date("2026-08-25T12:00:00Z");
  assert.equal(haceCuanto("2026-08-25T11:59:40Z", ahora), "ahora mismo");
  assert.equal(haceCuanto("2026-08-25T11:15:00Z", ahora), "hace 45 min");
  assert.equal(haceCuanto("2026-08-25T09:00:00Z", ahora), "hace 3 h");
  assert.equal(haceCuanto("2026-08-24T11:00:00Z", ahora), "hace 1 día");
  assert.equal(haceCuanto("2026-08-20T11:00:00Z", ahora), "hace 5 días");
});

test("los avisos nuevos del portal tienen asunto propio y escapan el nombre", () => {
  const ctx = { nombre: "Ana <script>", rutaPanel: "/panel/clientes", urlBase: "https://x.com" };
  assert.match(construirAviso("portal_activado", ctx).asunto, /activó su portal/);
  assert.match(construirAviso("portal_colaborador", ctx).asunto, /Colaborador/);
  assert.match(construirAviso("portal_textos", ctx).asunto, /textos/);
  assert.match(construirAviso("portal_password", ctx).asunto, /recuperación/);
  for (const tipo of ["portal_activado", "portal_textos", "portal_password"] as const) {
    assert.ok(!construirAviso(tipo, ctx).cuerpo_html.includes("<script>"), `${tipo} coló HTML`);
  }
});

/* ---------- El manual de operación no se queda atrás (Fase 8) ---------- */

test("el manual del portal documenta cada permiso y cada aviso", () => {
  // docs/portal-clientes.md es lo que el equipo consulta. Si el código
  // gana un permiso o un aviso y el manual no lo menciona, el equipo
  // opera a ciegas — esta prueba los mantiene pegados.
  const raiz = path.resolve(import.meta.dirname, "..");
  const manual = readFileSync(path.join(raiz, "docs/portal-clientes.md"), "utf8");

  for (const { id } of PERMISOS_COLABORADOR) {
    assert.ok(manual.includes(`\`${id}\``), `el manual no menciona el permiso ${id}`);
  }
  for (const seccion of [
    "Portal activado",
    "Colaborador activado",
    "Textos editados",
    "Contraseña restablecida",
    "probar-aislamiento.sql",
    "Nunca se envía una contraseña",
    "Suspender no borra nada",
  ]) {
    assert.ok(manual.includes(seccion), `el manual perdió la sección "${seccion}"`);
  }
});

test("cada estado visible tiene su explicación (o su silencio)", () => {
  assert.equal(NOTA_ESTADO_CAPACIDAD.activa, null, "lo que funciona no necesita aclaración");
  assert.match(NOTA_ESTADO_CAPACIDAD.manual!, /equipo/, "manual explica quién lo cumple");
  assert.match(
    NOTA_ESTADO_CAPACIDAD.vendida_sin_implementar!,
    /pronto/,
    "lo pendiente promete sin fingir que ya está"
  );
});
