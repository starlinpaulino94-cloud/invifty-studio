/**
 * LAS CUENTAS DONDE COBRA INVIFTY — edítalas AQUÍ
 * ================================================
 * Estas cuentas salen en la página pública de cobro (/pagar/<token>)
 * con botón de copiar campo por campo. Cambiarlas es un commit, como el
 * catálogo: una sola fuente de verdad, sin versiones viejas rodando.
 *
 * ⚠️ VIENE VACÍA A PROPÓSITO: aquí van TUS datos reales. Mientras esté
 * vacía, la página de cobro no enseña cuentas (dice "escríbenos por
 * WhatsApp") y el sistema sigue funcionando. Ejemplo de cómo llenarla:
 *
 *   {
 *     banco: "Banreservas",
 *     tipo: "Cuenta de ahorros",
 *     numero: "9600000000",
 *     titular: "Nombre del titular",
 *     documento: "Cédula 000-0000000-0",
 *   },
 */

export interface CuentaCobro {
  banco: string;
  /** "Cuenta de ahorros", "Cuenta corriente"… */
  tipo: string;
  numero: string;
  titular: string;
  /** Cédula o RNC del titular, como lo piden los bancos al transferir. */
  documento?: string;
}

export const CUENTAS_COBRO: CuentaCobro[] = [
  // ⬅️ Agrega aquí tus cuentas reales.
];
