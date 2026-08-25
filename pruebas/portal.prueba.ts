import test from "node:test";
import assert from "node:assert/strict";

import { resumenRsvp, capacidadesDelCliente, NOTA_ESTADO_CAPACIDAD } from "@/lib/portal";
import { contratoDePedido } from "@/lib/capacidades";

/**
 * LO QUE EL PORTAL LE ENSEÑA AL CLIENTE
 * ======================================
 * Los números del RSVP pagan el catering: contarlos mal cuesta dinero.
 * Y las capacidades del contrato tienen que salir con su estado honesto:
 * ni esconder lo pagado, ni pintar como botón lo que no funciona.
 */

test("el resumen del RSVP suma personas, no filas", () => {
  const r = resumenRsvp([
    { asiste: true, cantidad: 2 },
    { asiste: true, cantidad: 5 },
    { asiste: false, cantidad: 0 },
  ]);
  assert.equal(r.confirmaciones, 2);
  assert.equal(r.personas, 7);
  assert.equal(r.noVienen, 1);
});

test("una cantidad rara cuenta al menos a quien confirmó", () => {
  // Si la cantidad llega en 0 o corrupta, el que dijo "sí voy" existe:
  // contarlo como cero personas descuadraría el catering hacia abajo.
  const r = resumenRsvp([
    { asiste: true, cantidad: 0 },
    { asiste: true, cantidad: Number.NaN },
  ]);
  assert.equal(r.personas, 2);
});

test("sin confirmaciones, todo en cero", () => {
  assert.deepEqual(resumenRsvp([]), { confirmaciones: 0, personas: 0, noVienen: 0 });
});

test("los que no vienen no suman personas", () => {
  // Aunque la fila traiga una cantidad vieja, "no voy" son cero personas.
  const r = resumenRsvp([{ asiste: false, cantidad: 4 }]);
  assert.equal(r.personas, 0);
  assert.equal(r.noVienen, 1);
});

test("el cliente ve lo pagado con su estado, nunca lo apagado", () => {
  const contrato = contratoDePedido({ plan: "premium" });
  const visibles = capacidadesDelCliente(contrato);

  assert.ok(visibles.some((c) => c.id === "qr_individual"), "lo vendido sin implementar SE VE: lo pagó");
  assert.ok(visibles.every((c) => c.estado !== "no_disponible"), "lo apagado no existe para el cliente");
});

test("cada estado visible tiene su explicación (o su silencio)", () => {
  assert.equal(NOTA_ESTADO_CAPACIDAD.activa, null, "lo que funciona no necesita aclaración");
  assert.match(NOTA_ESTADO_CAPACIDAD.manual!, /equipo/, "manual explica quién lo cumple");
  assert.match(
    NOTA_ESTADO_CAPACIDAD.vendida_sin_implementar!,
    /pronto/,
    "lo pendiente promete sin fingir que ya está"
  );
});
