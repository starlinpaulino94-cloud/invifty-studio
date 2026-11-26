import test from "node:test";
import assert from "node:assert/strict";

import { LIMITES_SVG, prefijarIds, sanearSvg } from "@/lib/ia/svg";

/**
 * LA ADUANA DEL SVG, PUESTA A PRUEBA
 * ==================================
 * Un SVG lo ejecuta el navegador, así que estas pruebas no son de estilo:
 * son el muro. Cada caso de abajo es un ataque conocido contra sitios que
 * pintan SVG de terceros. Si alguno pasa, el adorno de una boda se vuelve
 * ejecución de código en el celular de cada invitado.
 *
 * Y la otra mitad: lo bueno tiene que pasar. Una aduana que rechaza todo
 * es segura y también inútil.
 */

const BUENO =
  '<svg viewBox="0 0 100 100"><path d="M10 10 C 20 20, 40 20, 50 10 Z" fill="#d4af37"/></svg>';

const ok = (svg: string, opciones?: { coloresPermitidos?: string[] }) => {
  const r = sanearSvg(svg, opciones);
  assert.equal(r.ok, true, r.ok ? "" : `se rechazó: ${r.motivo}`);
  return r.ok ? r : (null as never);
};

const rechaza = (svg: string, razon: RegExp, opciones?: { coloresPermitidos?: string[] }) => {
  const r = sanearSvg(svg, opciones);
  assert.equal(r.ok, false, "esto TENÍA que rechazarse");
  if (!r.ok) assert.match(r.motivo, razon);
};

/* ---------- lo que tiene que pasar ---------- */

test("un adorno honesto pasa y sale reconstruido", () => {
  const r = ok(BUENO);
  assert.ok(r.svg.startsWith('<svg viewBox="0 0 100 100">'));
  assert.ok(r.svg.includes('fill="#d4af37"'));
  assert.deepEqual(r.colores, ["#d4af37"]);
  assert.equal(r.nodos, 2);
});

test("degradados, grupos y recortes con referencias internas pasan", () => {
  const r = ok(
    '<svg viewBox="0 0 200 200">' +
      '<defs><linearGradient id="oro" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0%" stop-color="#d4af37"/><stop offset="100%" stop-color="#f2d06b"/>' +
      "</linearGradient></defs>" +
      '<g transform="translate(10 10) rotate(15)" opacity="0.8">' +
      '<circle cx="50" cy="50" r="20" fill="url(#oro)"/></g></svg>'
  );
  assert.ok(r.svg.includes("url(#oro)"));
});

test("el tamaño que trae el generador se tira, no tumba el adorno", () => {
  const r = ok('<svg width="800" height="800" viewBox="0 0 10 10"><rect width="10" height="10" fill="none"/></svg>');
  assert.ok(!r.svg.includes("width=\"800\""), "el width del <svg> no puede sobrevivir");
  assert.ok(r.svg.includes('viewBox="0 0 10 10"'));
});

/* ---------- los ataques ---------- */

test("<script> no entra", () => {
  rechaza('<svg viewBox="0 0 10 10"><script>alert(1)</script></svg>', /no permitida/);
});

test("un manejador de eventos no entra, venga en la etiqueta que venga", () => {
  rechaza('<svg viewBox="0 0 10 10" onload="alert(1)"></svg>', /Atributo no permitido/);
  rechaza('<svg viewBox="0 0 10 10"><circle cx="1" cy="1" r="1" onclick="alert(1)"/></svg>', /Atributo no permitido/);
  rechaza('<svg viewBox="0 0 10 10"><path d="M0 0" onmouseover="x()"/></svg>', /Atributo no permitido/);
});

test("<foreignObject> no entra: es HTML disfrazado de dibujo", () => {
  rechaza(
    '<svg viewBox="0 0 10 10"><foreignObject><body xmlns="http://www.w3.org/1999/xhtml"><img src=x onerror="alert(1)"/></body></foreignObject></svg>',
    /no permitida/
  );
});

