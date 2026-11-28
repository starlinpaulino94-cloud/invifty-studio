import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";

import { candidatosDeImagen, encuadreDe } from "@/lib/vista-previa";
import {
  imagenPrincipalDeVista, jpegDeVistaPrevia, type InvitacionParaVista,
} from "@/lib/vista-previa-servidor";

/**
 * LA IMAGEN DEL ENLACE COMPARTIDO
 * ================================
 * Si esto se rompe, el enlace sale por WhatsApp como un texto seco o,
 * peor, con la foto de otro pedido o la de un borrador.
 */

const ID_A = "A".repeat(16);
const ID_B = "B1".repeat(8);

/* ---------- Qué imagen elegir ---------- */

test("la primera imagen del HTML es la primera candidata", () => {
  const html = `<img src="{{MEDIO_${ID_A}}}"><img src="{{FOTO_2}}">`;
  assert.deepEqual(candidatosDeImagen(html), [
    { tipo: "medio", id: ID_A },
    { tipo: "foto", indice: 2 },
  ]);
});

test("{{PORTADA}} es la foto 1 y no se repite con {{FOTO_1}}", () => {
  assert.deepEqual(candidatosDeImagen("{{PORTADA}} {{FOTO_1}}"), [{ tipo: "foto", indice: 1 }]);
});

test("una tipografía alojada no se confunde con una imagen", () => {
  const html = `<style>@font-face{font-family:X;src:url({{MEDIO_${ID_A}}})}</style><img src="{{MEDIO_${ID_B}}}">`;
  assert.deepEqual(candidatosDeImagen(html), [{ tipo: "medio", id: ID_B }]);
});

test("las imágenes externas y los marcadores de texto no cuentan", () => {
  const html = `<img src="https://otro.sitio/x.jpg"><h1>{{TITULO}} {{FECHA}} {{FOTO_0}} {{INVENTADO}}</h1>`;
  assert.deepEqual(candidatosDeImagen(html), []);
});

test("sin HTML no hay candidatas, y no son más de cuatro", () => {
  assert.deepEqual(candidatosDeImagen(null), []);
  assert.deepEqual(candidatosDeImagen(""), []);
  const muchas = Array.from({ length: 9 }, (_, i) => `{{FOTO_${i + 1}}}`).join(" ");
  assert.equal(candidatosDeImagen(muchas).length, 4);
});

/* ---------- Cómo se encuadra ---------- */

test("el cartel vertical se enseña entero; el paisaje llena la tarjeta", () => {
  assert.equal(encuadreDe(1080, 1920), "contener");
  assert.equal(encuadreDe(1000, 1000), "contener");
  assert.equal(encuadreDe(4000, 3000), "contener"); // 4:3 perdería un tercio en alto
  assert.equal(encuadreDe(1600, 1000), "cubrir"); // 16:10 pierde poco
  assert.equal(encuadreDe(3000, 1500), "cubrir");
  assert.equal(encuadreDe(0, 0), "contener");
});

/* ---------- La conversión ---------- */

async function imagen(ancho: number, alto: number, formato: "png" | "webp" = "png") {
  const base = sharp({
    create: { width: ancho, height: alto, channels: 3, background: { r: 200, g: 40, b: 90 } },
  });
  return formato === "png" ? base.png().toBuffer() : base.webp().toBuffer();
}

test("sale siempre un JPEG de 1200 × 630 y ligero, venga como venga", async () => {
  for (const [w, h] of [[4000, 3000], [1080, 1920], [800, 800], [3000, 1400], [200, 300]]) {
    const jpeg = await jpegDeVistaPrevia(await imagen(w, h));
    const meta = await sharp(jpeg).metadata();
    assert.equal(meta.format, "jpeg");
    assert.equal(meta.width, 1200, `${w}x${h}`);
    assert.equal(meta.height, 630, `${w}x${h}`);
    assert.ok(jpeg.length < 300 * 1024, `${w}x${h} pesa ${jpeg.length}`);
  }
});

test("una foto vertical conserva el centro entero (no se recorta)", async () => {
  // Franja vertical blanca en el centro de un cartel negro: si se recortara
  // a 1,91:1 seguiría ahí; lo que importa es que el cartel entero cabe y
  // que los laterales son el fondo difuminado (no negro puro ni blanco).
  const cartel = await sharp({
    create: { width: 600, height: 1200, channels: 3, background: { r: 255, g: 255, b: 255 } },
  }).png().toBuffer();
  const jpeg = await jpegDeVistaPrevia(cartel);
  const { data, info } = await sharp(jpeg).raw().toBuffer({ resolveWithObject: true });
  const px = (x: number, y: number) => data[(y * info.width + x) * info.channels];
  assert.ok(px(600, 315) > 240, "el centro es la imagen, blanca");
  assert.ok(px(20, 315) < 250, "los laterales son el fondo apagado, no la imagen");
});

