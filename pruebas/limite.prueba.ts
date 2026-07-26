import test from "node:test";
import assert from "node:assert/strict";

import { limitar, olvidarTodo, ipDePeticion } from "@/lib/limite";

/**
 * EL FRENO DE LAS RUTAS PÚBLICAS
 * ===============================
 * Cuatro rutas de /api están abiertas por necesidad: el invitado que
 * confirma y el cliente que rellena su formulario y sube fotos. Estas
 * pruebas cuidan las dos mitades del asunto, que se estropean en
 * direcciones contrarias:
 *
 *  - que frene de verdad (si no, el freno decora);
 *  - que NO frene al cliente de verdad (si no, rompe lo que se vendió).
 */

test("deja pasar hasta el tope y frena la siguiente", () => {
  olvidarTodo();
  const reglas = { max: 3, ventanaMs: 60_000 };

  for (let i = 1; i <= 3; i++) {
    assert.equal(limitar("alguien", reglas, 1000).ok, true, `la petición ${i} debió pasar`);
  }
  assert.equal(limitar("alguien", reglas, 1000).ok, false, "la cuarta debió frenarse");
});

test("cada quien tiene su propio cupo", () => {
  // Si el contador fuera global, el primer invitado que confirmara dejaría
  // fuera a los demás.
  olvidarTodo();
  const reglas = { max: 1, ventanaMs: 60_000 };

  assert.equal(limitar("invitado-a", reglas, 1000).ok, true);
  assert.equal(limitar("invitado-a", reglas, 1000).ok, false);
  assert.equal(limitar("invitado-b", reglas, 1000).ok, true, "b no comparte cupo con a");
});

test("pasada la ventana se vuelve a empezar", () => {
  olvidarTodo();
  const reglas = { max: 2, ventanaMs: 10_000 };

  limitar("alguien", reglas, 1000);
  limitar("alguien", reglas, 1000);
  assert.equal(limitar("alguien", reglas, 5_000).ok, false, "dentro de la ventana, frenado");
  assert.equal(limitar("alguien", reglas, 11_001).ok, true, "pasada la ventana, libre");
});

test("dice cuántos segundos faltan, para poder mandar Retry-After", () => {
  olvidarTodo();
  const reglas = { max: 1, ventanaMs: 30_000 };

  limitar("alguien", reglas, 1000);
  const veredicto = limitar("alguien", reglas, 11_000);

  assert.equal(veredicto.ok, false);
  assert.equal(veredicto.esperaS, 20, "quedaban 20 s de ventana");
});

test("el que pasa no espera nada", () => {
  olvidarTodo();
  assert.equal(limitar("alguien", { max: 5, ventanaMs: 1000 }, 0).esperaS, 0);
});

test("un cliente rellenando su formulario no llega al tope", () => {
  // El autosave guarda 800 ms después del último cambio. Aunque escribiera
  // sin descanso durante los diez minutos de la ventana, saldrían unos 750
  // guardados en el peor caso teórico; en la práctica se escribe a ratos.
  // Lo que se comprueba aquí es el caso realista: alguien tecleando y
  // parando durante diez minutos, un guardado cada dos segundos.
  olvidarTodo();
  const FRENO_GUARDADO = { max: 300, ventanaMs: 10 * 60 * 1000 };

  let frenados = 0;
  for (let s = 0; s < 600; s += 2) {
    if (!limitar("formulario:token-real", FRENO_GUARDADO, s * 1000).ok) frenados++;
  }

  assert.equal(frenados, 0, `se frenó ${frenados} veces a un cliente normal`);
});

test("una familia confirmando desde el mismo wifi no se queda fuera", () => {
  // Ocho confirmaciones seguidas desde la misma casa son ocho personas
  // reales, no un ataque. El tope está en 20.
  olvidarTodo();
  const FRENO_RSVP = { max: 20, ventanaMs: 10 * 60 * 1000 };

  for (let i = 0; i < 8; i++) {
    assert.equal(limitar("rsvp:190.80.1.1", FRENO_RSVP, i * 30_000).ok, true);
  }
});

test("un bucle sí se frena", () => {
  olvidarTodo();
  const FRENO_RSVP = { max: 20, ventanaMs: 10 * 60 * 1000 };

  let pasaron = 0;
  // Mil peticiones en el mismo instante, como haría un script.
  for (let i = 0; i < 1000; i++) {
    if (limitar("rsvp:190.80.1.1", FRENO_RSVP, 0).ok) pasaron++;
  }

  assert.equal(pasaron, 20, "solo debieron pasar las 20 del cupo");
});

test("la IP sale de la primera de la lista que pone Vercel", () => {
  // x-forwarded-for llega como "cliente, proxy1, proxy2": la del cliente es
  // la primera. Quedarse con la última contaría a todo el mundo junto.
  const cabeceras = new Headers({ "x-forwarded-for": "190.80.1.1, 10.0.0.1" });
  assert.equal(ipDePeticion(cabeceras), "190.80.1.1");
});

test("sin cabeceras de IP no se deja pasar a todos por libre", () => {
  // Mandar la cabecera vacía no puede ser la forma de saltarse el freno:
  // todos los desconocidos comparten un mismo cupo.
  assert.equal(ipDePeticion(new Headers()), "desconocida");
  assert.equal(ipDePeticion(new Headers({ "x-forwarded-for": "" })), "desconocida");
});
