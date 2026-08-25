import test from "node:test";
import assert from "node:assert/strict";

import {
  snapshotDeContrato,
  contratoDePedido,
  estadoDeCapacidad,
  puede,
  limite,
  exigirCapacidad,
} from "@/lib/capacidades";
import { CATALOGO } from "@/lib/planes";

/**
 * EL SERVICIO DE CAPACIDADES
 * ===========================
 * Estas pruebas cuidan el contrato congelado: que la foto capture el
 * catálogo del momento, que un catálogo cambiado NO reescriba contratos
 * viejos, que una foto corrupta no tumbe nada, y que el guard del
 * servidor diga la verdad según el estado de cada capacidad. Si esto
 * falla, un cliente pierde algo que pagó — o gana algo que no pagó.
 */

const AHORA = new Date("2026-08-14T12:00:00Z");

test("la foto captura el catálogo del momento", () => {
  const foto = snapshotDeContrato("popular", AHORA);

  assert.equal(foto.plan, "popular");
  assert.equal(foto.congelado_en, "2026-08-14T12:00:00.000Z");
  assert.equal(foto.precioDOP, CATALOGO.popular.precioDOP);
  assert.equal(foto.vigenciaMeses, CATALOGO.popular.vigenciaMeses);
  assert.equal(foto.limiteFotos, 15);
  assert.equal(foto.capacidades.length, CATALOGO.popular.capacidades.length);
});

test("Infinity viaja como null y vuelve como Infinity", () => {
  // JSON no sabe decir Infinity: en la base se guarda null y al leer
  // vuelve a ser "sin límite". Si este viaje se rompe, un plan Premium
  // pasa de fotos ilimitadas a CERO fotos en silencio.
  const foto = snapshotDeContrato("premium", AHORA);
  assert.equal(foto.limiteFotos, null, "en la foto, sin límite = null");

  // El viaje real pasa por JSON (jsonb en la base).
  const guardada = JSON.parse(JSON.stringify(foto));
  const contrato = contratoDePedido({ plan: "premium", capacidades_contratadas: guardada });
  assert.equal(contrato.limiteFotos, Infinity, "al leer, null = sin límite");
});

test("la foto congela: cambiar el catálogo no mueve contratos viejos", () => {
  // Simula un pedido contratado cuando Popular incluía una capacidad que
  // el catálogo vivo ya no tiene.
  const foto = snapshotDeContrato("popular", AHORA);
  foto.capacidades.push({ id: "regalo_de_epoca", nombre: "Solo de aquella época", estado: "activa" });
  foto.limiteFotos = 99;

  const contrato = contratoDePedido({
    plan: "popular",
    capacidades_contratadas: JSON.parse(JSON.stringify(foto)),
  });

  assert.equal(contrato.origen, "foto");
  assert.equal(puede(contrato, "regalo_de_epoca"), true, "lo contratado se respeta aunque el catálogo cambie");
  assert.equal(contrato.limiteFotos, 99, "el límite es el contratado, no el vivo");
});

test("un pedido sin foto cae al catálogo vivo y lo dice", () => {
  const contrato = contratoDePedido({ plan: "esencial" });

  assert.equal(contrato.origen, "catalogo");
  assert.equal(contrato.congeladoEn, null);
  assert.equal(contrato.limiteFotos, 0);
  assert.equal(puede(contrato, "invitacion_interactiva"), true);
  assert.equal(puede(contrato, "rsvp"), false, "Esencial no incluye RSVP");
});

test("una foto corrupta no tumba nada: se cae al catálogo", () => {
  const casos: unknown[] = [
    "no soy un objeto",
    { version: 999, capacidades: [] },
    { version: 1, capacidades: "no soy un array" },
    { otra: "cosa" },
    null,
  ];
  for (const cruda of casos) {
    const contrato = contratoDePedido({ plan: "popular", capacidades_contratadas: cruda });
    assert.equal(contrato.origen, "catalogo", `con foto ${JSON.stringify(cruda)} debió caer al catálogo`);
    assert.equal(contrato.limiteFotos, 15);
  }
});

test("capacidades malformadas dentro de una foto válida se filtran", () => {
  const foto = snapshotDeContrato("esencial", AHORA);
  const sucia = JSON.parse(JSON.stringify(foto));
  sucia.capacidades.push(null, { id: 42 }, { nombre: "sin id" });

  const contrato = contratoDePedido({ plan: "esencial", capacidades_contratadas: sucia });
  assert.equal(contrato.capacidades.length, CATALOGO.esencial.capacidades.length);
});

test("un plan desconocido no revienta: cae a popular", () => {
  const contrato = contratoDePedido({ plan: "plan-fantasma" });
  assert.equal(contrato.plan, "popular");
  assert.equal(contrato.origen, "catalogo");
});

test("puede() solo dice sí con capacidades activas", () => {
  // Premium vende qr_individual como "vendida_sin_implementar" y Luxury
  // tiene diseño "manual": el sistema NO puede ejecutarlas, y decir que
  // sí sería mentir.
  const premium = contratoDePedido({ plan: "premium" });
  assert.equal(estadoDeCapacidad(premium, "qr_individual"), "vendida_sin_implementar");
  assert.equal(puede(premium, "qr_individual"), false);
  assert.equal(puede(premium, "cronograma"), true);

  const luxury = contratoDePedido({ plan: "luxury" });
  assert.equal(estadoDeCapacidad(luxury, "diseno_personalizado"), "manual");
  assert.equal(puede(luxury, "diseno_personalizado"), false);

  assert.equal(estadoDeCapacidad(luxury, "no_existe"), null);
  assert.equal(puede(luxury, "no_existe"), false);
});

test("exigirCapacidad distingue los tres fracasos", () => {
  const premium = contratoDePedido({ plan: "premium" });
  const esencial = contratoDePedido({ plan: "esencial" });
  const luxury = contratoDePedido({ plan: "luxury" });

  // Activa: pasa sin ruido.
  assert.doesNotThrow(() => exigirCapacidad(premium, "rsvp"));

  // Incluida pero manual: no es "tu plan no la incluye".
  assert.throws(
    () => exigirCapacidad(luxury, "diseno_personalizado"),
    /la gestiona el equipo/,
    "manual debe decir que el equipo la cumple"
  );

  // Vendida sin implementar: pagada, honestidad sobre el estado.
  assert.throws(
    () => exigirCapacidad(premium, "qr_individual"),
    /disponible pronto/,
    "vendida_sin_implementar debe prometer sin mentir"
  );

  // No incluida: el mensaje nombra el plan.
  assert.throws(
    () => exigirCapacidad(esencial, "rsvp"),
    /Esencial no incluye/,
    "ausente debe nombrar el plan del cliente"
  );
});

test("limite() responde los tres límites del contrato", () => {
  const foto = JSON.parse(JSON.stringify(snapshotDeContrato("popular", AHORA)));
  const contrato = contratoDePedido({ plan: "popular", capacidades_contratadas: foto });

  assert.equal(limite(contrato, "fotos"), 15);
  assert.equal(limite(contrato, "vigenciaMeses"), 6);
  // revisiones sigue siendo decisión comercial pendiente: null, no un invento.
  assert.equal(limite(contrato, "revisiones"), null);
});
