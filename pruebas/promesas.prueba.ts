import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizarDominio, dominioValido, esHostPropio, hostSinPuerto,
  seSirveEnCualquierDominio,
} from "@/lib/dominios";
import { conVideoDePortada, esVideo } from "@/lib/fotos";
import { EXTRAS, LIMITE_FOTOS } from "@/lib/planes";
import { EFECTOS_POR_DEFECTO } from "@/lib/tipos";

/**
 * LAS DOS PROMESAS DEL FORMULARIO
 * ================================
 * El catálogo vendía dos cosas que el sistema no sabía entregar: el video
 * de portada del plan Luxury y el dominio propio. Estas pruebas cuidan que
 * lo que se cobra siga teniendo detrás algo que funcione.
 */

/* ============================================================
   1. VIDEO DE PORTADA
   ============================================================ */

const foto = (nombre: string) => ({ nombre, url: `https://x/${nombre}`, urlMiniatura: `https://x/min-${nombre}` });

test("el extra que promete el video sigue existiendo en el catálogo", () => {
  // Si Luxury dejara de incluirlo, esta prueba avisa de que hay código
  // manteniéndose para algo que ya no se vende.
  assert.equal(LIMITE_FOTOS.luxury, Infinity);
  assert.equal(EFECTOS_POR_DEFECTO.videoPortada, true, "sin esto el video no se ve solo");
});

test("el video se pone delante de las fotos", () => {
  const medios = conVideoDePortada([foto("a.jpg"), foto("b.jpg")], foto("video-1.mp4"));
  assert.equal(medios.length, 3);
  assert.equal(medios[0].nombre, "video-1.mp4", "las plantillas usan fotos[0] como portada");
  assert.deepEqual(medios.slice(1).map((m) => m.nombre), ["a.jpg", "b.jpg"]);
});

test("la miniatura del video pasa a ser la primera foto", () => {
  // Es lo que se ve mientras el video carga y lo que queda fijo para quien
  // tiene activado "reducir movimiento" en su teléfono.
  const medios = conVideoDePortada([foto("a.jpg")], foto("video-1.mp4"));
  assert.equal(medios[0].urlMiniatura, "https://x/a.jpg");
});

test("sin fotos, el video no se queda sin respaldo pero tampoco inventa uno", () => {
  const medios = conVideoDePortada([], foto("video-1.mp4"));
  assert.equal(medios[0].urlMiniatura, medios[0].url, "el componente sabe que no hay respaldo");
});

test("apagar el interruptor deja las fotos como estaban", () => {
  const fotos = [foto("a.jpg")];
  assert.deepEqual(conVideoDePortada(fotos, foto("video-1.mp4"), false), fotos);
});

test("sin video no cambia nada", () => {
  const fotos = [foto("a.jpg"), foto("b.jpg")];
  assert.deepEqual(conVideoDePortada(fotos, undefined), fotos);
  assert.deepEqual(
    conVideoDePortada(fotos, { nombre: "video-1.mp4", url: "", urlMiniatura: "" }),
    fotos,
    "un video sin URL firmada no sirve de portada"
  );
});

test("el video se reconoce por el nombre con el que se guarda", () => {
  // Es el mismo prefijo que pone la ruta de subida; si se cambiara en un
  // sitio y no en el otro, el video se colaría en la galería.
  assert.equal(esVideo("video-abc.mp4"), true);
  assert.equal(esVideo("abc.mp4"), false);
});

/* ============================================================
   2. DOMINIO PROPIO
   ============================================================ */

test("el extra de dominio sigue vendiéndose al precio del catálogo", () => {
  const extra = EXTRAS.find((e) => e.id === "dominio_propio");
  assert.ok(extra, "si se deja de vender, sobra el soporte de dominios");
  assert.equal(extra!.precioDOP, 1500);
});

test("el dominio se guarda igual se escriba como se escriba", () => {
  // El equipo copia y pega lo que le manda el cliente por WhatsApp.
  for (const escrito of [
    "bodacamila.com",
    "BodaCamila.com",
    "  bodacamila.com  ",
    "https://bodacamila.com",
    "http://www.bodacamila.com/",
    "www.BodaCamila.com",
    "bodacamila.com:443",
    "https://bodacamila.com/invitacion?x=1",
  ]) {
    assert.equal(normalizarDominio(escrito), "bodacamila.com", `falló con "${escrito}"`);
  }
});

