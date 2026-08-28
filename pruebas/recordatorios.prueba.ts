import test from "node:test";
import assert from "node:assert/strict";

import {
  diasHasta,
  hogaresSinConfirmar,
  mensajeRecordatorioConfirmacion,
  mensajeRecordatorioEvento,
  tieneRecordatorios,
} from "@/lib/recordatorios";
import { contratoDePedido, snapshotDeContrato } from "@/lib/capacidades";
import { CATALOGO } from "@/lib/planes";

/**
 * RECORDATORIOS A LOS INVITADOS
 * ==============================
 * Lo que se cuida: que los tenga quien los pagó (contratos viejos de
 * Premium incluidos), que no se le insista a quien YA respondió, y que
 * los días que faltan no mientan — un "faltan 2 días" equivocado hace
 * quedar mal al anfitrión con toda su lista.
 */

const AHORA = new Date("2026-11-10T15:30:00-04:00");

test("el catálogo ya no vende recordatorios sin tenerlos", () => {
  const capacidad = CATALOGO.premium.capacidades.find((c) => c.id === "recordatorios");
  assert.equal(capacidad?.estado, "activa", "la capacidad sigue como humo");
});

test("los tiene Premium por contrato, nuevo o viejo", () => {
  const nuevo = contratoDePedido({
    plan: "premium",
    capacidades_contratadas: JSON.parse(JSON.stringify(snapshotDeContrato("premium", AHORA))),
  });
  assert.equal(tieneRecordatorios(nuevo), true);

  // Contrato viejo: su foto los congeló como promesa. Se le honra.
  const fotoVieja = JSON.parse(JSON.stringify(snapshotDeContrato("premium", AHORA)));
  for (const c of fotoVieja.capacidades) {
    if (c.id === "recordatorios") c.estado = "vendida_sin_implementar";
  }
  const viejo = contratoDePedido({ plan: "premium", capacidades_contratadas: fotoVieja });
  assert.equal(tieneRecordatorios(viejo), true);

  // Esencial y Popular no los incluyen: no aparecen.
  assert.equal(tieneRecordatorios(contratoDePedido({ plan: "esencial" })), false);
  assert.equal(tieneRecordatorios(contratoDePedido({ plan: "popular" })), false);
});

test("diasHasta cuenta días de calendario, no bloques de 24 horas", () => {
  // A las 3:30 pm del día 10, el evento del 12 está a 2 días aunque
  // falten menos de 48 horas: así habla la gente.
  assert.equal(diasHasta("2026-11-12", AHORA), 2);
  assert.equal(diasHasta("2026-11-11", AHORA), 1);
  assert.equal(diasHasta("2026-11-10", AHORA), 0, "hoy es hoy");
  assert.equal(diasHasta("2026-11-08", AHORA), -2, "un evento pasado da negativo");
});

test("solo se le recuerda a quien NO ha respondido — un 'no' también es respuesta", () => {
  const hogares = [
    { id: "a", nombre: "Familia Pérez" },
    { id: "b", nombre: "Familia Gómez" },
    { id: "c", nombre: "Los primos" },
  ];
  // b confirmó que sí; c avisó que no. A ninguno de los dos se le insiste.
  const pendientes = hogaresSinConfirmar(hogares, new Set(["b", "c"]));
  assert.deepEqual(pendientes.map((h) => h.id), ["a"]);
});

test("el mensaje personal lleva el enlace del hogar, la urgencia y la fecha límite", () => {
  const msj = mensajeRecordatorioConfirmacion({
    nombreHogar: "Familia Pérez",
    titulo: "Camila & Lucas",
    fechaEvento: "2026-11-12",
    url: "https://x/i/camila?h=tok123",
    fechaLimite: "2026-11-05",
    ahora: AHORA,
  });
  assert.ok(msj.includes("https://x/i/camila?h=tok123"), "sin su enlace personal no sirve");
  assert.match(msj, /Camila & Lucas/);
  assert.match(msj, /faltan solo 2 días/);
  assert.match(msj, /5 de noviembre/, "la fecha límite en palabras");
});

test("mañana y hoy tienen su frase propia; un evento pasado no dice 'faltan -3 días'", () => {
  const base = { titulo: "X", url: "https://x", ahora: AHORA };
  assert.match(
    mensajeRecordatorioEvento({ ...base, fechaEvento: "2026-11-11" }),
    /es MAÑANA/
  );
  assert.match(mensajeRecordatorioEvento({ ...base, fechaEvento: "2026-11-10" }), /es HOY/);
  const pasado = mensajeRecordatorioEvento({ ...base, fechaEvento: "2026-11-01" });
  assert.ok(!pasado.includes("faltan"), "un evento pasado no anuncia cuenta regresiva");
  const sinFecha = mensajeRecordatorioEvento({ ...base, fechaEvento: null });
  assert.ok(sinFecha.includes("https://x"), "sin fecha el mensaje sigue sirviendo");
});
