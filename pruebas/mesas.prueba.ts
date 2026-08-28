import test from "node:test";
import assert from "node:assert/strict";

import {
  capacidadValida,
  hogaresSinMesa,
  nombreMesaValido,
  ocupacionDeMesas,
  personasDeHogar,
  planoTexto,
} from "@/lib/mesas";

/**
 * EL ORGANIZADOR DE MESAS
 * ========================
 * Lo que se cuida: que la ocupación cuente PERSONAS de verdad (las
 * confirmadas, y el cupo como reserva para los que no responden), y que
 * el plano que se manda al venue no filtre nada que no sean nombres.
 */

const HOGARES = [
  { id: "a", nombre: "Familia Pérez", cupo: 4, mesa_id: "m1" },
  { id: "b", nombre: "Familia Gómez", cupo: 2, mesa_id: "m1" },
  { id: "c", nombre: "Los primos", cupo: 6, mesa_id: null },
];
const MESAS = [{ id: "m1", nombre: "Mesa 1", capacidad: 8 }];

test("confirmados cuentan como confirmados; sin responder reserva el cupo", () => {
  // Pérez confirmó 3 (de cupo 4): cuentan 3. Gómez no ha respondido
  // (cupo 2): se le reservan 2 — mejor sobrar silla que faltar.
  const confirmados = { a: 3 };
  const respondieron = new Set(["a"]);
  assert.equal(personasDeHogar(HOGARES[0], confirmados, respondieron), 3);
  assert.equal(personasDeHogar(HOGARES[1], confirmados, respondieron), 2);

  const [mesa] = ocupacionDeMesas(MESAS, HOGARES, confirmados, respondieron);
  assert.equal(mesa.personas, 5);
  assert.equal(mesa.sobrecupo, false);
});

test("un hogar que respondió que NO viene ocupa cero sillas", () => {
  // Respondió, y sus confirmados son 0: la mesa no le guarda el cupo.
  const [mesa] = ocupacionDeMesas(MESAS, HOGARES, {}, new Set(["a", "b"]));
  assert.equal(mesa.personas, 0);
});

test("el sobrecupo avisa cuando las personas superan la capacidad", () => {
  const [mesa] = ocupacionDeMesas(
    [{ id: "m1", nombre: "Mesa 1", capacidad: 4 }],
    HOGARES,
    { a: 4, b: 2 },
    new Set(["a", "b"])
  );
  assert.equal(mesa.personas, 6);
  assert.equal(mesa.sobrecupo, true);
});

test("los hogares sin mesa se listan aparte: nadie se queda parado sin saberlo", () => {
  assert.deepEqual(hogaresSinMesa(HOGARES).map((h) => h.id), ["c"]);
});

test("el plano en texto lleva mesas, familias y números — y nada más", () => {
  const ocupacion = ocupacionDeMesas(MESAS, HOGARES, { a: 3 }, new Set(["a"]));
  const plano = planoTexto(ocupacion, hogaresSinMesa(HOGARES), "Camila & Lucas");

  assert.match(plano, /Camila & Lucas/);
  assert.match(plano, /Mesa 1.*5\/8/);
  assert.match(plano, /Familia Pérez/);
  assert.match(plano, /Sin mesa todavía/);
  assert.match(plano, /Los primos/);
  assert.ok(!/token|http|@/.test(plano), "el plano no filtra tokens ni enlaces");
});

test("los topes de nombre y capacidad hablan claro", () => {
  assert.equal(nombreMesaValido("Mesa de los novios"), true);
  assert.equal(nombreMesaValido("   "), false);
  assert.equal(nombreMesaValido("x".repeat(41)), false);
  assert.equal(capacidadValida(10), true);
  assert.equal(capacidadValida(0), false);
  assert.equal(capacidadValida(101), false);
  assert.equal(capacidadValida(7.5), false, "media silla no existe");
});
