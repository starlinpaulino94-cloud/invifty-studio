import test from "node:test";
import assert from "node:assert/strict";

import {
  lineaTotal,
  resumenAportes,
  sanearCuentasRegalo,
  tieneMesaRegalos,
  validarAporte,
  MAX_CUENTAS_REGALO,
} from "@/lib/regalos";
import { contratoDePedido } from "@/lib/capacidades";

/**
 * LA MESA DE REGALOS
 * ===================
 * Lo que se cuida: que el monto sea de verdad OPCIONAL (presionar por la
 * cifra sería de mal gusto), que las cuentas del anfitrión entren
 * saneadas, y que el total no mienta — ni sume lo oculto ni esconda que
 * hay regalos sin cifra.
 */

test("la tienen Premium y Luxury por contrato; Esencial y Popular no", () => {
  assert.equal(tieneMesaRegalos(contratoDePedido({ plan: "premium" })), true);
  assert.equal(tieneMesaRegalos(contratoDePedido({ plan: "luxury" })), true);
  assert.equal(tieneMesaRegalos(contratoDePedido({ plan: "esencial" })), false);
  assert.equal(tieneMesaRegalos(contratoDePedido({ plan: "popular" })), false);
});

test("el monto es opcional de verdad; el nombre no", () => {
  const sinMonto = validarAporte({ nombre: "Tía Rosa", monto: "" });
  assert.equal(sinMonto.ok, true);
  assert.equal((sinMonto as { monto: number | null }).monto, null);

  const sinNombre = validarAporte({ nombre: " ", monto: "1000" });
  assert.equal(sinNombre.ok, false);
});

test("un monto raro se rechaza; uno con centavos sobrevive redondeado", () => {
  assert.equal(validarAporte({ nombre: "Ana", monto: "-50" }).ok, false);
  assert.equal(validarAporte({ nombre: "Ana", monto: "abc" }).ok, false);
  assert.equal(validarAporte({ nombre: "Ana", monto: "2000000" }).ok, false, "un millón+ es un typo");
  const v = validarAporte({ nombre: "Ana", monto: "1500.559" });
  assert.equal((v as { monto: number }).monto, 1500.56);
});

test("las cuentas del anfitrión entran saneadas o no entran", () => {
  const limpias = sanearCuentasRegalo([
    { banco: "Banreservas", numero: "123", titular: "Ana", documento: "001-000", basura: "x" },
    { banco: "Popular", numero: "", titular: "Ana" }, // sin número: no es cuenta
    "no soy un objeto",
    { banco: "BHD", numero: "456", titular: "Luis" },
    { banco: "Scotiabank", numero: "789", titular: "Ana" },
    { banco: "Extra", numero: "999", titular: "Sobra" }, // 4ta válida: fuera por tope
  ]);
  // La basura NO gasta el cupo: entran las 3 primeras VÁLIDAS.
  assert.equal(limpias.length, MAX_CUENTAS_REGALO);
  assert.deepEqual(limpias.map((c) => c.banco), ["Banreservas", "BHD", "Scotiabank"]);
  assert.deepEqual(Object.keys(limpias[0]).sort(), ["banco", "documento", "numero", "titular"]);
  assert.equal(sanearCuentasRegalo("basura").length, 0);
  assert.equal(sanearCuentasRegalo(null).length, 0);
});

test("el total es honesto: no suma lo oculto y cuenta los sin cifra", () => {
  const resumen = resumenAportes([
    { monto: 2000, estado: "visible" },
    { monto: null, estado: "visible" },
    { monto: 5000, estado: "oculta" }, // oculto: fuera del total y del conteo
    { monto: 1500.5, estado: "visible" },
  ]);
  assert.equal(resumen.regalos, 3);
  assert.equal(resumen.totalDeclarado, 3500.5);
  assert.equal(resumen.sinMonto, 1);

  const linea = lineaTotal(resumen);
  assert.match(linea, /3 regalos/);
  assert.match(linea, /RD\$ 3,500\.5/);
  assert.match(linea, /1 sin monto/);
});
