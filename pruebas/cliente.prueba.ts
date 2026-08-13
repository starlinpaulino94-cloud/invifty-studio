import test from "node:test";
import assert from "node:assert/strict";

import {
  estadoDeRevision,
  puedeDecidir,
  fechaExpiracion,
  tokenOpaco,
  seccionValida,
  REVISION_DIAS_VIGENCIA,
  comentarioValido,
  REFERENCIA_TIPOS,
  type RevisionVigencia,
} from "@/lib/revision";
import {
  codigoCorto,
  estadoPuerta,
  buscarHogar,
  personasValidas,
  type EntradaRegistrada,
} from "@/lib/checkin";
import { construirAviso, debeReintentar, MAX_INTENTOS } from "@/lib/avisos";
import { sanearPreguntas, validarRespuestas, PREGUNTAS_PREDEFINIDAS } from "@/lib/rsvp";

/**
 * CLIENTE E INVITADOS (Etapa E)
 * ==============================
 * Aquí se prueba lo que, si falla, no da error en ninguna pantalla:
 * un enlace de revisión que sigue vivo después de revocado, una
 * aprobación que se esfuma al caducar el enlace, una familia contada
 * dos veces en la puerta, o un aviso interno que filtra un teléfono.
 */

/* ---------- El estado real de una revisión ---------- */

const ahora = new Date("2026-08-05T12:00:00Z");

function revision(cambios: Partial<RevisionVigencia> = {}): RevisionVigencia {
  return {
    estado: "abierta",
    expira_en: "2026-09-01T00:00:00Z",
    revocada_en: null,
    ...cambios,
  };
}

test("una revisión viva y sin decidir está abierta y acepta decisión", () => {
  assert.equal(estadoDeRevision(revision(), ahora), "abierta");
  assert.ok(puedeDecidir(revision(), ahora));
});

test("revocada gana a todo: incluso a una aprobación", () => {
  const r = revision({ estado: "aprobada", revocada_en: "2026-08-01T00:00:00Z" });
  assert.equal(estadoDeRevision(r, ahora), "revocada");
  assert.ok(!puedeDecidir(r, ahora));
});

test("un enlace caducado no decide nada", () => {
  const r = revision({ expira_en: "2026-08-05T11:59:59Z" });
  assert.equal(estadoDeRevision(r, ahora), "expirada");
  assert.ok(!puedeDecidir(r, ahora));
});

test("la aprobación hecha a tiempo sobrevive a la caducidad del enlace", () => {
  // El cliente aprobó el día 10; el enlace murió el 20. La evidencia queda.
  const r = revision({ estado: "aprobada", expira_en: "2026-07-20T00:00:00Z" });
  assert.equal(estadoDeRevision(r, ahora), "aprobada");
  assert.ok(!puedeDecidir(r, ahora), "aprobada no se decide dos veces");
});

test("cambios solicitados tampoco se decide dos veces", () => {
  const r = revision({ estado: "cambios_solicitados" });
  assert.equal(estadoDeRevision(r, ahora), "cambios_solicitados");
  assert.ok(!puedeDecidir(r, ahora));
});

test("el enlace caduca a los 30 días, ni antes ni nunca", () => {
  const expira = new Date(fechaExpiracion(ahora));
  const dias = (expira.getTime() - ahora.getTime()) / (24 * 60 * 60 * 1000);
  assert.equal(dias, REVISION_DIAS_VIGENCIA);
});

test("el token es opaco: largo, hex y sin datos de nadie", () => {
  const t = tokenOpaco();
  assert.match(t, /^[0-9a-f]{32}$/);
  assert.notEqual(t, tokenOpaco(), "dos tokens iguales sería catastrófico");
});

test("las secciones comentables son las de la invitación, no texto libre", () => {
  assert.ok(seccionValida("portada"));
  assert.ok(seccionValida("general"));
  assert.ok(!seccionValida("javascript:alert(1)"));
  assert.ok(!seccionValida(""));
});

/* ---------- La puerta (check-in) ---------- */

const entradas: EntradaRegistrada[] = [
  { hogar_id: "perez", personas: 3, anulada_en: null },
  { hogar_id: "perez", personas: 1, anulada_en: null }, // la abuela llegó después
  { hogar_id: "perez", personas: 2, anulada_en: "2026-08-05" }, // anotada por error
  { hogar_id: "gomez", personas: 2, anulada_en: null },
];

