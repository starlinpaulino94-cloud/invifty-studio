import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { escribirEnRuta, leerRuta } from "@/lib/rutas";
import { EFECTOS_POR_DEFECTO } from "@/lib/tipos";
import type { DatosInvitacion } from "@/lib/tipos";

/**
 * EDICIÓN ENCIMA DEL DISEÑO
 * ==========================
 * Cada texto editable de la invitación lleva escrita la ruta donde vive
 * dentro de los datos. Una errata en esa ruta no rompe nada visible: el
 * equipo escribe encima, ve el cambio en pantalla porque lo escribió el
 * navegador, y al guardar no se guarda nada. Por eso la última prueba de
 * este archivo recorre las plantillas y comprueba que cada ruta existe.
 */

/* ---------- Escribir en una ruta ---------- */

const base = () => ({
  titulo: "Camila & Lucas",
  lugares: [
    { nombre: "Ceremonia", detalle: "Iglesia Santa Ana" },
    { nombre: "Recepción", detalle: "Casa de Campo" },
  ],
});

test("un campo suelto se cambia", () => {
  const salida = escribirEnRuta(base(), "titulo", "Rosa & Manuel");
  assert.equal(salida.titulo, "Rosa & Manuel");
});

test("un campo dentro de una lista se cambia por su posición", () => {
  const salida = escribirEnRuta(base(), "lugares.1.nombre", "Fiesta");
  assert.equal(salida.lugares[1].nombre, "Fiesta");
  assert.equal(salida.lugares[0].nombre, "Ceremonia", "el otro no se toca");
});

test("no se muta el objeto original", () => {
  // El editor guarda los datos en el estado de React: mutarlos haría que la
  // vista previa no se enterara del cambio.
  const original = base();
  const salida = escribirEnRuta(original, "lugares.0.nombre", "Otra cosa");

  assert.equal(original.lugares[0].nombre, "Ceremonia");
  assert.notEqual(salida, original);
  assert.notEqual(salida.lugares, original.lugares);
  assert.notEqual(salida.lugares[0], original.lugares[0]);
  assert.equal(salida.lugares[1], original.lugares[1], "lo que no cambia se comparte");
});

test("una posición que no existe no crea huecos en la lista", () => {
  // Escribir en lugares.5 con tres lugares dejaría dos tarjetas en blanco
  // en la invitación publicada.
  const salida = escribirEnRuta(base(), "lugares.5.nombre", "Fantasma");
  assert.deepEqual(salida, base());
});

test("un campo que no existe no se inventa", () => {
  const salida = escribirEnRuta(base(), "inventado", "x") as Record<string, unknown>;
  assert.ok(!("inventado" in salida));
});

test("no se escribe encima de algo que no es texto", () => {
  // "lugares" es una lista: escribir ahí la convertiría en una cadena y la
  // invitación dejaría de dibujar sus tarjetas.
  const salida = escribirEnRuta(base(), "lugares", "texto suelto");
  assert.ok(Array.isArray(salida.lugares));
});

test("no se puede tocar el prototipo por la ruta", () => {
  const salida = escribirEnRuta(base(), "__proto__.contaminado", "sí") as Record<string, unknown>;
  assert.equal(({} as Record<string, unknown>).contaminado, undefined);
  assert.deepEqual(salida, base());
});

test("una ruta vacía o rota se ignora", () => {
  assert.deepEqual(escribirEnRuta(base(), "", "x"), base());
  assert.deepEqual(escribirEnRuta(base(), "lugares..nombre", "x"), base());
  assert.deepEqual(escribirEnRuta(base(), "titulo.", "x"), base());
});

test("se puede vaciar un texto", () => {
  // Borrarlo todo es una edición legítima: la sección deja de mostrarse.
  assert.equal(escribirEnRuta(base(), "titulo", "").titulo, "");
});

test("leer una ruta que no existe no revienta", () => {
  assert.equal(leerRuta(base(), "lugares.9.nombre"), undefined);
  assert.equal(leerRuta(base(), "titulo.largo"), undefined);
  assert.equal(leerRuta(base(), "lugares.nombre"), undefined, "una lista no se indexa por nombre");
  assert.equal(leerRuta(null, "titulo"), undefined);
});

/* ---------- Las rutas escritas en las plantillas existen ---------- */