test("nada que cargue de fuera: <image>, <use>, xlink:href", () => {
  rechaza('<svg viewBox="0 0 10 10"><image href="https://ajeno.test/x.png"/></svg>', /no permitida/);
  rechaza('<svg viewBox="0 0 10 10"><use href="#x"/></svg>', /no permitida/);
  rechaza('<svg viewBox="0 0 10 10"><path d="M0 0" xlink:href="javascript:alert(1)"/></svg>', /Atributo no permitido/);
});

test("javascript: y data: no caben en ningún valor", () => {
  rechaza('<svg viewBox="0 0 10 10"><path d="M0 0" fill="javascript:alert(1)"/></svg>', /Valor inválido/);
  rechaza('<svg viewBox="0 0 10 10"><path d="M0 0" fill="url(data:text/html,<script>)"/></svg>', /mal formada|Valor inválido/);
});

test("style y class no entran: el color va en atributos que sabemos validar", () => {
  rechaza('<svg viewBox="0 0 10 10"><path d="M0 0" style="background:url(evil)"/></svg>', /Atributo no permitido/);
  rechaza('<svg viewBox="0 0 10 10"><style>*{x:y}</style></svg>', /no permitida/);
  rechaza('<svg viewBox="0 0 10 10"><path d="M0 0" class="x"/></svg>', /Atributo no permitido/);
});

test("las animaciones no entran (animate con values es un vector conocido)", () => {
  rechaza(
    '<svg viewBox="0 0 10 10"><rect width="1" height="1"><animate attributeName="fill" values="url(javascript:alert(1))"/></rect></svg>',
    /no permitida|no puede tener hijos|sin hijos/
  );
  rechaza('<svg viewBox="0 0 10 10"><set attributeName="onload" to="alert(1)"/></svg>', /no permitida/);
});

test("las entidades XML no entran: ahí se esconde lo prohibido", () => {
  rechaza('<svg viewBox="0 0 10 10"><path d="M0 0" fill="&#106;avascript:alert(1)"/></svg>', /entidades/);
  rechaza(
    '<!DOCTYPE svg [<!ENTITY x "y">]><svg viewBox="0 0 10 10"><path d="M0 0"/></svg>',
    /entidades|DOCTYPE/
  );
});

test("un comentario puede cerrar una etiqueta antes de tiempo: no entra", () => {
  rechaza('<svg viewBox="0 0 10 10"><!-- --><path d="M0 0"/></svg>', /DOCTYPE|comentario/);
});

test("una referencia a un id de fuera no entra", () => {
  rechaza(
    '<svg viewBox="0 0 10 10"><circle cx="1" cy="1" r="1" fill="url(#degradado-de-otra-pagina)"/></svg>',
    /no apunta a nada de dentro/
  );
});

test("un < dentro de un valor no rompe el analizador", () => {
  rechaza('<svg viewBox="0 0 10 10"><path d="M0 0" fill="#fff\\"><script>alert(1)</script>"/></svg>', /./);
});

test("un transform inventado no entra", () => {
  rechaza('<svg viewBox="0 0 10 10"><g transform="url(#x)"><path d="M0 0"/></g></svg>', /Valor inválido/);
  ok('<svg viewBox="0 0 10 10"><g transform="matrix(1 0 0 1 0 0)"><path d="M0 0"/></g></svg>');
});

/* ---------- los límites ---------- */

test("sin viewBox no se pinta: un adorno sin caja se come la pantalla", () => {
  rechaza('<svg><path d="M0 0"/></svg>', /viewBox/);
  rechaza('<svg viewBox="0 0 99999 10"><path d="M0 0"/></svg>', /Valor inválido/);
});

test("la raíz tiene que ser <svg>, y uno solo", () => {
  rechaza('<path d="M0 0"/>', /raíz/);
  rechaza('<svg viewBox="0 0 10 10"><svg viewBox="0 0 5 5"></svg></svg>', /dentro de otro/);
});

