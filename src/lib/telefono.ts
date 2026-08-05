/**
 * TELÉFONOS COMPARABLES
 * ======================
 * "809-269-3214", "(809) 269 3214" y "18092693214" son el mismo WhatsApp.
 * Vive aparte porque lo comparten dos sitios que TIENEN que coincidir: el
 * alta de pedidos del panel (lib/acciones.ts) y la llegada de leads desde
 * la web (api/public/leads). Si cada uno normalizara a su manera, el mismo
 * cliente entraría dos veces y la conversión del lead no lo encontraría.
 */

/** Solo dígitos, en formato WhatsApp: a los 10 dígitos dominicanos se les antepone el 1. */
export function normalizarTelefono(t: string): string {
  const digitos = (t ?? "").replace(/\D/g, "");
  return digitos.length === 10 ? `1${digitos}` : digitos;
}

/**
 * ¿Tiene forma de teléfono real? Entre 10 y 15 dígitos ya normalizado
 * (lo que admite la numeración internacional). No comprueba que exista:
 * eso lo hace el equipo al escribirle por WhatsApp.
 */
export function telefonoValido(normalizado: string): boolean {
  return /^\d{10,15}$/.test(normalizado);
}
