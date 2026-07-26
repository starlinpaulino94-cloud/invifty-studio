import test from "node:test";
import assert from "node:assert/strict";

import { PALETAS, TIPOGRAFIAS } from "@/config/diseno";
import { PLANTILLAS, plantillaMeta } from "@/config/plantillas";
import { FORMULARIOS, construirFormulario } from "@/config/formularios";
import { sugerirPlantilla } from "@/lib/invitacion";
import type { TipoEvento, Plan } from "@/lib/tipos";

/**
 * COHERENCIA DEL CATÁLOGO
 * ========================
 * Estas pruebas cuidan las costuras entre el formulario y el sistema de
 * diseño. Son el tipo de fallo que no rompe el build ni salta a la vista:
 * el cliente elige algo, el sistema no sabe aplicarlo y lo cambia sin
 * avisar. Ya pasó con la paleta "Vino & Nude", que se ofrecía sin existir.
 */

const TIPOS: TipoEvento[] = ["boda", "cumpleanos", "empresarial", "otro"];
const PLANES_TODOS: Plan[] = ["esencial", "popular", "premium", "luxury"];

/** Opciones de paleta que se le ofrecen al cliente, en todos los eventos. */
function paletasOfrecidas(): { evento: string; valor: string }[] {
  const encontradas: { evento: string; valor: string }[] = [];
  for (const [evento, bloques] of Object.entries(FORMULARIOS)) {
    for (const bloque of bloques) {
      for (const pregunta of bloque.preguntas) {
        if (pregunta.id !== "paleta_colores") continue;
        for (const opcion of pregunta.opciones ?? []) {
          encontradas.push({ evento, valor: opcion.valor });
        }
      }
    }
  }
  return encontradas;
}

test("toda paleta que se le ofrece al cliente existe en el catálogo", () => {
  // "colores_marca" es la excepción declarada: no es una paleta, es una
  // petición que el equipo resuelve a mano y que queda anotada.
  const excepciones = new Set(["colores_marca"]);

  for (const { evento, valor } of paletasOfrecidas()) {
    if (excepciones.has(valor)) continue;
    assert.ok(
      valor in PALETAS,
      `El formulario de "${evento}" ofrece la paleta "${valor}", que no existe en PALETAS. ` +
        `El cliente la elegiría y recibiría otra sin enterarse.`
    );
  }
});

test("se le ofrece al cliente más de una paleta en cada tipo de evento", () => {
  for (const tipo of TIPOS) {
    const ofrecidas = paletasOfrecidas().filter((p) => p.evento === tipo);
    assert.ok(ofrecidas.length > 1, `El formulario de "${tipo}" no ofrece paletas suficientes`);
  }
});

test("cada plantilla sugiere una paleta y una tipografía que existen", () => {
  for (const plantilla of PLANTILLAS) {
    assert.ok(
      plantilla.paletaSugerida in PALETAS,
      `La plantilla "${plantilla.id}" sugiere la paleta "${plantilla.paletaSugerida}", que no existe`
    );
    assert.ok(
      plantilla.tipografiaSugerida in TIPOGRAFIAS,
      `La plantilla "${plantilla.id}" sugiere la tipografía "${plantilla.tipografiaSugerida}", que no existe`
    );
  }
});

test("sugerirPlantilla siempre devuelve una plantilla del catálogo", () => {
  const ids = new Set(PLANTILLAS.map((p) => p.id));

  // Todas las respuestas de estilo que puede dar un cliente, más los casos
  // en los que no contesta nada.
  const estilos = new Set<string>(["", "una_respuesta_que_no_existe"]);
  for (const bloques of Object.values(FORMULARIOS)) {
    for (const bloque of bloques) {
      for (const pregunta of bloque.preguntas) {
        if (!["estilo_diseno", "tema_fiesta", "tipo_evento_corp"].includes(pregunta.id)) continue;
        for (const opcion of pregunta.opciones ?? []) estilos.add(opcion.valor);
      }
    }
  }

  for (const tipo of TIPOS) {
    for (const estilo of estilos) {
      for (const campo of ["estilo_diseno", "tema_fiesta", "tipo_evento_corp"]) {
        const elegida = sugerirPlantilla(tipo, { [campo]: estilo });
        assert.ok(
          ids.has(elegida),
          `sugerirPlantilla("${tipo}", {${campo}: "${estilo}"}) devolvió "${elegida}", que no está en el catálogo`
        );
      }
    }
  }
});

test("plantillaMeta resuelve cualquier entrada, incluida la plantilla antigua", () => {
  assert.equal(plantillaMeta("clasica").id, "editorial");
  assert.equal(plantillaMeta(undefined).id, "editorial");
  assert.equal(plantillaMeta("no-existe").id, PLANTILLAS[0].id);
  assert.equal(plantillaMeta("celestial").id, "celestial");
});

test("cada plan recibe un formulario con preguntas en todos los eventos", () => {
  for (const tipo of TIPOS) {
    for (const plan of PLANES_TODOS) {
      const bloques = construirFormulario(tipo, plan);
      assert.ok(bloques.length > 0, `"${tipo}" con plan "${plan}" se queda sin bloques`);
      const preguntas = bloques.flatMap((b) => b.preguntas);
      assert.ok(preguntas.length > 0, `"${tipo}" con plan "${plan}" se queda sin preguntas`);
    }
  }
});

test("los identificadores de pregunta no se repiten dentro de un formulario", () => {
  for (const tipo of TIPOS) {
    for (const plan of PLANES_TODOS) {
      const ids = construirFormulario(tipo, plan).flatMap((b) => b.preguntas.map((p) => p.id));
      const repetidos = ids.filter((id, i) => ids.indexOf(id) !== i);
      assert.deepEqual(
        repetidos,
        [],
        `"${tipo}" con plan "${plan}" repite preguntas: ${repetidos.join(", ")}. ` +
          `Las respuestas se pisarían entre sí.`
      );
    }
  }
});
