import test from "node:test";
import assert from "node:assert/strict";

import { validarReporte, mensajeWhatsAppCobro, NOMBRE_ESTADO_REPORTE } from "@/lib/cobro";

/**
 * EL COBRO POR TRANSFERENCIA GUIADO
 * ==================================
 * El dinero es donde menos se perdona un número flojo. Lo que se cuida:
 * que un reporte sin nada que cruzar con el banco no entre, y que el
 * mensaje del saldo diga el número correcto.
 */

test("un reporte necesita algo que cruzar con el banco", () => {
  // Con comprobante basta; sin comprobante, la referencia es obligatoria.
  assert.equal(validarReporte({ monto: 1000, tieneComprobante: true }).ok, true);
  assert.equal(
    validarReporte({ monto: 1000, referencia: "REF-123", tieneComprobante: false }).ok,
    true
  );
  const sinNada = validarReporte({ monto: 1000, tieneComprobante: false });
  assert.equal(sinNada.ok, false);
  assert.match((sinNada as { error: string }).error, /comprobante|referencia/i);
});

test("el monto se valida como dinero, no como texto", () => {
  assert.equal(validarReporte({ monto: 0, tieneComprobante: true }).ok, false);
  assert.equal(validarReporte({ monto: -500, tieneComprobante: true }).ok, false);
  assert.equal(validarReporte({ monto: "abc", tieneComprobante: true }).ok, false);
  assert.equal(
    validarReporte({ monto: 2_000_000, tieneComprobante: true }).ok,
    false,
    "un monto absurdo se rechaza antes de confundir a nadie"
  );
  // Los centavos sobreviven redondeados a 2 decimales.
  const conCentavos = validarReporte({ monto: "1500.559", tieneComprobante: true });
  assert.equal(conCentavos.ok, true);
  assert.equal((conCentavos as { monto: number }).monto, 1500.56);
});

test("la referencia entra recortada y vacía se vuelve null", () => {
  const v = validarReporte({ monto: 100, referencia: `  ${"x".repeat(100)}  `, tieneComprobante: true });
  assert.equal(v.ok, true);
  assert.equal((v as { referencia: string }).referencia!.length, 60);

  const vacia = validarReporte({ monto: 100, referencia: "   ", tieneComprobante: true });
  assert.equal(vacia.ok, true);
  assert.equal((vacia as { referencia: string | null }).referencia, null);
});

test("el mensaje de cobro lleva el saldo formateado y el enlace", () => {
  const msj = mensajeWhatsAppCobro("María Pérez", 2500, "https://x/pagar/tok");
  assert.ok(msj.includes("María"));
  assert.ok(msj.includes("RD$ 2,500"), "el saldo va en pesos formateados");
  assert.ok(msj.includes("https://x/pagar/tok"));
  assert.ok(!/contraseña/i.test(msj), "un mensaje de cobro no habla de contraseñas");
});

test("cada estado del reporte tiene su nombre para el cliente", () => {
  assert.deepEqual(Object.keys(NOMBRE_ESTADO_REPORTE).sort(), [
    "confirmado", "pendiente", "rechazado",
  ]);
});