test("un subdominio no se confunde con www", () => {
  assert.equal(normalizarDominio("boda.camila.com"), "boda.camila.com");
  assert.equal(normalizarDominio("www.boda.camila.com"), "boda.camila.com");
});

test("se rechaza lo que no tiene forma de dominio", () => {
  for (const malo of ["", "midominio", "mi dominio.com", "boda..com", "boda.c", "boda.123", "-boda.com"]) {
    assert.equal(dominioValido(normalizarDominio(malo)), false, `se aceptó "${malo}"`);
  }
});

test("se aceptan los dominios normales", () => {
  for (const bueno of ["bodacamila.com", "boda-camila.com.do", "camila2027.net", "boda.camila.com"]) {
    assert.equal(dominioValido(bueno), true, `se rechazó "${bueno}"`);
  }
});

/* ---------- Qué host es de quién ---------- */

const BASE = "https://studio.invifty.com";

test("el dominio del Studio nunca se toma por el de un cliente", () => {
  // Si esto fallara, el panel dejaría de existir: toda petición acabaría
  // buscando una invitación por dominio.
  assert.equal(esHostPropio("studio.invifty.com", BASE), true);
  assert.equal(esHostPropio("www.studio.invifty.com", BASE), true);
  assert.equal(esHostPropio("studio.invifty.com:443", BASE), true);
  assert.equal(esHostPropio("localhost:3000", BASE), true);
  assert.equal(esHostPropio("invifty-studio-abc123.vercel.app", BASE), true);
});

test("el dominio de un cliente se reconoce como ajeno", () => {
  assert.equal(esHostPropio("bodacamila.com", BASE), false);
  assert.equal(esHostPropio("www.bodacamila.com", BASE), false);
});

test("invifty.com es de la casa aunque la base configurada sea otra", () => {
  // Lo que pasó en producción: studio.invifty.com registrado en Vercel,
  // pero NEXT_PUBLIC_APP_URL apuntando todavía a la URL vieja. El proxy
  // tomaba nuestro propio dominio por el de un cliente y el panel entero
  // respondía 404. La marca va fija en la lista de dominios propios para
  // que ese desajuste de configuración no vuelva a tumbar el Studio.
  const baseVieja = "https://invifty-studio.vercel.app";
  assert.equal(esHostPropio("studio.invifty.com", baseVieja), true);
  assert.equal(esHostPropio("invifty.com", baseVieja), true);
  assert.equal(esHostPropio("www.invifty.com", baseVieja), true);
  // Y un cliente sigue siendo un cliente, con la base que sea.
  assert.equal(esHostPropio("bodacamila.com", baseVieja), false);
});

test("sin dirección propia configurada, todo se trata como propio", () => {
  // Preferimos que un despliegue mal configurado deje el panel accesible
  // antes que servir una invitación en su lugar.
  assert.equal(esHostPropio("bodacamila.com", ""), true);
  assert.equal(esHostPropio("", BASE), true);
});

test("la API responde igual en el dominio del cliente", () => {
  // De ahí salen las confirmaciones de asistencia y el conteo de visitas de
  // esa misma invitación: desviarlas la dejaría sin RSVP.
  assert.equal(seSirveEnCualquierDominio("/api/invitacion/boda/rsvp"), true);
  assert.equal(seSirveEnCualquierDominio("/api/invitacion/boda/visita"), true);
  assert.equal(seSirveEnCualquierDominio("/_next/static/chunk.js"), true);
  assert.equal(seSirveEnCualquierDominio("/favicon.ico"), true);
});

test("el resto de rutas sí se desvían a la invitación del dominio", () => {
  // En el dominio del cliente no hay panel ni formularios: todo es su
  // invitación, incluida la raíz.
  assert.equal(seSirveEnCualquierDominio("/"), false);
  assert.equal(seSirveEnCualquierDominio("/panel"), false);
  assert.equal(seSirveEnCualquierDominio("/i/otra-boda"), false);
});

test("el puerto no cambia de quién es el host", () => {
  assert.equal(hostSinPuerto("bodacamila.com:3000"), "bodacamila.com");
  assert.equal(hostSinPuerto("BODACAMILA.COM."), "bodacamila.com");
});
