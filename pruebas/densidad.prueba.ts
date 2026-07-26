import test from "node:test";
import assert from "node:assert/strict";

import { DENSIDADES, DENSIDAD_POR_DEFECTO, densidad } from "@/config/diseno";
import { derivarDatosInvitacion } from "@/lib/invitacion";
import { FORMULARIOS } from "@/config/formularios";
import type { TipoEvento } from "@/lib/tipos";

/**
 * NIVEL DE ORNAMENTACIÓN
 * =======================
 * Lo que más importa fijar aquí no es lo que hace, sino lo que NO hace:
 * las invitaciones que ya existen no pueden cambiar de aspecto por haber
 * añadido este eje.
 */

test("una invitación sin nivel guardado se ve como siempre", () => {
  assert.equal(densidad(undefined), "equilibrado");
  assert.equal(densidad(""), "equilibrado");
  assert.equal(
    DENSIDAD_POR_DEFECTO,
    "equilibrado",
    "cambiar este valor cambiaría el aspecto de TODAS las invitaciones ya publicadas"
  );
});

test("un nivel inventado no rompe la invitación", () => {
  assert.equal(densidad("recontraextravagante"), "equilibrado");
  assert.equal(densidad("SOBRIO"), "equilibrado", "distingue mayúsculas a propósito");
});

test("los tres niveles se reconocen", () => {
  assert.equal(densidad("sobrio"), "sobrio");
  assert.equal(densidad("equilibrado"), "equilibrado");
  assert.equal(densidad("extravagante"), "extravagante");
});

test("el catálogo tiene los tres niveles, cada uno con su texto para el cliente", () => {
  assert.equal(DENSIDADES.length, 3);
  for (const d of DENSIDADES) {
    assert.ok(d.nombre, `${d.id} necesita nombre`);
    assert.ok(d.descripcion, `${d.id} necesita descripción para el equipo`);
    assert.ok(d.paraCliente, `${d.id} necesita cómo se le explica al cliente`);
    assert.ok(d.emoji, `${d.id} necesita emoji`);
  }
});

/* ---------- Lo que el cliente elige llega a su invitación ---------- */

test("el nivel que pide el cliente se aplica", () => {
  const { datos } = derivarDatosInvitacion(
    "boda",
    { nombres_novios: "Ana & Luis", nivel_adorno: "extravagante" },
    "18090000000",
    null
  );
  assert.equal(datos.densidad, "extravagante");
});

test("si el cliente no contesta, la invitación sale con el nivel de siempre", () => {
  const { datos } = derivarDatosInvitacion("boda", {}, "18090000000", null);
  assert.equal(datos.densidad, "equilibrado");
});

test("una respuesta antigua o corrupta no deja la invitación sin nivel", () => {
  const { datos } = derivarDatosInvitacion(
    "boda",
    { nivel_adorno: "muy_recargada" },
    "18090000000",
    null
  );
  assert.equal(datos.densidad, "equilibrado");
});

/* ---------- Coherencia entre el formulario y el sistema ---------- */

test("todo nivel que se le ofrece al cliente lo sabe aplicar el sistema", () => {
  const validos = new Set(DENSIDADES.map((d) => d.id));
  const tipos = Object.keys(FORMULARIOS) as TipoEvento[];

  for (const tipo of tipos) {
    for (const bloque of FORMULARIOS[tipo]) {
      for (const pregunta of bloque.preguntas) {
        if (pregunta.id !== "nivel_adorno") continue;
        for (const opcion of pregunta.opciones ?? []) {
          assert.ok(
            validos.has(opcion.valor as never),
            `El formulario de "${tipo}" ofrece el nivel "${opcion.valor}", que el sistema no sabe aplicar`
          );
        }
      }
    }
  }
});

test("la pregunta del adorno aparece en los formularios de todos los eventos con estilo", () => {
  const conPregunta = (Object.keys(FORMULARIOS) as TipoEvento[]).filter((tipo) =>
    FORMULARIOS[tipo].some((b) => b.preguntas.some((p) => p.id === "nivel_adorno"))
  );

  assert.deepEqual(
    conPregunta.sort(),
    ["boda", "cumpleanos", "otro"],
    "los eventos corporativos no la llevan: su diseño lo marca la identidad de la empresa"
  );
});