/** Una invitación con algo en cada lista, para que las rutas .0. resuelvan. */
const INVITACION_COMPLETA: DatosInvitacion = {
  titulo: "Camila & Lucas",
  subtitulo: "Nos casamos",
  frase: "Y todo empezó con un café",
  fechaEvento: "2027-02-14",
  horaEvento: "17:00",
  lugares: [{ nombre: "Ceremonia", detalle: "Iglesia Santa Ana, Santiago" }],
  historia: "Nos conocimos un martes cualquiera.",
  cronograma: [{ hora: "17:00", actividad: "Ceremonia" }],
  padrinos: [{ rol: "Padrino", nombre: "Manuel Peña" }],
  regalos: [{ titulo: "Cuenta de ahorros", detalle: "Banco Popular 1234567" }],
  notas: [{ titulo: "Parqueo", texto: "Hay estacionamiento en el sótano." }],
  mensajeFinal: "Los esperamos con el alma.",
  dressCode: "formal",
  monograma: "C&L",
  paleta: "champan_marfil",
  tipografia: "clasica",
  densidad: "equilibrado",
  musicaUrl: "",
  ordenFotos: [],
  fotosOcultas: [],
  efectos: { ...EFECTOS_POR_DEFECTO },
  rsvp: { whatsapp: "18090000000", fechaLimite: "2027-01-14", acompanantes: true },
  secciones: {
    historia: true,
    cronograma: true,
    galeria: true,
    regalos: true,
    rsvp: true,
    padrinos: true,
    notas: true,
  },
};

/** Todas las rutas escritas en los componentes de la invitación. */
function rutasDeclaradas(): { archivo: string; ruta: string }[] {
  const raiz = path.resolve(import.meta.dirname, "../src/components/invitacion");
  const encontradas: { archivo: string; ruta: string }[] = [];

  const recorrer = (dir: string) => {
    for (const entrada of readdirSync(dir, { withFileTypes: true })) {
      const completa = path.join(dir, entrada.name);
      if (entrada.isDirectory()) {
        recorrer(completa);
        continue;
      }
      if (!entrada.name.endsWith(".tsx")) continue;

      const codigo = readFileSync(completa, "utf8");
      // ruta="titulo"  y  ruta={`lugares.${i}.nombre`}
      for (const m of codigo.matchAll(/ruta="([^"]+)"/g)) {
        encontradas.push({ archivo: entrada.name, ruta: m[1] });
      }
      for (const m of codigo.matchAll(/ruta=\{`([^`]+)`\}/g)) {
        // El índice de la lista se resuelve en tiempo de ejecución; para
        // comprobar la forma basta con la primera posición.
        encontradas.push({ archivo: entrada.name, ruta: m[1].replace(/\$\{\w+\}/g, "0") });
      }
    }
  };

  recorrer(raiz);
  return encontradas;
}

test("hay textos editables declarados", () => {
  // Si un refactor se llevara por delante los <Texto>, la prueba de abajo
  // pasaría sin comprobar nada.
  assert.ok(rutasDeclaradas().length > 20, "faltan textos editables en las plantillas");
});

test("cada texto editable apunta a un campo que existe y es texto", () => {
  for (const { archivo, ruta } of rutasDeclaradas()) {
    const valor = leerRuta(INVITACION_COMPLETA, ruta);
    assert.equal(
      typeof valor,
      "string",
      `${archivo} declara ruta="${ruta}", que no lleva a ningún texto de la invitación. ` +
        `El equipo escribiría encima, vería el cambio en pantalla y al guardar no se guardaría nada.`
    );
  }
});

test("lo que se escribe encima acaba en los datos, ruta por ruta", () => {
  for (const { ruta } of rutasDeclaradas()) {
    const salida = escribirEnRuta(INVITACION_COMPLETA, ruta, "TEXTO NUEVO");
    assert.equal(leerRuta(salida, ruta), "TEXTO NUEVO", `no se pudo escribir en "${ruta}"`);
  }
});

test("las doce plantillas dejan editar el título de la portada", () => {
  // La portada es la única parte que cada plantilla compone a su manera:
  // una nueva que se olvide del <Texto> dejaría el título sin editar.
  const plantillas = readdirSync(
    path.resolve(import.meta.dirname, "../src/components/invitacion/plantillas")
  ).filter((f) => f.endsWith(".tsx"));

  assert.ok(plantillas.length >= 12);
  for (const archivo of plantillas) {
    const rutas = rutasDeclaradas().filter((r) => r.archivo === archivo).map((r) => r.ruta);
    assert.ok(rutas.includes("titulo"), `${archivo} no deja editar el título encima del diseño`);
  }
});
