import test from "node:test";
import assert from "node:assert/strict";

import { validarConcepto, validarConceptos } from "@/lib/ia/esquema";
import { derivarBrief, semillaDeBrief } from "@/lib/ia/brief";
import { proveedorMock } from "@/lib/ia/mock";
import { aplicarConcepto } from "@/lib/ia/aplicar";
import { similitud, avisosDeParecido, UMBRAL_PARECIDO } from "@/lib/ia/huella";
import type { BriefCreativo, ConceptoCreativo } from "@/lib/ia/tipos";
import type { DatosInvitacion } from "@/lib/tipos";

/**
 * EL PIPELINE CREATIVO
 * =====================
 * Dos promesas sostienen todo: la IA solo elige DENTRO del catálogo real
 * (un id alucinado se rechaza, no se corrige a escondidas), y los DATOS
 * FACTUALES son intocables — un concepto no puede ni mencionar la fecha,
 * y aplicar un concepto no puede mover un lugar ni un teléfono. Si
 * cualquiera de las dos falla, no da error en ningún sitio: solo aparece
 * una invitación con la dirección equivocada. Por eso viven aquí.
 */

const conceptoValido: ConceptoCreativo = {
  nombre: "Gala clásica",
  idea: "Serif romana y dorados medidos.",
  plantilla: "editorial",
  paleta: "dorado_negro",
  tipografia: "clasica_real",
  densidad: "equilibrado",
  copy: { subtitulo: "¡Nos casamos!", frase: "Una frase de portada." },
};

/* ---------- La aduana ---------- */

test("un concepto del catálogo real pasa", () => {
  const r = validarConcepto(conceptoValido);
  assert.ok(r.ok);
});

test("una plantilla alucinada se rechaza, no se corrige a escondidas", () => {
  const r = validarConcepto({ ...conceptoValido, plantilla: "minimalista_zen" });
  assert.ok(!r.ok);
  if (!r.ok) assert.match(r.error, /minimalista_zen/);
});

test("una paleta o tipografía inventada tampoco cuela", () => {
  assert.ok(!validarConcepto({ ...conceptoValido, paleta: "arcoiris" }).ok);
  assert.ok(!validarConcepto({ ...conceptoValido, tipografia: "comic_sans" }).ok);
  assert.ok(!validarConcepto({ ...conceptoValido, densidad: "maximalista" }).ok);
});

test("la plantilla de código propio está vetada para la IA", () => {
  // "codigo" significa HTML libre: exactamente lo que este pipeline evita.
  assert.ok(!validarConcepto({ ...conceptoValido, plantilla: "codigo" }).ok);
});

test("un concepto que intenta tocar datos factuales se rechaza ENTERO", () => {
  for (const campo of ["fechaEvento", "lugares", "rsvp", "whatsapp", "fechaLimite"]) {
    const r = validarConcepto({ ...conceptoValido, [campo]: "lo que sea" });
    assert.ok(!r.ok, `dejó pasar "${campo}"`);
  }
  // También escondido dentro del copy:
  const r = validarConcepto({
    ...conceptoValido,
    copy: { subtitulo: "Hola", fechaEvento: "2027-01-01" },
  });
  assert.ok(!r.ok);
});

test("los textos desbordados se recortan, no revientan", () => {
  const r = validarConcepto({
    ...conceptoValido,
    copy: { frase: "x".repeat(1000) },
  });
  assert.ok(r.ok);
  if (r.ok) assert.ok(r.concepto.copy.frase!.length <= 220);
});

test("la tanda exige exactamente tres", () => {
  assert.ok(!validarConceptos([conceptoValido]).ok);
  assert.ok(!validarConceptos([conceptoValido, conceptoValido, conceptoValido, conceptoValido]).ok);
  assert.ok(validarConceptos([conceptoValido, conceptoValido, conceptoValido]).ok);
});

/* ---------- El brief ---------- */

const datosBase: DatosInvitacion = {
  titulo: "Camila & Lucas",
  subtitulo: "¡Nos casamos!",
  frase: "",
  fechaEvento: "2026-12-12",
  horaEvento: "17:30",
  lugares: [{ nombre: "Ceremonia", detalle: "Iglesia X, Santo Domingo" }],
  dressCode: "formal",
  paleta: "dorado_negro",
  historia: "Nos conocimos en abril…",
  cronograma: [],
  regalos: [],
  rsvp: { whatsapp: "18092693214", fechaLimite: "2026-11-15", acompanantes: true },
  secciones: { historia: true, galeria: true, cronograma: false, regalos: false, rsvp: true },
};

