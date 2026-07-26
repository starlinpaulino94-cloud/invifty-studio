import test from "node:test";
import assert from "node:assert/strict";

import { slugificar, slugConSufijo, sufijoDeSlug, tieneSufijo, LARGO_SUFIJO } from "@/lib/slug";

/**
 * DIRECCIONES QUE NO SE PUEDEN ADIVINAR
 * ======================================
 * Un slug sacado solo del título es enumerable: "boda-maria-y-jose" no cuesta
 * nada de acertar, y quien acierte ve la dirección del evento, la fecha, las
 * fotos privadas y el WhatsApp del anfitrión.
 *
 * Las invitaciones NUEVAS llevan un sufijo al azar. Las que ya estaban
 * publicadas conservan su enlace: el cliente ya lo repartió.
 */

test("el sufijo mide siempre lo mismo y no trae letras confundibles", () => {
  // Sin vocales ni 0/o ni 1/l/i: se dicta por teléfono sin equivocarse, y sin
  // vocales tampoco puede salir una palabra desafortunada pegada al nombre.
  for (let i = 0; i < 200; i++) {
    const s = sufijoDeSlug();
    assert.equal(s.length, LARGO_SUFIJO);
    assert.match(s, /^[bcdfghjkmnpqrstvwxyz23456789]+$/, `salió "${s}"`);
  }
});

test("dos sufijos seguidos no salen iguales", () => {
  // No demuestra que sea aleatorio, pero sí destapa el fallo obvio: que se
  // devuelva siempre el mismo valor y toda invitación acabe con el mismo.
  const vistos = new Set(Array.from({ length: 300 }, () => sufijoDeSlug()));
  assert.ok(vistos.size > 250, `solo ${vistos.size} sufijos distintos de 300`);
});

test("el sufijo va detrás del nombre, que se sigue leyendo", () => {
  const slug = slugConSufijo("Camila & Lucas");
  assert.match(slug, /^camila-y-lucas-[bcdfghjkmnpqrstvwxyz23456789]{5}$/);
});

test("un título larguísimo no se come el sufijo", () => {
  // Sin cuidado, el recorte a 60 caracteres se llevaría por delante justo la
  // parte que protege la dirección.
  const slug = slugConSufijo("a".repeat(200));
  assert.ok(slug.length <= 60, `midió ${slug.length}`);
  assert.equal(tieneSufijo(slug), true, "el recorte se comió el sufijo");
});

test("un título sin letras aprovechables no deja la dirección vacía", () => {
  const slug = slugConSufijo("¿¡!?");
  assert.match(slug, /^invitacion-[bcdfghjkmnpqrstvwxyz23456789]{5}$/);
});

test("se reconoce cuándo una dirección ya está protegida", () => {
  assert.equal(tieneSufijo("camila-y-lucas-k3f9m"), true);
  assert.equal(tieneSufijo(slugConSufijo("Boda de Rosa")), true);
});

test("las direcciones de antes se reconocen como desprotegidas", () => {
  // Son las que ya estaban publicadas: el editor las señala para que el
  // equipo decida, pero nada se cambia solo.
  assert.equal(tieneSufijo("camila-y-lucas"), false);
  assert.equal(tieneSufijo("boda-maria-y-jose"), false);
  assert.equal(tieneSufijo("invitacion"), false);
  assert.equal(tieneSufijo(""), false);
  assert.equal(tieneSufijo("los-15-de-valeria-2"), false, "el viejo contador no es un sufijo");
});

test("una palabra de cinco letras al final no se confunde con un sufijo", () => {
  // "aeiou" y "mario" llevan vocales, que el alfabeto del sufijo no tiene.
  assert.equal(tieneSufijo("boda-de-mario"), false);
  assert.equal(tieneSufijo("fiesta-verde"), false);
});

test("slugificar sigue sin tocar nada: es lo que conserva los enlaces viejos", () => {
  // El editor guarda con slugificar, no con slugConSufijo. Si esto cambiara,
  // cada vez que el equipo abriera y guardara una invitación publicada le
  // cambiaría la dirección al cliente.
  assert.equal(slugificar("Camila & Lucas"), "camila-y-lucas");
  assert.equal(slugificar("camila-y-lucas-k3f9m"), "camila-y-lucas-k3f9m");
});

test("volver a guardar no encadena sufijos", () => {
  // slugificar deja el slug igual, así que una invitación nueva guardada
  // veinte veces conserva un solo sufijo.
  let slug = slugConSufijo("Camila & Lucas");
  const original = slug;
  for (let i = 0; i < 20; i++) slug = slugificar(slug);
  assert.equal(slug, original);
});
