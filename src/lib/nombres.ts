/**
 * NOMBRES COMPARABLES
 * ====================
 * "José  Pérez", "jose perez" y "JOSE PEREZ" son la misma persona. Sin
 * normalizar, el sistema los contaría como tres invitados distintos.
 *
 * Vive aparte porque lo usan dos sitios que TIENEN que coincidir: el que
 * guarda una confirmación (api/invitacion/[slug]/rsvp) y el que cruza esa
 * confirmación con la lista de invitados del anfitrión (lib/lista.ts). Si
 * cada uno normalizara a su manera, un invitado confirmaría y aun así
 * seguiría apareciendo como "sin responder".
 */

/** Sin acentos, en minúsculas y con los espacios colapsados. */
export function normalizarNombre(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
