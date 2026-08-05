/**
 * LA PUERTA DEL EVENTO (check-in)
 * ================================
 * El día del evento nadie tiene tiempo de leer listas: llega la familia
 * Pérez, alguien mira el teléfono, confirma cuántos entran y siguen. Lo
 * que este módulo calcula es exactamente lo que esa persona necesita ver:
 * cuántos se esperaban, cuántos ya entraron, y una alarma clara cuando
 * algo no cuadra (más gente que cupo, o un hogar que "entra" dos veces).
 *
 * Las reglas de la puerta:
 *  - La entrada se REGISTRA, no se impide: si los anfitriones deciden
 *    dejar pasar al primo de más, el sistema anota, no discute. Por eso
 *    hay avisos, no bloqueos.
 *  - Entrada parcial y reingreso son normales (la abuela llega antes,
 *    alguien sale a fumar): varias filas por hogar, y el total es la
 *    suma de las no anuladas.
 *  - Una entrada mal anotada se ANULA, no se borra: la puerta es
 *    historial, y el historial no se edita.
 *
 * El QR de cada hogar lleva SOLO su token opaco. El código corto (los
 * primeros caracteres) existe para la puerta sin cámara: se teclea.
 */

export const CODIGO_CORTO_LARGO = 6;

/** Lo que se enseña bajo el QR y se teclea en la puerta. */
export function codigoCorto(token: string): string {
  return token.slice(0, CODIGO_CORTO_LARGO).toUpperCase();
}

export interface EntradaRegistrada {
  hogar_id: string | null;
  personas: number;
  anulada_en: string | null;
}

export interface EstadoPuerta {
  /** Personas que ya entraron (filas no anuladas). */
  dentro: number;
  /** true si ya hubo alguna entrada: la segunda vez es reingreso o error. */
  yaEntro: boolean;
  /** Aviso para el operador; null cuando todo cuadra. */
  aviso: string | null;
}

/**
 * El estado de un hogar en la puerta. `esperados` es el cupo del hogar
 * (o lo que confirmó, si se conoce); con él se avisa del exceso.
 */
export function estadoPuerta(
  entradas: EntradaRegistrada[],
  hogarId: string | null,
  esperados: number | null
): EstadoPuerta {
  const propias = entradas.filter((e) => e.hogar_id === hogarId && !e.anulada_en);
  const dentro = propias.reduce((s, e) => s + e.personas, 0);
  const yaEntro = propias.length > 0;

  let aviso: string | null = null;
  if (esperados !== null && dentro > esperados) {
    aviso = `Ya entraron ${dentro} y se esperaban ${esperados}.`;
  } else if (yaEntro) {
    aviso = `Este hogar ya registró entrada (${dentro} ${dentro === 1 ? "persona" : "personas"}).`;
  }

  return { dentro, yaEntro, aviso };
}

export interface HogarBuscable {
  id: string;
  nombre: string;
  token: string;
}

/**
 * Resuelve lo que el operador tecleó o escaneó: un código corto, un token
 * completo, o un trozo de nombre. Devuelve TODAS las coincidencias — si el
 * código corto chocara (posible, aunque raro), el operador ve ambas y
 * elige, en vez de registrar a la familia equivocada.
 */
export function buscarHogar<T extends HogarBuscable>(hogares: T[], consulta: string): T[] {
  const limpia = consulta.trim().toLowerCase();
  if (limpia.length < 2) return [];

  // Un token (o su código corto) es hex; un nombre casi nunca lo es.
  const porToken = hogares.filter((h) => h.token.toLowerCase().startsWith(limpia));
  if (porToken.length > 0) return porToken;

  return hogares.filter((h) => h.nombre.toLowerCase().includes(limpia));
}

export const MAX_PERSONAS_ENTRADA = 20;

/** El tope de personas de una entrada: 1..20 y nunca NaN. */
export function personasValidas(bruto: unknown): number {
  const n = Math.floor(Number(bruto));
  if (!Number.isFinite(n)) return 1;
  return Math.min(Math.max(n, 1), MAX_PERSONAS_ENTRADA);
}
