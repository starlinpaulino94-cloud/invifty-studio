import test from "node:test";
import assert from "node:assert/strict";

import { cruzarLista, leerNombresPegados } from "@/lib/lista";
import { normalizarNombre } from "@/lib/nombres";

/**
 * EL PANEL DEL ANFITRIÓN
 * =======================
 * El anfitrión no pregunta "¿quién confirmó?". Pregunta "¿a quién le falta?"
 * —a esos hay que perseguirlos— y "¿cuántos somos?" —eso es lo que le pide
 * el salón—. Las dos respuestas salen de aquí, así que un fallo en este
 * archivo se traduce en sillas de más o de menos el día del evento.
 */

const invitado = (nombre: string, id = nombre) => ({
  id,
  nombre,
  nombre_normalizado: normalizarNombre(nombre),
});

const respuesta = (
  nombre: string,
  asiste: boolean,
  cantidad = 1,
  creado_en = "2026-01-01T10:00:00Z"
) => ({
  nombre,
  nombre_normalizado: normalizarNombre(nombre),
  asiste,
  cantidad,
  nota: null,
  creado_en,
});

test("reparte a los invitados en los tres grupos", () => {
  const cruce = cruzarLista(
    [invitado("María Pérez"), invitado("Juan Gómez"), invitado("Ana Ruiz")],
    [respuesta("María Pérez", true, 2), respuesta("Juan Gómez", false)]
  );

  assert.deepEqual(cruce.vienen.map((v) => v.nombre), ["María Pérez"]);
  assert.deepEqual(cruce.noVienen.map((v) => v.nombre), ["Juan Gómez"]);
  assert.deepEqual(cruce.sinResponder.map((v) => v.nombre), ["Ana Ruiz"]);
});

test("el total cuenta personas, no respuestas", () => {
  // El error que deja al anfitrión sin sillas: contar confirmaciones en vez
  // de gente. Dos respuestas pueden ser siete personas.
  const cruce = cruzarLista(
    [invitado("María"), invitado("Familia Rodríguez")],
    [respuesta("María", true, 2), respuesta("Familia Rodríguez", true, 5)]
  );

  assert.equal(cruce.totalPersonas, 7);
  assert.equal(cruce.vienen.length, 2, "son dos respuestas");
});

test("quien dice que no no suma personas", () => {
  const cruce = cruzarLista(
    [invitado("María"), invitado("Juan")],
    [respuesta("María", true, 3), respuesta("Juan", false, 0)]
  );
  assert.equal(cruce.totalPersonas, 3);
});

test("el acento y las mayúsculas no descuadran el cruce", () => {
  // El invitado escribe como le sale; el anfitrión escribió su lista a mano.
  // Si esto fallara, confirmaría y seguiría saliendo como "sin responder".
  const cruce = cruzarLista(
    [invitado("José Pérez")],
    [respuesta("  jose   perez ", true, 1)]
  );

  assert.equal(cruce.sinResponder.length, 0, "no debió quedar pendiente");
  assert.equal(cruce.vienen.length, 1);
  assert.equal(cruce.vienen[0].nombre, "José Pérez", "se enseña el nombre de la lista");
});

test("quien confirma sin estar en la lista aparece aparte, pero cuenta", () => {
  // Pasa cuando alguien reenvía la invitación a un primo. Esconderlo dejaría
  // el total corto justo el día del evento.
  const cruce = cruzarLista(
    [invitado("María")],
    [respuesta("María", true, 1), respuesta("Primo Luis", true, 2)]
  );

  assert.equal(cruce.inesperados.length, 1);
  assert.equal(cruce.inesperados[0].nombre, "Primo Luis");
  assert.equal(cruce.totalPersonas, 3, "el inesperado también ocupa sillas");
});

test("sin lista cargada, las confirmaciones no salen como 'inesperadas'", () => {
  // Cargar la lista es opcional. Si el anfitrión no la carga, llamar
  // "inesperado" a todo el mundo no significaría nada.
  const cruce = cruzarLista([], [respuesta("María", true, 2), respuesta("Juan", false)]);

  assert.equal(cruce.sinLista, true);
  assert.equal(cruce.inesperados.length, 0);
  assert.equal(cruce.vienen.length, 1);
  assert.equal(cruce.noVienen.length, 1);
  assert.equal(cruce.totalPersonas, 2);
});

test("sin lista no se inventa a quién falta", () => {
  // Es justo lo que el sistema no podía saber: quien nunca abre la
  // invitación no deja rastro.
  const cruce = cruzarLista([], [respuesta("María", true)]);
  assert.equal(cruce.sinResponder.length, 0);
  assert.equal(cruce.faltanPorResponder, 0);
});

test("si alguien cambia de opinión, manda su última respuesta", () => {
  const cruce = cruzarLista(
    [invitado("María")],
    [
      respuesta("María", true, 2, "2026-01-01T10:00:00Z"),
      respuesta("María", false, 0, "2026-02-01T10:00:00Z"),
    ]
  );

  assert.equal(cruce.vienen.length, 0);
  assert.equal(cruce.noVienen.length, 1);
  assert.equal(cruce.totalPersonas, 0);
});

test("una lista sin respuestas deja a todos pendientes", () => {
  const cruce = cruzarLista([invitado("A"), invitado("B"), invitado("C")], []);
  assert.equal(cruce.faltanPorResponder, 3);
  assert.equal(cruce.totalPersonas, 0);
});

/* ---------- Leer la lista que pega el anfitrión ---------- */

test("se acepta un nombre por línea", () => {
  assert.deepEqual(leerNombresPegados("María\nJuan\nAna"), ["María", "Juan", "Ana"]);
});

test("también separados por coma, que es como los tendrá en el teléfono", () => {
  assert.deepEqual(leerNombresPegados("María, Juan; Ana"), ["María", "Juan", "Ana"]);
});

test("los repetidos no entran dos veces", () => {
  // Pegar la lista dos veces es lo más normal del mundo.
  assert.deepEqual(leerNombresPegados("María\nMARÍA\n  maria  "), ["María"]);
});

test("las líneas vacías y la basura corta no ensucian la lista", () => {
  assert.deepEqual(leerNombresPegados("María\n\n\n-\nJuan\n \n"), ["María", "Juan"]);
});

test("se respeta el orden en que los escribió", () => {
  // Es su lista: la reconoce por el orden en que la tiene.
  assert.deepEqual(leerNombresPegados("Zoe\nAna\nBeto"), ["Zoe", "Ana", "Beto"]);
});

test("una lista enorme se corta donde se le diga", () => {
  const texto = Array.from({ length: 50 }, (_, i) => `Invitado ${i}`).join("\n");
  assert.equal(leerNombresPegados(texto, 10).length, 10);
});

test("un nombre larguísimo no rompe la columna de la base", () => {
  const [nombre] = leerNombresPegados("a".repeat(300));
  assert.ok(nombre.length <= 80, `midió ${nombre.length}`);
});