test("el conteo de la puerta suma solo las entradas no anuladas del hogar", () => {
  const e = estadoPuerta(entradas, "perez", 4);
  assert.equal(e.dentro, 4, "3 + 1, la anulada no cuenta");
  assert.ok(e.yaEntro);
});

test("más gente que cupo avisa, no bloquea", () => {
  const e = estadoPuerta(entradas, "perez", 3);
  assert.ok(e.aviso, "debía avisar");
  assert.match(e.aviso!, /esperaban 3/);
});

test("la segunda llegada del mismo hogar avisa de reingreso", () => {
  const e = estadoPuerta(entradas, "gomez", 4);
  assert.equal(e.dentro, 2);
  assert.match(e.aviso ?? "", /ya registró entrada/);
});

test("un hogar que no ha llegado no tiene aviso", () => {
  const e = estadoPuerta(entradas, "rodriguez", 5);
  assert.equal(e.dentro, 0);
  assert.equal(e.aviso, null);
});

const hogares = [
  { id: "1", nombre: "Familia Pérez", token: "a1b2c3d4e5f6a7b8" },
  { id: "2", nombre: "Familia Gómez", token: "a1b2ffffffffffff" },
  { id: "3", nombre: "Los primos de Ana", token: "9999888877776666" },
];

test("la búsqueda de la puerta encuentra por código corto y por nombre", () => {
  assert.equal(buscarHogar(hogares, "999988")[0].id, "3");
  assert.equal(buscarHogar(hogares, "pérez").length, 1);
  assert.equal(buscarHogar(hogares, "primos")[0].id, "3");
});

test("un código corto ambiguo devuelve TODAS las coincidencias", () => {
  // "a1b2" es prefijo de dos tokens: el operador elige, no el azar.
  assert.equal(buscarHogar(hogares, "a1b2").length, 2);
});

test("consultas vacías o de una letra no devuelven media boda", () => {
  assert.equal(buscarHogar(hogares, "").length, 0);
  assert.equal(buscarHogar(hogares, "a").length, 0);
});

test("el código corto es tecleable: corto y en mayúsculas", () => {
  assert.equal(codigoCorto("a1b2c3d4e5f6"), "A1B2C3");
});

test("las personas de una entrada quedan entre 1 y 20, y nunca NaN", () => {
  assert.equal(personasValidas("3"), 3);
  assert.equal(personasValidas(0), 1);
  assert.equal(personasValidas(99), 20);
  assert.equal(personasValidas("mucha gente"), 1);
});

/* ---------- Los avisos (outbox) ---------- */

test("el aviso escapa el HTML: un cliente llamado <script> no ejecuta nada", () => {
  const { asunto, cuerpo_html } = construirAviso("revision_aprobada", {
    nombre: 'Joyería "Pérez & Hijos" <script>',
    rutaPanel: "/panel/invitaciones/abc",
    urlBase: "https://studio.invifty.com",
  });
  assert.ok(!cuerpo_html.includes("<script>"), "coló el <script>");
  assert.ok(cuerpo_html.includes("&lt;script&gt;"));
  assert.ok(cuerpo_html.includes("https://studio.invifty.com/panel/invitaciones/abc"));
  assert.match(asunto, /aprobó/);
});

test("cada tipo de aviso tiene su asunto y su botón", () => {
  const ctx = { nombre: "Camila", rutaPanel: "/panel", urlBase: "https://x.com" };
  assert.match(construirAviso("formulario_completado", ctx).asunto, /Formulario/);
  assert.match(construirAviso("revision_cambios", ctx).asunto, /cambios/);
  assert.match(construirAviso("comentario_nuevo", ctx).asunto, /Comentario/);
});

test("el detalle del aviso también se escapa", () => {
  const { cuerpo_html } = construirAviso("revision_cambios", {
    nombre: "Ana",
    detalle: "<img onerror=x>",
    rutaPanel: "/p",
    urlBase: "https://x.com",
  });
  assert.ok(!cuerpo_html.includes("<img"));
});