test("algo que no es una imagen lanza, para probar con la siguiente", async () => {
  await assert.rejects(() => jpegDeVistaPrevia(Buffer.from("esto es un video, no una foto")));
});

/* ---------- Qué se baja y qué no ---------- */

function fingirAdmin(opciones: {
  raiz?: string[];
  derivados?: string[];
  codigo?: Record<string, { mimetype: string; size: number }>;
  contenidos: Record<string, Buffer>;
}) {
  const descargas: string[] = [];
  const admin = {
    storage: {
      from: () => ({
        list: async (carpeta: string) => {
          if (carpeta.endsWith("/derivados"))
            return { data: (opciones.derivados ?? []).map((name) => ({ name, id: "1" })) };
          if (carpeta.endsWith("/codigo"))
            return {
              data: Object.entries(opciones.codigo ?? {}).map(([name, m]) => ({
                name, id: "1", metadata: m,
              })),
            };
          return { data: (opciones.raiz ?? []).map((name) => ({ name, id: "1" })) };
        },
        download: async (ruta: string) => {
          descargas.push(ruta);
          const b = opciones.contenidos[ruta];
          return b ? { data: new Blob([new Uint8Array(b)]), error: null } : { data: null, error: {} };
        },
      }),
    },
  };
  return { admin: admin as never, descargas };
}

const inv = (parte: Partial<InvitacionParaVista>): InvitacionParaVista => ({
  estado: "publicada",
  plantilla: "clasica",
  codigo_html: null,
  pedido_id: "P1",
  datos: {} as never,
  ...parte,
});

test("un borrador no enseña nada", async () => {
  const { admin, descargas } = fingirAdmin({ raiz: ["a.jpg"], contenidos: { "P1/a.jpg": await imagen(800, 800) } });
  assert.equal(await imagenPrincipalDeVista(admin, inv({ estado: "borrador" })), null);
  assert.deepEqual(descargas, []);
});

test("sin fotos no hay imagen: se dibujará la tarjeta", async () => {
  const { admin } = fingirAdmin({ contenidos: {} });
  assert.equal(await imagenPrincipalDeVista(admin, inv({})), null);
});

test("usa la portada que eligió el equipo, en su versión ligera", async () => {
  const { admin, descargas } = fingirAdmin({
    raiz: ["a.jpg", "b.jpg"],
    derivados: ["web-b.jpg.webp"],
    contenidos: { "P1/derivados/web-b.jpg.webp": await imagen(1600, 1000, "webp") },
  });
  const r = await imagenPrincipalDeVista(admin, inv({ datos: { ordenFotos: ["b.jpg", "a.jpg"] } as never }));
  assert.ok(r);
  assert.deepEqual(descargas, ["P1/derivados/web-b.jpg.webp"]);
});

test("una foto oculta no puede ser la imagen del enlace", async () => {
  const { admin, descargas } = fingirAdmin({
    raiz: ["a.jpg", "b.jpg"],
    contenidos: { "P1/b.jpg": await imagen(800, 800) },
  });
  const r = await imagenPrincipalDeVista(admin, inv({ datos: { fotosOcultas: ["a.jpg"] } as never }));
  assert.ok(r);
  assert.deepEqual(descargas, ["P1/b.jpg"]);
});

test("un video de portada no se usa como imagen", async () => {
  const { admin, descargas } = fingirAdmin({ raiz: ["video-x.mp4"], contenidos: {} });
  assert.equal(await imagenPrincipalDeVista(admin, inv({})), null);
  assert.deepEqual(descargas, []);
});

test("código propio: usa la primera imagen del HTML, no un video ni una tipografía", async () => {
  const html = `<video poster="x"><source src="{{MEDIO_${ID_A}}}"></video><img src="{{MEDIO_${ID_B}}}">`;
  const { admin, descargas } = fingirAdmin({
    codigo: {
      [ID_A]: { mimetype: "video/mp4", size: 40_000_000 },
      [ID_B]: { mimetype: "image/webp", size: 90_000 },
    },
    contenidos: { [`P1/codigo/${ID_B}`]: await imagen(1080, 1920, "webp") },
  });
  const r = await imagenPrincipalDeVista(admin, inv({ plantilla: "codigo", codigo_html: html }));
  assert.ok(r);
  // El video de 40 MB nunca se baja: el tipo se lee del listado.
  assert.deepEqual(descargas, [`P1/codigo/${ID_B}`]);
});

test("código propio sin imágenes alojadas cae en la portada del pedido", async () => {
  const { admin, descargas } = fingirAdmin({
    raiz: ["a.jpg"],
    contenidos: { "P1/a.jpg": await imagen(900, 600) },
  });
  const r = await imagenPrincipalDeVista(
    admin,
    inv({ plantilla: "codigo", codigo_html: `<img src="https://externa/x.jpg">` })
  );
  assert.ok(r);
  assert.deepEqual(descargas, ["P1/a.jpg"]);
});
