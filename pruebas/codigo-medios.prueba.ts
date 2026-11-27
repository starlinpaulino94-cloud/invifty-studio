import test from "node:test";
import assert from "node:assert/strict";

import {
  MINIMO_BASE64_CHARS, TOPE_POR_CLASE, claseDeMedio, errorDeMedio, esIdDeMedio,
  extraerMediosEmbebidos, htmlSinMedios, idsDeMedios, marcadorDeMedio, rutaDeMedioCodigo,
  tieneMediosEmbebidos,
} from "@/lib/codigo-medios";
import {
  LIMITE_CODIGO_BYTES, aplicarMarcadores, errorDePesoCodigo, revisarCodigo,
} from "@/lib/codigo";

/**
 * LOS ARCHIVOS DEL CÓDIGO PROPIO
 * ===============================
 * Un HTML con imágenes y videos embebidos en base64 pesaba más de lo que
 * una acción de servidor puede recibir. Ahora el editor los saca, los sube
 * aparte y deja marcadores. Estas pruebas fijan el contrato.
 */

/** base64 de `n` bytes de relleno (los bytes concretos no importan). */
function b64(n: number, relleno = 7): string {
  return Buffer.from(new Uint8Array(n).fill(relleno)).toString("base64");
}
const uri = (mime: string, n: number, relleno = 7) => `data:${mime};base64,${b64(n, relleno)}`;

test("saca imágenes y videos embebidos y deja marcadores livianos", async () => {
  const foto = uri("image/jpeg", 20_000, 1);
  const video = uri("video/mp4", 40_000, 2);
  const html = `<img src="${foto}"><video src="${video}"></video>`;

  const r = await extraerMediosEmbebidos(html);

  assert.equal(r.medios.length, 2);
  assert.ok(!r.html.includes("base64"), "no debe quedar nada embebido");
  assert.ok(r.html.length < 200, "el HTML queda liviano");
  assert.deepEqual(idsDeMedios(r.html).sort(), r.medios.map((m) => m.id).sort());
  for (const m of r.medios) assert.ok(esIdDeMedio(m.id));
});

test("el mismo archivo repetido se sube una sola vez, y reextraer no cambia nada", async () => {
  const foto = uri("image/png", 20_000, 3);
  const html = `<div style="background:url(${foto})"></div><img src="${foto}"><img src="${foto}">`;

  const r = await extraerMediosEmbebidos(html);
  assert.equal(r.medios.length, 1, "mismo contenido, un solo archivo");
  assert.equal(idsDeMedios(r.html).length, 1);

  const otraVez = await extraerMediosEmbebidos(r.html);
  assert.equal(otraVez.medios.length, 0, "ya extraído: nada que subir");
  assert.equal(otraVez.html, r.html);
});

test("archivos distintos dan ids distintos", async () => {
  const r = await extraerMediosEmbebidos(
    `<img src="${uri("image/png", 20_000, 1)}"><img src="${uri("image/png", 20_000, 2)}">`
  );
  assert.equal(r.medios.length, 2);
  assert.notEqual(r.medios[0].id, r.medios[1].id);
});

test("los archivos diminutos se quedan dentro: sacarlos no ahorra nada", async () => {
  const chico = uri("image/png", 100);
  assert.ok(chico.length < MINIMO_BASE64_CHARS);
  const html = `<img src="${chico}">`;
  assert.equal(tieneMediosEmbebidos(html), false);
  const r = await extraerMediosEmbebidos(html);
  assert.equal(r.html, html);
  assert.equal(r.medios.length, 0);
});

test("el SVG embebido NO se aloja: es código y se queda en el HTML aislado", async () => {
  const svg = uri("image/svg+xml", 20_000);
  assert.equal(claseDeMedio("image/svg+xml"), null);
  const r = await extraerMediosEmbebidos(`<img src="${svg}">`);
  assert.equal(r.medios.length, 0);
  assert.ok(r.html.includes("image/svg+xml"));
  assert.ok(r.omitidos.length > 0, "se avisa de que se dejó dentro");
});

test("un tipo que no es medio (html, js) no se aloja jamás", async () => {
  for (const mime of ["text/html", "application/javascript", "application/x-msdownload"]) {
    assert.equal(claseDeMedio(mime), null, mime);
    assert.ok(errorDeMedio(mime, 1000), mime);
  }
});

