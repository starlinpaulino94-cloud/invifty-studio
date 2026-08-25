/**
 * BORRAR PARA SIEMPRE — las reglas puras
 * =======================================
 * Aquí no hay papelera: eliminar un pedido arrastra en cascada sus
 * formularios, pagos, invitación, confirmaciones, invitados y fotos.
 * Por eso las reglas viven puras y probadas:
 *
 *  - La confirmación se ESCRIBE ("ELIMINAR"), no se clickea: un click
 *    se da sin leer, ocho letras no.
 *  - Un cliente solo se borra cuando ya no tiene pedidos: así nadie
 *    borra "un cliente" sin ver primero todo lo que se lleva.
 *  - La auditoría se escribe ANTES de borrar (la fila de auditoría no
 *    tiene FK al pedido: sobrevive y cuenta qué había).
 */

/** Lo que hay que escribir para confirmar. En mayúsculas, sin trucos. */
export const CONFIRMACION_ELIMINAR = "ELIMINAR";

export function confirmacionCorrecta(texto: string): boolean {
  return texto.trim() === CONFIRMACION_ELIMINAR;
}

/**
 * El resumen de lo que se lleva borrar un pedido, para enseñarlo ANTES
 * de pedir la confirmación — que se sepa qué se firma.
 */
export function queSeLleva(cuenta: {
  pagos: number;
  fotos: number;
  invitados: number;
  confirmaciones: number;
  tieneInvitacion: boolean;
}): string[] {
  const piezas: string[] = [];
  if (cuenta.pagos > 0) piezas.push(`${cuenta.pagos} pago${cuenta.pagos === 1 ? "" : "s"} registrados`);
  if (cuenta.fotos > 0) piezas.push(`${cuenta.fotos} foto${cuenta.fotos === 1 ? "" : "s"} subidas`);
  if (cuenta.tieneInvitacion) piezas.push("la invitación publicada y su enlace");
  if (cuenta.invitados > 0) piezas.push(`la lista de ${cuenta.invitados} invitados`);
  if (cuenta.confirmaciones > 0) {
    piezas.push(`${cuenta.confirmaciones} confirmación${cuenta.confirmaciones === 1 ? "" : "es"} de asistencia`);
  }
  return piezas;
}
