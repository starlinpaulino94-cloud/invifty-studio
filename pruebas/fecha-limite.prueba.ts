import test from "node:test";
import assert from "node:assert/strict";

import { hoyEnRD, fechaVencida } from "@/lib/fechas";

/**
 * EL CIERRE DEL RSVP
 * ===================
 * "Confirma antes del 15" tiene que admitir el 15 entero, contado en la
 * hora de Santo Domingo. El error fácil es comparar contra el hoy de UTC:
 * a las 10 de la noche dominicana ya es mañana en UTC, y el formulario se
 * cerraría dos horas antes en su último día — justo cuando más gente
 * confirma a última hora.
 */

test("el día límite cuenta entero", () => {
  // Mediodía en RD (16:00 UTC) del propio día límite: abierto.
  const mediodia = new Date("2026-11-15T16:00:00Z");
  assert.equal(fechaVencida("2026-11-15", mediodia), false);
});

test("a las 10pm de RD del día límite sigue abierto, aunque en UTC ya sea mañana", () => {
  // 2026-11-16T02:00Z son las 22:00 del 15 en Santo Domingo.
  const nocheRD = new Date("2026-11-16T02:00:00Z");
  assert.equal(hoyEnRD(nocheRD), "2026-11-15");
  assert.equal(fechaVencida("2026-11-15", nocheRD), false);
});

test("pasada la medianoche dominicana, se cierra", () => {
  // 2026-11-16T04:30Z son las 00:30 del 16 en Santo Domingo.
  const madrugada = new Date("2026-11-16T04:30:00Z");
  assert.equal(hoyEnRD(madrugada), "2026-11-16");
  assert.equal(fechaVencida("2026-11-15", madrugada), true);
});

test("días después, sigue cerrado", () => {
  assert.equal(fechaVencida("2026-11-15", new Date("2026-12-01T12:00:00Z")), true);
});

test("sin fecha límite no hay cierre", () => {
  // La fecha límite es opcional: sin ella el RSVP queda abierto siempre.
  assert.equal(fechaVencida("", new Date("2030-01-01T00:00:00Z")), false);
});

test("una fecha futura no cierra nada", () => {
  assert.equal(fechaVencida("2026-11-15", new Date("2026-11-01T12:00:00Z")), false);
});
