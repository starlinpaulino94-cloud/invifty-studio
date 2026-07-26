/**
 * ESCRIBIR EN UN CAMPO POR SU RUTA
 * =================================
 * La edición encima del diseño necesita decir "esto que acabas de escribir
 * va en `lugares.0.nombre`". Cada texto editable de la invitación lleva su
 * ruta, y aquí se aplica el cambio sobre los datos.
 *
 * Dos reglas que no son negociables:
 *
 *  · No se muta nada. El editor guarda los datos en el estado de React y
 *    mutar el objeto haría que la vista previa no se enterara del cambio.
 *  · Una ruta que no existe no se inventa. Escribir en `lugares.5.nombre`
 *    cuando solo hay tres lugares dejaría dos huecos vacíos en el array y
 *    la invitación publicada mostraría tarjetas en blanco.
 */

/** Nombres que nunca se recorren: escribir ahí toca el prototipo, no el dato. */
const PROHIBIDOS = new Set(["__proto__", "prototype", "constructor"]);

function esIndice(segmento: string): boolean {
  return /^\d+$/.test(segmento);
}

/** Copia superficial conservando el tipo (array u objeto). */
function copiar(valor: unknown): Record<string, unknown> | unknown[] {
  return Array.isArray(valor) ? [...valor] : { ...(valor as Record<string, unknown>) };
}

/**
 * Devuelve el valor que hay en una ruta, o undefined si no existe.
 * Se usa para comprobar que la ruta es real antes de escribir en ella.
 */
export function leerRuta(objeto: unknown, ruta: string): unknown {
  const segmentos = ruta.split(".");
  let actual: unknown = objeto;

  for (const segmento of segmentos) {
    if (PROHIBIDOS.has(segmento)) return undefined;
    if (actual === null || typeof actual !== "object") return undefined;
    if (Array.isArray(actual) && !esIndice(segmento)) return undefined;
    actual = (actual as Record<string, unknown>)[segmento];
  }

  return actual;
}

/**
 * Devuelve una copia de `objeto` con `valor` escrito en `ruta`.
 *
 * Si la ruta no lleva a un texto que ya exista, devuelve el objeto tal cual:
 * este camino solo sirve para cambiar textos que la invitación ya muestra,
 * no para crear campos nuevos. Eso lo hacen las tarjetas del editor.
 */
export function escribirEnRuta<T>(objeto: T, ruta: string, valor: string): T {
  if (!ruta) return objeto;

  const segmentos = ruta.split(".");
  if (segmentos.some((s) => !s || PROHIBIDOS.has(s))) return objeto;

  // Solo se cambia lo que ya es texto. Así una ruta con una errata no
  // añade un campo fantasma a los datos de la invitación.
  if (typeof leerRuta(objeto, ruta) !== "string") return objeto;

  const raiz = copiar(objeto);
  let actual: Record<string, unknown> | unknown[] = raiz;

  for (let i = 0; i < segmentos.length - 1; i++) {
    const segmento = segmentos[i];
    const hijo = (actual as Record<string, unknown>)[segmento];
    const copia = copiar(hijo);
    (actual as Record<string, unknown>)[segmento] = copia;
    actual = copia;
  }

  (actual as Record<string, unknown>)[segmentos.at(-1)!] = valor;
  return raiz as T;
}
