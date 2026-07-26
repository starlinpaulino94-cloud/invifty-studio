import test from "node:test";
import assert from "node:assert/strict";

import { ordenarFotos, esVideo, rutaWeb, rutaMiniatura, rutaOriginal } from "@/lib/fotos";

/**
 * ORDEN Y PORTADA DE LAS FOTOS
 * =============================
 * Las diez plantillas usan `fotos[0]` como portada. Si este orden se
 * rompe, cada invitación sale con una portada distinta de la que eligió el
 * equipo — y nadie se entera hasta que el cliente la abre.
 */

const foto = (nombre: string) => ({ nombre });

test("sin orden guardado se respeta el orden en que llegaron", () => {
  const fotos = [foto("a.jpg"), foto("b.jpg"), foto("c.jpg")];
  assert.deepEqual(ordenarFotos(fotos), fotos);
  assert.deepEqual(ordenarFotos(fotos, []), fotos);
});

test("la primera del orden guardado es la portada", () => {
  const fotos = [foto("a.jpg"), foto("b.jpg"), foto("c.jpg")];
  const resultado = ordenarFotos(fotos, ["c.jpg", "a.jpg", "b.jpg"]);
  assert.deepEqual(resultado.map((f) => f.nombre), ["c.jpg", "a.jpg", "b.jpg"]);
  assert.equal(resultado[0].nombre, "c.jpg", "es la que verá el invitado de portada");
});

test("una foto nueva no descoloca las ya ordenadas", () => {
  // El cliente sube "nueva.jpg" después de que el equipo ordenó las otras.
  const fotos = [foto("a.jpg"), foto("b.jpg"), foto("nueva.jpg")];
  const resultado = ordenarFotos(fotos, ["b.jpg", "a.jpg"]);
  assert.deepEqual(
    resultado.map((f) => f.nombre),
    ["b.jpg", "a.jpg", "nueva.jpg"],
    "la nueva va al final, sin tocar la portada elegida"
  );
});

test("las fotos ocultas no llegan a la invitación", () => {
  const fotos = [foto("a.jpg"), foto("b.jpg"), foto("c.jpg")];
  const resultado = ordenarFotos(fotos, ["a.jpg", "b.jpg", "c.jpg"], ["b.jpg"]);
  assert.deepEqual(resultado.map((f) => f.nombre), ["a.jpg", "c.jpg"]);
});

test("ocultar la portada asciende a la siguiente", () => {
  const fotos = [foto("a.jpg"), foto("b.jpg"), foto("c.jpg")];
  const resultado = ordenarFotos(fotos, ["a.jpg", "b.jpg", "c.jpg"], ["a.jpg"]);
  assert.equal(resultado[0].nombre, "b.jpg", "nunca puede quedarse sin portada");
});

test("un orden con fotos que ya se borraron no rompe nada", () => {
  const fotos = [foto("a.jpg"), foto("b.jpg")];
  const resultado = ordenarFotos(fotos, ["borrada.jpg", "b.jpg", "a.jpg"]);
  assert.deepEqual(resultado.map((f) => f.nombre), ["b.jpg", "a.jpg"]);
});

test("ocultarlas todas devuelve una galería vacía, no una rota", () => {
  const fotos = [foto("a.jpg"), foto("b.jpg")];
  assert.deepEqual(ordenarFotos(fotos, [], ["a.jpg", "b.jpg"]), []);
});

test("los videos se reconocen por su prefijo", () => {
  assert.equal(esVideo("video-abc.mp4"), true);
  assert.equal(esVideo("abc.jpg"), false);
});

test("los derivados viven en su subcarpeta, fuera del listado del cliente", () => {
  const pedido = "pedido-1";
  assert.equal(rutaOriginal(pedido, "foto.jpg"), "pedido-1/foto.jpg");
  assert.equal(rutaWeb(pedido, "foto.jpg"), "pedido-1/derivados/web-foto.jpg.webp");
  assert.equal(rutaMiniatura(pedido, "foto.jpg"), "pedido-1/derivados/min-foto.jpg.webp");
});
