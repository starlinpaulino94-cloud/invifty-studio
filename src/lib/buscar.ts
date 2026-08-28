/**
 * EL BUSCADOR GLOBAL DEL PANEL — la lógica pura
 * ==============================================
 * Con cientos de pedidos, el kanban ya no alcanza para ENCONTRAR. La
 * caja del panel acepta lo que sea que el equipo tenga a mano — un
 * nombre, un teléfono, un slug, o un token pegado de un enlace — y esta
 * lógica decide QUÉ es antes de preguntar a la base, para buscar donde
 * tiene sentido y no en todos lados a ciegas.
 */

export type TipoConsulta = "token" | "telefono" | "texto";

export const MIN_CONSULTA = 2;

export function consultaValida(q: string): boolean {
  return q.trim().length >= MIN_CONSULTA;
}

/**
 * ¿Qué escribió el equipo?
 *  - 32 hex → un TOKEN pegado de un enlace (/f, /lista, /revision, /pagar).
 *  - mayormente dígitos (7+) → un TELÉFONO, aunque venga con guiones,
 *    espacios o paréntesis.
 *  - lo demás → TEXTO: nombre de cliente o slug de invitación.
 */
export function tipoDeConsulta(cruda: string): TipoConsulta {
  const q = cruda.trim();
  if (/^[a-f0-9]{32}$/i.test(q)) return "token";
  const digitos = q.replace(/\D/g, "");
  if (digitos.length >= 7 && digitos.length >= q.replace(/[\s()+-]/g, "").length) {
    return "telefono";
  }
  return "texto";
}

/** Los dígitos del teléfono, para buscar sin importar el formato. */
export function digitosDeTelefono(q: string): string {
  return q.replace(/\D/g, "");
}

/**
 * El patrón para ilike, con los comodines del usuario neutralizados: un
 * "%" escrito en la caja no puede volverse un "tráeme todo".
 */
export function patronBusqueda(q: string): string {
  return `%${q.trim().replace(/[%_]/g, "\\$&")}%`;
}
