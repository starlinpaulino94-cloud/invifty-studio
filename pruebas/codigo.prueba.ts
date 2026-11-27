import test from "node:test";
import assert from "node:assert/strict";

import {
  PLANTILLA_CODIGO, ATRIBUTOS_SANDBOX, CANAL, esInvitacionDeCodigo,
  aplicarMarcadores, revisarCodigo, inyectarPuente, esMensajeRsvp,
  LIMITE_CODIGO_BYTES, pesoCodigo, errorDePesoCodigo,
} from "@/lib/codigo";

/**
 * INVITACIONES CON CÓDIGO PROPIO
 * ===============================
 * El HTML lo escribe una herramienta externa y puede traer JavaScript. Lo
 * único que impide que ese código llegue a la sesión del equipo es el
 * aislamiento del iframe, así que eso se fija con una prueba.
 */

const foto = (nombre: string, url: string) => ({ nombre, url, urlMiniatura: url });

test("el aislamiento del iframe nunca puede incluir allow-same-origin", () => {
  // Con allow-same-origin + allow-scripts el sandbox deja de aislar: el
  // código pegado podría leer las cookies de sesión del panel.
  assert.doesNotMatch(
    ATRIBUTOS_SANDBOX,
    /allow-same-origin/,
    "quitar esta protección expondría la sesión del equipo al código pegado"
  );
  assert.match(ATRIBUTOS_SANDBOX, /allow-scripts/, "la invitación necesita poder animarse");
});

test("se reconoce cuándo una invitación usa código propio", () => {
  assert.equal(esInvitacionDeCodigo(PLANTILLA_CODIGO), true);
  assert.equal(esInvitacionDeCodigo("editorial"), false);
  assert.equal(esInvitacionDeCodigo(undefined), false);
  assert.equal(esInvitacionDeCodigo(null), false);
});

/* ---------- Marcadores ---------- */

test("los marcadores se cambian por los datos reales", () => {
  const html = `<h1>{{TITULO}}</h1><p>{{FECHA}}</p><img src="{{PORTADA}}"><img src="{{FOTO_2}}">`;
  const salida = aplicarMarcadores(html, {
    fotos: [foto("a.jpg", "https://ejemplo/a.webp"), foto("b.jpg", "https://ejemplo/b.webp")],
    titulo: "Camila & Lucas",
    fecha: "sábado, 14 de febrero de 2026",
  });

  assert.match(salida, /<h1>Camila & Lucas<\/h1>/);
  assert.match(salida, /sábado, 14 de febrero de 2026/);
  assert.match(salida, /src="https:\/\/ejemplo\/a\.webp"/);
  assert.match(salida, /src="https:\/\/ejemplo\/b\.webp"/);
});

test("un marcador de foto que no existe no se queda escrito en la invitación", () => {
  const salida = aplicarMarcadores('<img src="{{FOTO_7}}">', {
    fotos: [foto("a.jpg", "https://ejemplo/a.webp")],
  });
  assert.doesNotMatch(salida, /FOTO_7/, "el invitado no puede leer el marcador");
  assert.match(salida, /src=""/);
});

test("se admiten espacios dentro del marcador", () => {
  const salida = aplicarMarcadores("{{ TITULO }}", { fotos: [], titulo: "Boda" });
  assert.equal(salida, "Boda");
});

test("un marcador que no es del sistema se deja intacto", () => {
  // Puede ser parte del propio diseño; cambiarlo lo rompería.
  const html = "{{OTRA_COSA}}";
  assert.equal(aplicarMarcadores(html, { fotos: [] }), html);
});

test("sin fotos ni datos no se rompe nada", () => {
  const salida = aplicarMarcadores("<img src='{{PORTADA}}'>{{TITULO}}", { fotos: [] });
  assert.doesNotMatch(salida, /PORTADA|TITULO/);
});

/* ---------- Puente de confirmaciones ---------- */

test("el puente se inyecta justo antes de cerrar el cuerpo", () => {
  const salida = inyectarPuente("<html><body><h1>Hola</h1></body></html>");
  assert.ok(salida.indexOf("<script>") < salida.indexOf("</body>"), "debe ir dentro del body");
  assert.match(salida, /window\.invifty/);
  assert.match(salida, /data-invifty-rsvp/);
});

test("un HTML sin etiqueta de cierre también recibe el puente", () => {
  const salida = inyectarPuente("<h1>Solo un trozo</h1>");
  assert.match(salida, /window\.invifty/);
});