test("las etiquetas tienen que cerrar, y en orden", () => {
  rechaza('<svg viewBox="0 0 10 10"><g>', /sin cerrar/);
  rechaza('<svg viewBox="0 0 10 10"><g><defs></g></defs></svg>', /en orden/);
});

test("el tamaño, los nodos y el anidamiento tienen techo", () => {
  rechaza("x".repeat(LIMITES_SVG.caracteres + 1), /caracteres/);
  const muchos = `<svg viewBox="0 0 10 10">${'<path d="M0 0"/>'.repeat(LIMITES_SVG.nodos + 1)}</svg>`;
  rechaza(muchos, /nodos/);
  const hondo = `<svg viewBox="0 0 10 10">${"<g>".repeat(LIMITES_SVG.profundidad + 1)}${"</g>".repeat(LIMITES_SVG.profundidad + 1)}</svg>`;
  rechaza(hondo, /anidamiento/);
});

test("el texto no entra: el monograma se dibuja, no se escribe", () => {
  rechaza('<svg viewBox="0 0 10 10"><text x="0" y="0">C &amp; L</text></svg>', /entidades|no permitida/);
  rechaza('<svg viewBox="0 0 10 10">C y L</svg>', /texto/i);
});

test("un id repetido no entra: el segundo pisaría al primero", () => {
  rechaza(
    '<svg viewBox="0 0 10 10"><defs><linearGradient id="a"/><radialGradient id="a"/></defs></svg>',
    /repetido/
  );
});

/* ---------- la paleta ---------- */

test("un color fuera de la paleta de ESA invitación se rechaza", () => {
  rechaza(
    '<svg viewBox="0 0 10 10"><path d="M0 0" fill="#ff0000"/></svg>',
    /no está en la paleta/,
    { coloresPermitidos: ["#d4af37", "#0d0d0f"] }
  );
  ok('<svg viewBox="0 0 10 10"><path d="M0 0" fill="#D4AF37"/></svg>', {
    coloresPermitidos: ["#d4af37"],
  });
});

test("#abc y #aabbcc son el mismo color al comparar la paleta", () => {
  ok('<svg viewBox="0 0 10 10"><path d="M0 0" fill="#fff"/></svg>', {
    coloresPermitidos: ["#ffffff"],
  });
});

test("currentColor y none siempre valen: heredan del tema", () => {
  ok('<svg viewBox="0 0 10 10"><path d="M0 0" fill="none" stroke="currentColor"/></svg>', {
    coloresPermitidos: ["#d4af37"],
  });
});

/* ---------- ids con prefijo ---------- */

test("dos adornos en la misma página no se pisan los degradados", () => {
  const uno = prefijarIds('<svg viewBox="0 0 10 10"><defs><linearGradient id="oro"/></defs><path d="M0 0" fill="url(#oro)"/></svg>', "a1");
  assert.ok(uno.includes('id="a1-oro"'));
  assert.ok(uno.includes("url(#a1-oro)"));
  assert.ok(!uno.includes("url(#oro)"));
});

test("un prefijo con caracteres raros no puede romper el documento", () => {
  // La propiedad que importa no es cómo queda el nombre, es que poner el
  // prefijo NUNCA convierta un SVG limpio en uno que ya no lo está.
  const sucio = prefijarIds(
    '<svg viewBox="0 0 10 10"><defs><linearGradient id="oro"/></defs><path d="M0 0" fill="url(#oro)"/></svg>',
    'a"><script>'
  );
  assert.ok(!sucio.includes("<script"), "no puede aparecer una etiqueta nueva");
  assert.ok(!sucio.includes('""'), "no puede aparecer una comilla de más");
  const r = sanearSvg(sucio);
  assert.equal(r.ok, true, r.ok ? "" : `el prefijo lo rompió: ${r.motivo}`);
});
