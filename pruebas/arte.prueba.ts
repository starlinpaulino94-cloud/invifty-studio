import test from "node:test";
import assert from "node:assert/strict";

import {
  aplicarArte,
  coloresDePaleta,
  hayArte,
  IDS_PIEZAS,
  PIEZAS_ARTE,
  piezaMeta,
  quitarPieza,
  validarPieza,
  validarPropuestas,
  type ArteInvitacion,
} from "@/lib/ia/arte";
import { PALETAS } from "@/config/diseno";

/**
 * EL ARTE A MEDIDA
 * =================
 * La aduana del SVG (pruebas/svg.prueba.ts) dice si el documento es
 * SEGURO. Esto dice si la pieza SIRVE: que tenga la forma del hueco, que
 * use la paleta de ESA invitación y que no sea un documento válido y
 * vacío — un adorno que pasa todas las validaciones y no se ve es el peor
 * resultado posible, porque nadie se entera.
 */

const PALETA = ["#d4af37", "#0b0b0c"];

const svgDe = (viewBox: string, trazos = 3) =>
  `<svg viewBox="${viewBox}">${'<path d="M1 1 L2 2" stroke="currentColor"/>'.repeat(trazos)}</svg>`;

test("el catálogo de piezas y sus ids no se pisan", () => {
  assert.deepEqual(IDS_PIEZAS, ["monograma", "divisor", "esquina"]);
  assert.equal(new Set(IDS_PIEZAS).size, PIEZAS_ARTE.length);
  assert.equal(piezaMeta("monograma")?.proporcion, 1);
  assert.equal(piezaMeta("inventada"), null);
});

test("una pieza buena pasa con su idea recortada", () => {
  const r = validarPieza(
    { pieza: "divisor", svg: svgDe("0 0 240 40"), idea: "x".repeat(400) },
    PALETA
  );
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.pieza, "divisor");
    assert.equal(r.idea.length, 240, "la idea se recorta, no se guarda un ensayo");
  }
});

test("un divisor dibujado cuadrado se rechaza: descuadraría la invitación", () => {
  const r = validarPieza({ pieza: "divisor", svg: svgDe("0 0 100 100"), idea: "ok" }, PALETA);
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.motivo, /forma no cuadra/);
});

test("una desviación pequeña de proporción sí se acepta", () => {
  // 240x42 es 5.71:1 contra 6:1 — un divisor, no un cuadro.
  const r = validarPieza({ pieza: "divisor", svg: svgDe("0 0 240 42"), idea: "ok" }, PALETA);
  assert.equal(r.ok, true, r.ok ? "" : r.motivo);
});

test("un documento válido y vacío NO pasa: sería un adorno invisible", () => {
  const r = validarPieza({ pieza: "esquina", svg: '<svg viewBox="0 0 80 80"></svg>', idea: "ok" }, PALETA);
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.motivo, /no se vería/);
});

test("sin idea no pasa: el equipo tiene que poder elegir con criterio", () => {
  const r = validarPieza({ pieza: "esquina", svg: svgDe("0 0 80 80"), idea: "   " }, PALETA);
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.motivo, /sin explicar/);
});

test("una pieza que no existe en el catálogo no pasa", () => {
  const r = validarPieza({ pieza: "fondo_completo", svg: svgDe("0 0 80 80"), idea: "ok" }, PALETA);
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.motivo, /no existe/);
});

test("el ataque del SVG llega hasta aquí y también se para", () => {
  const r = validarPieza(
    {
      pieza: "esquina",
      svg: '<svg viewBox="0 0 80 80" onload="alert(1)"><path d="M0 0"/></svg>',
      idea: "ok",
    },
    PALETA
  );
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.motivo, /Atributo no permitido/);
});

test("un color que no es de la paleta de esa invitación no pasa", () => {
  const svg = '<svg viewBox="0 0 80 80">' + '<path d="M1 1" fill="#ff00ff"/>'.repeat(3) + "</svg>";
  const r = validarPieza({ pieza: "esquina", svg, idea: "ok" }, PALETA);
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.motivo, /no está en la paleta/);
});

test("una pieza repetida en la tanda se queda con la primera", () => {
  const rs = validarPropuestas(
    [
      { pieza: "esquina", svg: svgDe("0 0 80 80"), idea: "la buena" },
      { pieza: "esquina", svg: svgDe("0 0 80 80"), idea: "la segunda" },
    ],
    PALETA
  );
  assert.equal(rs.length, 1);
  assert.equal(rs[0].ok && rs[0].idea, "la buena");
});

/* ---------- aplicar, quitar, contar ---------- */

test("aplicar una pieza no borra las que ya estaban", () => {
  const antes: ArteInvitacion = {
    version: 1,
    divisor: { svg: "<svg/>", idea: "el de la semana pasada", generadoEn: "2026-11-01" },
  };
  const despues = aplicarArte(
    antes,
    [{ ok: true, pieza: "monograma", svg: svgDe("0 0 120 120"), idea: "nuevo" }],
    "2026-11-26"
  );
  assert.equal(despues.divisor?.idea, "el de la semana pasada", "el divisor sigue ahí");
  assert.equal(despues.monograma?.idea, "nuevo");
  assert.equal(despues.monograma?.generadoEn, "2026-11-26");
});

test("una pieza rechazada no se aplica aunque venga en la tanda", () => {
  const despues = aplicarArte(
    null,
    [
      { ok: false, pieza: "monograma", motivo: "no" },
      { ok: true, pieza: "esquina", svg: svgDe("0 0 80 80"), idea: "sí" },
    ],
    "2026-11-26"
  );
  assert.equal(despues.monograma, undefined);
  assert.ok(despues.esquina);
});

test("quitar una pieza devuelve el ornamento de la plantilla", () => {
  const arte = aplicarArte(null, [{ ok: true, pieza: "divisor", svg: svgDe("0 0 240 40"), idea: "x" }], "hoy");
  assert.equal(hayArte(arte), true);
  const sin = quitarPieza(arte, "divisor");
  assert.equal(sin.divisor, undefined);
  assert.equal(hayArte(sin), false);
});

test("sin arte, hayArte dice que no (y no revienta con null)", () => {
  assert.equal(hayArte(null), false);
  assert.equal(hayArte(undefined), false);
  assert.equal(hayArte({ version: 1 }), false);
});

/* ---------- la paleta ---------- */

test("los colores salen de la paleta real, en minúsculas y con el acento delante", () => {
  const colores = coloresDePaleta(PALETAS.dorado_negro);
  assert.equal(colores[0], "#d4af37", "el acento va primero: es el color del adorno");
  assert.ok(colores.includes("#0b0b0c"));
  assert.ok(colores.every((c) => c === c.toLowerCase()));
});

test("toda paleta del catálogo da colores usables (ninguna se queda muda)", () => {
  for (const [id, paleta] of Object.entries(PALETAS)) {
    const colores = coloresDePaleta(paleta);
    assert.ok(colores.length >= 4, `la paleta ${id} solo dio ${colores.length} colores`);
  }
});