test("un archivo que pasa de su tope se rechaza con el motivo", () => {
  const MB = 1024 * 1024;
  assert.equal(errorDeMedio("video/mp4", 49 * MB), null);
  assert.match(errorDeMedio("video/mp4", 51 * MB)!, /máximo es 50 MB/);
  assert.match(errorDeMedio("image/jpeg", TOPE_POR_CLASE.imagen + 1)!, /máximo es 15 MB/);
  assert.ok(errorDeMedio("image/jpeg", 0), "vacío no vale");
});

test("un video demasiado grande se deja dentro y se explica", async () => {
  // 51 MB: se prueba con un tope artificial no; usamos el real con un buffer grande.
  const MB = 1024 * 1024;
  const grande = uri("video/mp4", 51 * MB);
  const r = await extraerMediosEmbebidos(`<video src="${grande}"></video>`);
  assert.equal(r.medios.length, 0);
  assert.ok(tieneMediosEmbebidos(r.html), "sigue embebido: quien llama debe parar");
  assert.match(r.omitidos.join(" "), /50 MB/);
});

test("base64 roto no tumba nada: se deja dentro", async () => {
  const roto = `data:image/png;base64,${"A".repeat(MINIMO_BASE64_CHARS)}=`; // largo inválido
  const r = await extraerMediosEmbebidos(`<img src="${roto}">`);
  // atob tolera algunos casos; lo que importa es que no lance.
  assert.ok(typeof r.html === "string");
});

test("el peso que importa es el del HTML SIN los archivos embebidos", async () => {
  // 6 MB de video embebido: antes reventaba; ahora el editor lo saca solo.
  const html = `<html><body><video src="${uri("video/mp4", 6 * 1024 * 1024)}"></video></body></html>`;
  assert.equal(errorDePesoCodigo(html), null, "al pegar no debe asustar por algo que se resuelve solo");
  assert.ok(errorDePesoCodigo(html, { contandoMedios: true }), "el servidor sí mide lo que llegó");

  const extraido = await extraerMediosEmbebidos(html);
  assert.equal(errorDePesoCodigo(extraido.html, { contandoMedios: true }), null);
});

test("lo que pesa de verdad (no es un archivo) sigue topado", () => {
  const pesado = "<html><script>" + "x".repeat(LIMITE_CODIGO_BYTES) + "</script></html>";
  assert.ok(errorDePesoCodigo(pesado));
});

test("el marcador del archivo se cambia por su dirección; si falta, queda vacío", () => {
  const id = "0123456789ABCDEF";
  const html = `<img src="${marcadorDeMedio(id)}"><img src="{{MEDIO_FFFFFFFFFFFFFFFF}}">`;
  const salida = aplicarMarcadores(html, {
    fotos: [],
    archivos: { [id]: "https://almacen.test/a.png?token=t" },
  });
  assert.ok(salida.includes('src="https://almacen.test/a.png?token=t"'));
  assert.ok(!salida.includes("MEDIO_"), "un marcador sin archivo no se le enseña al invitado");
});

test("ampliar el patrón de marcadores no rompió los de siempre", () => {
  const salida = aplicarMarcadores("{{TITULO}} {{FECHA}} {{PORTADA}} {{FOTO_2}} {{DESCONOCIDO}}", {
    fotos: [{ nombre: "a", url: "u1" }, { nombre: "b", url: "u2" }],
    titulo: "T",
    fecha: "F",
  });
  assert.equal(salida, "T F u1 u2 {{DESCONOCIDO}}");
});

test("la ruta del archivo cuelga de la subcarpeta del código, fuera de las fotos del plan", () => {
  assert.equal(rutaDeMedioCodigo("ped1", "0123456789ABCDEF"), "ped1/codigo/0123456789ABCDEF");
});

test("una imagen embebida no dispara el aviso de «sin marcador de foto»", () => {
  const conData = revisarCodigo(`<html><img src="data:image/png;base64,AAAA"></html>`);
  assert.ok(!conData.some((a) => a.texto.includes("marcador")));
  const conMedio = revisarCodigo(`<html><img src="{{MEDIO_0123456789ABCDEF}}"></html>`);
  assert.ok(!conMedio.some((a) => a.texto.includes("marcador")));
  const ajena = revisarCodigo(`<html><img src="https://x.test/y.jpg"></html>`);
  assert.ok(ajena.some((a) => a.texto.includes("marcador")), "una imagen de otro sitio sigue avisando");
});

test("htmlSinMedios solo cambia lo que se sacaría", () => {
  const html = `a ${uri("image/png", 20_000)} b data:image/png;base64,AAAA c`;
  const sin = htmlSinMedios(html);
  assert.ok(sin.includes("{{MEDIO_"));
  assert.ok(sin.includes("data:image/png;base64,AAAA"), "lo diminuto no se toca");
});
