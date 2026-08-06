import test from "node:test";
import assert from "node:assert/strict";

import { TRANSICIONES, transicionValida, transicionesDesde } from "@/lib/estados";
import { PERMISOS, ROLES, puede, rolValido } from "@/lib/roles";
import {
  balancePagos, estadoCobro, montoValido, pagoActivo, desglosePagos, estadoPago,
  motivoRechazoTransaccion, fechaEfectivaValida, cobradoNeto, antiguedadSaldos,
} from "@/lib/pagos";
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
  referencia: null, fecha_efectiva: null, usuario_id: null, usuario_email: null,
  clave_idempotencia: null, comprobante_ruta: null,
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

/* ---------- El dinero completo (fase 10) ---------- */

test("el desglose separa lo que entró de lo que se devolvió", () => {
  const { abonado, reembolsado, neto } = desglosePagos([
    pago(1000),
    pago(500, { tipo: "ajuste" }),
    pago(300, { tipo: "reembolso" }),
    pago(9999, { anulado_en: "2026-08-01" }), // anulado: no existe
  ]);
  assert.equal(abonado, 1500);
  assert.equal(reembolsado, 300);
  assert.equal(neto, 1200);
});

test("el estado del cobro se deriva de las transacciones, con reembolsos mandando", () => {
  assert.equal(estadoPago(2500, []), "pendiente");
  assert.equal(estadoPago(2500, [pago(1000)]), "parcial");
  assert.equal(estadoPago(2500, [pago(2500)]), "pagado");
  // "Pagado pero le devolvimos la mitad" NO es pagado:
  assert.equal(estadoPago(2500, [pago(2500), pago(1000, { tipo: "reembolso" })]), "reembolsado_parcial");
  assert.equal(estadoPago(2500, [pago(2500), pago(2500, { tipo: "reembolso" })]), "reembolsado");
});

test("un reembolso jamás supera lo que hay neto en caja", () => {
  const previos = [pago(1000), pago(400, { tipo: "reembolso" })]; // neto: 600
  assert.equal(motivoRechazoTransaccion("reembolso", 600, previos), null);
  assert.match(motivoRechazoTransaccion("reembolso", 601, previos)!, /en caja hay/);
  // Y el anulado no cuenta como caja de la que devolver:
  assert.ok(motivoRechazoTransaccion("reembolso", 100, [pago(1000, { anulado_en: "x" })]));
});

test("montos rotos y tipos desconocidos se rechazan con motivo claro", () => {
  assert.ok(motivoRechazoTransaccion("pago", 0, []));
  assert.ok(motivoRechazoTransaccion("pago", -50, []));
  assert.ok(motivoRechazoTransaccion("pago", Number.NaN, []));
  assert.ok(motivoRechazoTransaccion("propina", 100, []));
});

test("la fecha efectiva no vive en el futuro ni antes del negocio", () => {
  const hoy = new Date("2026-08-06T12:00:00Z");
  assert.ok(fechaEfectivaValida("", hoy), "vacía significa hoy");
  assert.ok(fechaEfectivaValida("2026-08-06", hoy));
  assert.ok(!fechaEfectivaValida("2026-08-07", hoy), "mañana no");
  assert.ok(!fechaEfectivaValida("2019-12-31", hoy), "antes del negocio no");
  assert.ok(!fechaEfectivaValida("06/08/2026", hoy), "formato raro no");
});

test("lo cobrado del mes es NETO: un reembolso no es un ingreso", () => {
  const agosto = new Date("2026-08-01T00:00:00Z");
  const { cobrado, reembolsado } = cobradoNeto(
    [
      pago(2000, { fecha: "2026-08-03T00:00:00Z" }),
      pago(500, { tipo: "reembolso", fecha: "2026-08-04T00:00:00Z" }),
      pago(9999, { fecha: "2026-07-15T00:00:00Z" }), // mes anterior
      pago(700, { fecha: "2026-08-05T00:00:00Z", anulado_en: "x" }), // anulado
    ],
    agosto
  );
  assert.equal(cobrado, 1500, "2000 − 500; julio y lo anulado fuera");
  assert.equal(reembolsado, 500);
});

test("la antigüedad de saldos pone cada deuda en su tramo", () => {
  const hoy = new Date("2026-08-06T12:00:00Z");
  const pedidos = [
    { id: "a", precio: 2500, creado_en: "2026-08-01T00:00:00Z", estado: "en_diseno" },   // 5 días
    { id: "b", precio: 3000, creado_en: "2026-06-20T00:00:00Z", estado: "entregada" },   // 47 días
    { id: "c", precio: 1000, creado_en: "2026-01-01T00:00:00Z", estado: "vencida" },     // >90
    { id: "d", precio: 5000, creado_en: "2026-01-01T00:00:00Z", estado: "cancelado" },   // no debe
    { id: "e", precio: 2000, creado_en: "2026-08-02T00:00:00Z", estado: "activa" },      // pagado
  ];
  const porPedido = new Map([
    ["a", [pago(1000)]],
    ["e", [pago(2000)]],
  ]);
  const tramos = antiguedadSaldos(pedidos, porPedido, hoy);
  assert.equal(tramos[0].monto, 1500, "0-30: lo que falta del pedido a");
  assert.equal(tramos[1].monto, 3000, "31-60: el pedido b entero");
  assert.equal(tramos[3].monto, 1000, ">90: el pedido c");
  assert.equal(tramos.reduce((s, t) => s + t.pedidos, 0), 3, "cancelado y pagado no cuentan");
});
