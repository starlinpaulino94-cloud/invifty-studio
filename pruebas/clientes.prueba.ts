import test from "node:test";
import assert from "node:assert/strict";

import {
  avisoClienteExistente,
  errorClienteDistinto,
  mismaPersona,
  nombreComparable,
} from "@/lib/clientes";

/**
 * EL CLIENTE QUE APARECÍA SOLO
 * =============================
 * Pasó de verdad: cada pedido nuevo salía a nombre de un cliente de
 * prueba. `crearPedido` reutiliza la ficha del mismo WhatsApp —correcto—
 * pero lo hacía callado. Estas pruebas fijan cuándo puede callar (es la
 * misma persona) y cuándo tiene que preguntar (no lo es).
 */

test("acentos, mayúsculas y espacios de más no hacen dos personas", () => {
  assert.equal(nombreComparable("  Camila   RODRÍGUEZ "), "camila rodriguez");
  assert.ok(mismaPersona("camila rodriguez", "Camila Rodríguez"));
  assert.ok(mismaPersona("José Peña", "jose pena"));
});

test("un apellido de más o de menos sigue siendo la misma persona", () => {
  assert.ok(mismaPersona("Camila", "Camila Rodríguez"));
  assert.ok(mismaPersona("Camila Rodríguez Pérez", "Camila Rodríguez"));
});

test("un nombre distinto NO es la misma persona: ahí hay que preguntar", () => {
  assert.equal(mismaPersona("Camila Rodríguez", "starlin prueba"), false);
  assert.equal(mismaPersona("Ana", "Andrea"), false, "parecerse no basta");
  assert.equal(mismaPersona("", "starlin prueba"), false, "sin nombre no se asume nada");
});

test("el aviso dice el nombre guardado: sin él no se puede decidir", () => {
  const aviso = avisoClienteExistente("starlin prueba");
  assert.ok(aviso.includes("starlin prueba"));
  assert.match(aviso, /corrígelo|corrigelo/i, "ofrece la salida del dedazo");
});

test("el freno del servidor dice el número, el nombre y que no se creó nada", () => {
  const err = errorClienteDistinto("starlin prueba", "18096134260");
  assert.ok(err.includes("starlin prueba"));
  assert.ok(err.includes("18096134260"));
  assert.match(err, /no se creó/i, "quien lo lee tiene que saber que no quedó a medias");
});
