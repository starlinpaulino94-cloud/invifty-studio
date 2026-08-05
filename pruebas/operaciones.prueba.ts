import test from "node:test";
import assert from "node:assert/strict";

import { TRANSICIONES, transicionValida, transicionesDesde } from "@/lib/estados";
import { PERMISOS, ROLES, puede, rolValido } from "@/lib/roles";
import { balancePagos, estadoCobro, montoValido, pagoActivo } from "@/lib/pagos";
import { ESTADOS } from "@/lib/planes";
import type { EstadoPedido } from "@/lib/tipos";
import type { Pago } from "@/lib/tipos";

/**
 * OPERACIONES — estados, roles y dinero
 * ======================================
 * Tres reglas que si fallan no dan error en ningún sitio: solo dejan pasar
 * un salto de estado absurdo, una acción de quien no le toca, o una suma
 * que cuenta dinero anulado. Por eso viven en funciones puras y se prueban
 * con lupa.
 */

/* ---------- Transiciones de estado ---------- */

test("los saltos absurdos se rechazan", () => {
  assert.ok(!transicionValida("vencida", "nuevo"), "un vencido no amanece nuevo");
  assert.ok(!transicionValida("nuevo", "entregada"), "no se entrega lo que no se diseñó");
  assert.ok(!transicionValida("cancelado", "activa"), "un cancelado no revive a mitad de camino");
});

test("el camino feliz completo es transitable", () => {
  const camino: EstadoPedido[] = [
    "nuevo", "formulario_enviado", "formulario_completado",
    "en_diseno", "revision_cliente", "entregada", "activa", "vencida",
  ];
  for (let i = 0; i < camino.length - 1; i++) {
    assert.ok(transicionValida(camino[i], camino[i + 1]), `${camino[i]} → ${camino[i + 1]}`);
  }
});

test("los retrocesos reales están permitidos", () => {
  assert.ok(transicionValida("en_diseno", "formulario_completado"), "faltan datos");
  assert.ok(transicionValida("entregada", "revision_cliente"), "el cliente pidió un cambio");
  assert.ok(transicionValida("vencida", "activa"), "la renovación se vende");
});

test("de casi cualquier estado se puede cancelar, y del cancelado solo se reabre", () => {
  for (const estado of Object.keys(TRANSICIONES) as EstadoPedido[]) {
    if (estado === "cancelado") continue;
    assert.ok(transicionValida(estado, "cancelado"), `${estado} debe poder cancelarse`);
  }
  assert.deepEqual(transicionesDesde("cancelado"), ["nuevo"]);
});

test("repetir el estado actual no es un cambio y no falla", () => {
  assert.ok(transicionValida("en_diseno", "en_diseno"));
});

test("cada estado de las transiciones tiene su chip en el panel", () => {
  // Si se añade un estado y se olvida el chip, el panel enseñaría el id
  // crudo. Los dos catálogos tienen que ir a la par.
  const conChip = new Set(ESTADOS.map((e) => e.id));
  for (const estado of Object.keys(TRANSICIONES)) {
    assert.ok(conChip.has(estado as EstadoPedido), `falta el chip de "${estado}"`);
  }
});

/* ---------- Roles ---------- */

test("todo rol existe en la matriz y todo permiso es de alguien", () => {
  for (const rol of ROLES) {
    assert.ok(Array.isArray(PERMISOS[rol]), `rol sin fila: ${rol}`);
  }
});

test("el reparto sensible es el acordado", () => {
  // Ventas cobra pero no publica ni anula; diseño diseña y nada más;
  // lectura mira. Anular dinero es de propietario/admin.
  assert.ok(puede("ventas", "registrar_pagos"));
  assert.ok(!puede("ventas", "publicar"));
  assert.ok(!puede("ventas", "anular_pagos"));
  assert.ok(puede("disenador", "editar_invitaciones"));
  assert.ok(!puede("disenador", "publicar"));
  assert.ok(!puede("disenador", "registrar_pagos"));
  assert.ok(!puede("lectura", "cambiar_estado"));
  assert.ok(puede("operaciones", "publicar"));
  assert.ok(!puede("operaciones", "anular_pagos"));
  assert.ok(puede("propietario", "anular_pagos"));
  assert.ok(puede("admin", "mantenimiento"));
});

test("un rol desconocido no cuela", () => {
  assert.ok(!rolValido("superadmin"));
  assert.ok(!rolValido(""));
  assert.ok(rolValido("ventas"));
});

/* ---------- Dinero ---------- */

const pago = (monto: number, extra: Partial<Pago> = {}): Pago => ({
  id: "p", pedido_id: "x", monto, metodo: null, nota: null,
  tipo: "pago", anulado_en: null, anulado_por: null, motivo_anulacion: null,
  fecha: "2026-08-01T00:00:00Z", ...extra,
});

test("un pago anulado no es dinero: el balance lo ignora", () => {
  const pagos = [pago(2000), pago(1500, { anulado_en: "2026-08-02T00:00:00Z" })];
  assert.equal(balancePagos(pagos), 2000);
  assert.ok(!pagoActivo(pagos[1]));
});

test("un reembolso resta", () => {
  assert.equal(balancePagos([pago(4000), pago(1000, { tipo: "reembolso" })]), 3000);
});

test("el estado del cobro se deriva, con tolerancia de centavos", () => {
  assert.equal(estadoCobro(2500, 0), "pendiente");
  assert.equal(estadoCobro(2500, 1000), "parcial");
  assert.equal(estadoCobro(2500, 2500), "pagado");
  assert.equal(estadoCobro(2500, 2499.995), "pagado", "20 centavos no son deuda");
});

test("los montos imposibles se rechazan antes de tocar la base", () => {
  assert.ok(!montoValido(0));
  assert.ok(!montoValido(-500));
  assert.ok(!montoValido(NaN));
  assert.ok(!montoValido(Infinity));
  assert.ok(montoValido(2500));
});
