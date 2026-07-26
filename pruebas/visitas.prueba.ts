import test from "node:test";
import assert from "node:assert/strict";

import { huellaDeVisita, horaTruncada, ipDeCabecera, resumirVisitas } from "@/lib/visitas";

/**
 * CONTEO DE VISITAS
 * ==================
 * Dos cosas que tienen que cumplirse: que el número sea honesto (recargar
 * no cuenta de más) y que la huella no permita seguir a nadie.
 */

const INVITACION_A = "11111111-1111-1111-1111-111111111111";
const INVITACION_B = "22222222-2222-2222-2222-222222222222";
const NAVEGADOR = "Mozilla/5.0 (iPhone)";

test("el mismo dispositivo produce la misma huella en la misma invitación", () => {
  const a = huellaDeVisita(INVITACION_A, "190.80.1.5", NAVEGADOR);
  const b = huellaDeVisita(INVITACION_A, "190.80.1.5", NAVEGADOR);
  assert.equal(a, b, "sin esto no se podrían contar personas distintas");
});

test("la misma persona NO se puede seguir entre invitaciones", () => {
  const enA = huellaDeVisita(INVITACION_A, "190.80.1.5", NAVEGADOR);
  const enB = huellaDeVisita(INVITACION_B, "190.80.1.5", NAVEGADOR);
  assert.notEqual(enA, enB, "la huella no puede ser un identificador transversal");
});

test("dispositivos distintos producen huellas distintas", () => {
  const uno = huellaDeVisita(INVITACION_A, "190.80.1.5", NAVEGADOR);
  const otraIp = huellaDeVisita(INVITACION_A, "190.80.1.6", NAVEGADOR);
  const otroNavegador = huellaDeVisita(INVITACION_A, "190.80.1.5", "Mozilla/5.0 (Android)");
  assert.notEqual(uno, otraIp);
  assert.notEqual(uno, otroNavegador);
});

test("la huella no deja ver la IP", () => {
  const huella = huellaDeVisita(INVITACION_A, "190.80.1.5", NAVEGADOR);
  assert.doesNotMatch(huella, /190\.80\.1\.5/);
  assert.match(huella, /^[0-9a-f]{32}$/, "debe ser un hash, no datos en claro");
});

test("la hora se redondea hacia abajo, para que recargar no cuente de más", () => {
  assert.equal(horaTruncada(new Date("2026-02-14T17:42:31.500Z")), "2026-02-14T17:00:00.000Z");
  assert.equal(horaTruncada(new Date("2026-02-14T17:59:59.999Z")), "2026-02-14T17:00:00.000Z");
  // Una hora más tarde sí es una apertura nueva
  assert.notEqual(
    horaTruncada(new Date("2026-02-14T18:00:00.000Z")),
    horaTruncada(new Date("2026-02-14T17:00:00.000Z"))
  );
});

test("se toma la IP del visitante, no la de los intermediarios", () => {
  assert.equal(ipDeCabecera("190.80.1.5, 10.0.0.1, 172.16.0.1", null), "190.80.1.5");
  assert.equal(ipDeCabecera("  190.80.1.5  ", null), "190.80.1.5");
  assert.equal(ipDeCabecera(null, "190.80.1.9"), "190.80.1.9");
  assert.equal(ipDeCabecera(null, null), "desconocida");
  assert.equal(ipDeCabecera("", "190.80.1.9"), "190.80.1.9");
});

test("una invitación sin visitas no inventa números", () => {
  assert.deepEqual(resumirVisitas([]), {
    aperturas: 0,
    personas: 0,
    primera: null,
    ultima: null,
    ultimos7Dias: 0,
  });
});

test("el resumen distingue aperturas de personas", () => {
  const resumen = resumirVisitas(
    [
      { huella: "aaa", creado_en: "2026-02-01T10:00:00.000Z" },
      { huella: "aaa", creado_en: "2026-02-01T11:00:00.000Z" },
      { huella: "aaa", creado_en: "2026-02-09T12:00:00.000Z" },
      { huella: "bbb", creado_en: "2026-02-10T09:00:00.000Z" },
    ],
    new Date("2026-02-11T00:00:00.000Z")
  );

  assert.equal(resumen.aperturas, 4, "cada fila es una apertura");
  assert.equal(resumen.personas, 2, "dos dispositivos distintos");
  assert.equal(resumen.primera, "2026-02-01T10:00:00.000Z");
  assert.equal(resumen.ultima, "2026-02-10T09:00:00.000Z");
  assert.equal(resumen.ultimos7Dias, 2, "solo las del 9 y el 10 entran en la ventana");
});

test("el resumen no depende del orden en que lleguen las filas", () => {
  const filas = [
    { huella: "bbb", creado_en: "2026-02-10T09:00:00.000Z" },
    { huella: "aaa", creado_en: "2026-02-01T10:00:00.000Z" },
  ];
  const resumen = resumirVisitas(filas, new Date("2026-02-11T00:00:00.000Z"));
  assert.equal(resumen.primera, "2026-02-01T10:00:00.000Z");
  assert.equal(resumen.ultima, "2026-02-10T09:00:00.000Z");
});