test("no se inyecta nada en un código vacío", () => {
  assert.equal(inyectarPuente(""), "");
  assert.equal(inyectarPuente("   "), "   ");
});

test("el puente habla por el canal del sistema y no por otro", () => {
  const salida = inyectarPuente("<body></body>");
  assert.match(salida, new RegExp(`canal: "${CANAL}"`));
});

test("solo se aceptan mensajes con la forma de una confirmación", () => {
  assert.equal(esMensajeRsvp({ canal: CANAL, accion: "rsvp", id: "m1", datos: {} }), true);

  // Todo lo demás se ignora: por esta ventana llegan mensajes de
  // extensiones del navegador, de otros iframes y de herramientas.
  assert.equal(esMensajeRsvp(null), false);
  assert.equal(esMensajeRsvp("hola"), false);
  assert.equal(esMensajeRsvp({ canal: "otro", accion: "rsvp", id: "m1", datos: {} }), false);
  assert.equal(esMensajeRsvp({ canal: CANAL, accion: "borrar", id: "m1", datos: {} }), false);
  assert.equal(esMensajeRsvp({ canal: CANAL, accion: "rsvp", datos: {} }), false, "sin id");
  assert.equal(esMensajeRsvp({ canal: CANAL, accion: "rsvp", id: "m1" }), false, "sin datos");
});

/* ---------- Revisión antes de publicar ---------- */

test("el código vacío se marca como error, no como aviso", () => {
  const avisos = revisarCodigo("   ");
  assert.equal(avisos.length, 1);
  assert.equal(avisos[0].tipo, "error");
});

test("se avisa de lo que rompería la invitación publicada", () => {
  const conRutaRelativa = revisarCodigo('<img src="/fotos/portada.jpg">');
  assert.ok(
    conRutaRelativa.some((a) => a.texto.includes("relativas")),
    "una ruta relativa no resuelve dentro del iframe aislado"
  );

  const conHttp = revisarCodigo('<html><img src="http://ejemplo.com/foto.jpg"></html>');
  assert.ok(conHttp.some((a) => a.texto.includes("http://")));

  const conImagenSinMarcador = revisarCodigo("<html><img src='https://x/y.jpg'></html>");
  assert.ok(
    conImagenSinMarcador.some((a) => a.texto.includes("marcador")),
    "conviene recordar que las fotos del cliente se ponen con marcadores"
  );
});

test("un código correcto no genera ruido", () => {
  const avisos = revisarCodigo(
    '<html><body><h1>{{TITULO}}</h1><img src="{{PORTADA}}"></body></html>'
  );
  assert.deepEqual(avisos, [], "avisar de más entrena al equipo a ignorar los avisos");
});

test("algo que no es HTML se detecta", () => {
  const avisos = revisarCodigo("esto es solo texto suelto");
  assert.ok(avisos.some((a) => a.tipo === "error"));
});

/**
 * EL TOPE DE PESO
 * ================
 * Un HTML pegado con imágenes en base64 pasaba de 1 MB, la acción de
 * servidor moría con «Body exceeded 1 MB limit» y el panel enseñaba una
 * pantalla de error sin explicación. El peso se valida con mensaje claro.
 */
test("un código normal cabe; uno pasado de tope se rechaza diciendo por qué", () => {
  assert.equal(errorDePesoCodigo("<html><body>hola</body></html>"), null);

  const grande = "<html><body>" + "a".repeat(LIMITE_CODIGO_BYTES) + "</body></html>";
  const motivo = errorDePesoCodigo(grande);
  assert.ok(motivo, "pasado el tope debe haber motivo");
  assert.match(motivo!, /sin contar imágenes/, "aclara que las imágenes embebidas no cuentan");
});

test("el peso cuenta bytes, no caracteres", () => {
  assert.equal(pesoCodigo("é"), 2);
  // Un millón y medio de «é» son 1,5 M caracteres pero 3 MB: pasan justo.
  const acentos = "é".repeat(Math.ceil(LIMITE_CODIGO_BYTES / 2) + 1);
  assert.ok(errorDePesoCodigo(acentos), "los caracteres de 2 bytes no deben colarse");
});

test("el aviso de peso sale también al pegar, antes de guardar", () => {
  const avisos = revisarCodigo("<html>" + "a".repeat(LIMITE_CODIGO_BYTES) + "</html>");
  assert.ok(avisos.some((a) => a.tipo === "error" && a.texto.includes("MB")));
});