test("los reintentos se agotan a los 5, no antes ni infinitos", () => {
  assert.ok(debeReintentar(0));
  assert.ok(debeReintentar(MAX_INTENTOS - 1));
  assert.ok(!debeReintentar(MAX_INTENTOS));
  assert.ok(!debeReintentar(MAX_INTENTOS + 3));
});

/* ---------- Las preguntas extra del RSVP ---------- */

test("sanear preguntas acota todo: cantidad, textos, opciones e ids únicos", () => {
  const limpias = sanearPreguntas([
    { id: "menu", texto: "¿Qué menú prefieren?", tipo: "opciones", opciones: ["Res", "Pollo"] },
    { texto: "  ¿Necesitan   transporte?  ", tipo: "texto" },
    { id: "menu", texto: "Otra con id repetido", tipo: "texto" },
    { texto: "x", tipo: "texto" },                            // demasiado corta
    { texto: "¿Opción única?", tipo: "opciones", opciones: ["Sí"] }, // 1 opción no es pregunta
    { texto: "y".repeat(500), tipo: "texto" },                // se recorta
    "basura",
  ]);
  assert.equal(limpias.length, 4);
  assert.equal(limpias[1].texto, "¿Necesitan transporte?");
  assert.notEqual(limpias[0].id, limpias[2].id, "ids repetidos se distinguen");
  assert.ok(limpias[3].texto.length <= 120);
});

test("más de 5 preguntas no entran: cada campo de más espanta confirmaciones", () => {
  const muchas = Array.from({ length: 9 }, (_, i) => ({
    texto: `¿Pregunta número ${i}?`,
    tipo: "texto" as const,
  }));
  assert.equal(sanearPreguntas(muchas).length, 5);
});

test("la respuesta del invitado se valida contra la configuración REAL", () => {
  const preguntas = sanearPreguntas([
    { id: "menu", texto: "¿Menú?", tipo: "opciones", opciones: ["Res", "Pollo"] },
    { id: "alergias", texto: "¿Alergias?", tipo: "texto" },
  ]);
  const limpias = validarRespuestas(preguntas, {
    menu: "Pollo",
    alergias: "maní",
    menu_falso: "lo que sea",          // id desconocido: fuera
    __proto__: "veneno",
  });
  assert.deepEqual(limpias, { menu: "Pollo", alergias: "maní" });
});

test("una opción inventada se descarta, no se corrige a escondidas", () => {
  const preguntas = sanearPreguntas([
    { id: "menu", texto: "¿Menú?", tipo: "opciones", opciones: ["Res", "Pollo"] },
  ]);
  assert.deepEqual(validarRespuestas(preguntas, { menu: "Langosta" }), {});
});

test("los textos del invitado se recortan y lo vacío no se guarda", () => {
  const preguntas = sanearPreguntas([{ id: "alergias", texto: "¿Alergias?", tipo: "texto" }]);
  const limpias = validarRespuestas(preguntas, { alergias: "z".repeat(1000) });
  assert.equal(limpias.alergias.length, 200);
  assert.deepEqual(validarRespuestas(preguntas, { alergias: "   " }), {});
  assert.deepEqual(validarRespuestas(preguntas, null), {});
  assert.deepEqual(validarRespuestas(preguntas, "basura"), {});
});

test("los atajos predefinidos pasan su propio saneo", () => {
  assert.equal(sanearPreguntas(PREGUNTAS_PREDEFINIDAS).length, PREGUNTAS_PREDEFINIDAS.length);
});

/* ---------- La imagen de referencia del comentario ---------- */

test("un comentario vale con texto O con imagen; vacío del todo, no", () => {
  assert.ok(comentarioValido("La portada más clara", false));
  assert.ok(comentarioValido("", true), "una imagen sola es un comentario legítimo");
  assert.ok(comentarioValido("  ", true));
  assert.ok(!comentarioValido("", false));
  assert.ok(!comentarioValido("x", false), "una letra no dice nada");
});

test("las referencias son imágenes, no cualquier archivo", () => {
  assert.equal(REFERENCIA_TIPOS["image/jpeg"], "jpg");
  assert.equal(REFERENCIA_TIPOS["image/webp"], "webp");
  assert.equal(REFERENCIA_TIPOS["application/pdf"], undefined, "un PDF no es una referencia visual");
  assert.equal(REFERENCIA_TIPOS["text/html"], undefined);
});
