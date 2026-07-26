/**
 * DIRECCIONES DE LAS INVITACIONES
 * ================================
 * Cómo se arma la dirección pública de una invitación, /i/<slug>, y por qué
 * las nuevas llevan un sufijo al azar detrás.
 *
 * Vive aparte de `invitacion.ts` porque el editor lo necesita en el
 * navegador, y no tiene sentido mandarle de paso todo el traductor de
 * respuestas del formulario.
 */

/** Convierte texto a slug de URL: "Camila & Lucas" → "camila-y-lucas" */
export function slugificar(t: string): string {
  return (
    t
      .toLowerCase()
      .replace(/&/g, " y ")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "invitacion"
  );
}

/* ---------- Sufijo que hace la dirección no adivinable ---------- */

/**
 * DIRECCIONES QUE NO SE PUEDEN ADIVINAR
 * ======================================
 * Un slug sacado solo del título es enumerable: "boda-maria-y-jose" no cuesta
 * nada de acertar, y quien acierte ve la dirección del evento, la fecha, las
 * fotos privadas y el WhatsApp del anfitrión. La página lleva `noindex`, así
 * que Google no la lista — pero eso no protege de quien prueba a mano.
 *
 * Por eso cada invitación NUEVA lleva un sufijo corto al final:
 * "camila-y-lucas-k3f9m". Se sigue leyendo bien al compartirla por WhatsApp y
 * deja de ser una dirección que se pueda ir probando.
 *
 * Las que ya estaban publicadas NO se tocan: su enlace ya está repartido
 * entre los invitados y cambiarlo lo rompería. Si a una vieja hiciera falta
 * protegerla, el equipo puede darle un sufijo desde el editor.
 */

/**
 * Sin vocales ni caracteres que se confundan al leerlos en voz alta o
 * copiarlos a mano: se van 0/o, 1/l/i. Además, sin vocales no puede salir
 * una palabra desafortunada pegada al nombre de los novios.
 */
const ALFABETO_SUFIJO = "bcdfghjkmnpqrstvwxyz23456789";

/** Cinco caracteres: unos 17 millones de combinaciones por título. */
export const LARGO_SUFIJO = 5;

/**
 * Un sufijo al azar. Usa el generador criptográfico del sistema y no
 * Math.random: lo que se busca es justo que no se pueda predecir.
 */
export function sufijoDeSlug(largo = LARGO_SUFIJO): string {
  const bytes = new Uint8Array(largo);
  crypto.getRandomValues(bytes);

  // El módulo sesga un poco hacia los primeros caracteres, pero el alfabeto
  // (28) cabe 9 veces en 256: el sesgo es de milésimas y no cambia en nada
  // lo difícil que es acertar el sufijo.
  return Array.from(bytes, (b) => ALFABETO_SUFIJO[b % ALFABETO_SUFIJO.length]).join("");
}

/** "camila-y-lucas" → "camila-y-lucas-k3f9m" */
export function slugConSufijo(base: string, sufijo = sufijoDeSlug()): string {
  // El slug ya viene recortado a 60; se le deja sitio al sufijo en vez de
  // cortarlo por la mitad y perder la protección.
  const raiz = slugificar(base)
    .slice(0, 60 - sufijo.length - 1)
    .replace(/-+$/, "");
  return `${raiz || "invitacion"}-${sufijo}`;
}

/**
 * ¿Este slug ya lleva sufijo? Sirve para no encadenar uno detrás de otro
 * cuando el equipo vuelve a guardar la misma invitación.
 */
export function tieneSufijo(slug: string): boolean {
  const ultimo = (slug ?? "").split("-").at(-1) ?? "";
  return (
    ultimo.length === LARGO_SUFIJO && [...ultimo].every((c) => ALFABETO_SUFIJO.includes(c))
  );
}