test("el brief NO lleva teléfono, fecha ni lugares: lo que no viaja no se filtra", () => {
  const brief = derivarBrief("boda", "premium", datosBase, "editorial", true);
  const json = JSON.stringify(brief);
  assert.ok(!json.includes("18092693214"), "viajó el teléfono");
  assert.ok(!json.includes("2026-12-12"), "viajó la fecha");
  assert.ok(!json.includes("Iglesia"), "viajó el lugar");
  assert.ok(!json.includes("Nos conocimos"), "viajó la historia literal");
  assert.equal(brief.tieneHistoria, true);
});

test("la semilla es determinista y cambia con el intento", () => {
  const brief = derivarBrief("boda", "premium", datosBase, "editorial", true);
  assert.equal(semillaDeBrief(brief, 1), semillaDeBrief(brief, 1));
  assert.notEqual(semillaDeBrief(brief, 1), semillaDeBrief(brief, 2));
});

/* ---------- El mock ---------- */

function briefDe(tipo: BriefCreativo["tipoEvento"]): BriefCreativo {
  return derivarBrief(tipo, "popular", datosBase, "editorial", true);
}

test("el mock produce tres conceptos que pasan la aduana, para cada tipo de evento", async () => {
  for (const tipo of ["boda", "cumpleanos", "empresarial", "otro"] as const) {
    const r = await proveedorMock.generarConceptos(briefDe(tipo), 1);
    const v = validarConceptos(r.conceptos);
    assert.ok(v.ok, `el mock de "${tipo}" no pasó su propia aduana`);
  }
});

test("los tres conceptos del mock son de verdad distintos", async () => {
  const { conceptos } = await proveedorMock.generarConceptos(briefDe("boda"), 1);
  for (let i = 0; i < 3; i++) {
    for (let j = i + 1; j < 3; j++) {
      assert.ok(
        similitud(conceptos[i], conceptos[j]) < UMBRAL_PARECIDO,
        `"${conceptos[i].nombre}" y "${conceptos[j].nombre}" son casi iguales`
      );
    }
  }
});

test("mismo brief y mismo intento = misma propuesta; regenerar propone distinto", async () => {
  const a = await proveedorMock.generarConceptos(briefDe("boda"), 1);
  const b = await proveedorMock.generarConceptos(briefDe("boda"), 1);
  assert.deepEqual(a.conceptos, b.conceptos, "no es determinista");

  const c = await proveedorMock.generarConceptos(briefDe("boda"), 2);
  assert.notDeepEqual(a.conceptos, c.conceptos, "regenerar no cambió nada");
});

test("el mock no gasta ni un token y lo declara", async () => {
  const r = await proveedorMock.generarConceptos(briefDe("boda"), 1);
  assert.equal(r.costoEstimadoUsd, 0);
  assert.equal(r.proveedor, "mock");
});

/* ---------- Aplicar (la lista blanca) ---------- */

test("aplicar un concepto JAMÁS toca los datos factuales", () => {
  const { datos } = aplicarConcepto(datosBase, conceptoValido, "todo");
  assert.equal(datos.fechaEvento, datosBase.fechaEvento);
  assert.equal(datos.horaEvento, datosBase.horaEvento);
  assert.deepEqual(datos.lugares, datosBase.lugares);
  assert.deepEqual(datos.rsvp, datosBase.rsvp);
  assert.deepEqual(datos.regalos, datosBase.regalos);
  assert.equal(datos.historia, datosBase.historia, "la historia del cliente es suya");
});

test("modo estilo cambia el vestido y deja los textos", () => {
  const { datos, plantilla } = aplicarConcepto(datosBase, conceptoValido, "estilo");
  assert.equal(plantilla, "editorial");
  assert.equal(datos.paleta, "dorado_negro");
  assert.equal(datos.subtitulo, datosBase.subtitulo, "tocó los textos en modo estilo");
});

test("modo textos cambia el copy y deja el vestido", () => {
  const original = { ...datosBase, paleta: "bosque_crema" };
  const { datos, plantilla } = aplicarConcepto(original, conceptoValido, "textos");
  assert.equal(plantilla, undefined, "tocó la plantilla en modo textos");
  assert.equal(datos.paleta, "bosque_crema");
  assert.equal(datos.subtitulo, "¡Nos casamos!");
});

test("un copy vacío no borra lo escrito", () => {
  const sinCopy: ConceptoCreativo = { ...conceptoValido, copy: {} };
  const { datos } = aplicarConcepto(datosBase, sinCopy, "todo");
  assert.equal(datos.subtitulo, datosBase.subtitulo);
});

/* ---------- La huella ---------- */

test("dos conceptos iguales dan similitud 1 y generan aviso", () => {
  assert.equal(similitud(conceptoValido, { ...conceptoValido }), 1);
  const avisos = avisosDeParecido([conceptoValido, { ...conceptoValido, nombre: "Otro" }, {
    ...conceptoValido, nombre: "Tercero", plantilla: "moderna", paleta: "blanco_negro", tipografia: "moderna",
  }]);
  assert.equal(avisos.length, 1);
  assert.match(avisos[0], /se parecen demasiado/);
});
