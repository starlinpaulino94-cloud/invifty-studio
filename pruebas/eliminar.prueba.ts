import test from "node:test";
import assert from "node:assert/strict";

import { CONFIRMACION_ELIMINAR, confirmacionCorrecta, queSeLleva } from "@/lib/eliminar";
import { puede, ROLES } from "@/lib/roles";

/**
 * BORRAR PARA SIEMPRE
 * ====================
 * Si estas reglas fallan, no hay papelera de la que recuperar nada: o
 * alguien borra un pedido con un click distraído, o alguien que no es
 * el propietario borra la historia comercial del negocio.
 */

test("la confirmación se escribe exacta, no parecida", () => {
  assert.equal(confirmacionCorrecta(CONFIRMACION_ELIMINAR), true);
  assert.equal(confirmacionCorrecta("  ELIMINAR  "), true, "los espacios no invalidan");
  assert.equal(confirmacionCorrecta("eliminar"), false, "en minúsculas no vale: hay que leerlo");
  assert.equal(confirmacionCorrecta("ELIMINA"), false);
  assert.equal(confirmacionCorrecta(""), false);
});

test("eliminar_datos es SOLO del propietario", () => {
  // Borrar es irreversible: si mañana otro rol lo gana, tiene que ser
  // un commit a la matriz que esta prueba obligue a mirar dos veces.
  for (const rol of ROLES) {
    assert.equal(
      puede(rol, "eliminar_datos"),
      rol === "propietario",
      `el rol ${rol} ${rol === "propietario" ? "debe" : "NO debe"} poder eliminar datos`
    );
  }
});

test("editar fichas es trabajo diario: los roles que capturan, corrigen", () => {
  for (const rol of ["propietario", "admin", "ventas", "operaciones"] as const) {
    assert.equal(puede(rol, "editar_fichas"), true, `${rol} debe poder corregir fichas`);
  }
  for (const rol of ["disenador", "lectura"] as const) {
    assert.equal(puede(rol, "editar_fichas"), false, `${rol} no captura datos: no corrige fichas`);
  }
});

test("el resumen de lo que se lleva dice la verdad completa", () => {
  const piezas = queSeLleva({
    pagos: 2, fotos: 15, invitados: 80, confirmaciones: 1, tieneInvitacion: true,
  });
  assert.equal(piezas.length, 5);
  assert.ok(piezas.some((p) => p.includes("2 pagos")));
  assert.ok(piezas.some((p) => p.includes("15 fotos")));
  assert.ok(piezas.some((p) => p.includes("invitación publicada")));
  assert.ok(piezas.some((p) => p.includes("80 invitados")));
  assert.ok(piezas.some((p) => p.includes("1 confirmación")), "el singular no dice 'confirmaciónes'");
});

test("un pedido vacío no inventa pérdidas", () => {
  assert.deepEqual(
    queSeLleva({ pagos: 0, fotos: 0, invitados: 0, confirmaciones: 0, tieneInvitacion: false }),
    []
  );
});
