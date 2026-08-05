import type { Pago } from "./tipos";

/**
 * EL DINERO DE UN PEDIDO
 * =======================
 * Un solo sitio para las dos cuentas que antes se hacían a mano donde
 * tocara: cuánto se ha abonado y en qué situación está el cobro. Importa
 * centralizarlo porque desde la anulación de pagos la suma ingenua MIENTE:
 * un pago anulado sigue en la tabla (tachado, con motivo y firma) y no
 * debe contar ni en el balance del pedido ni en las métricas del mes.
 */

/** ¿Cuenta este pago para el balance? Anulado = tachado = no cuenta. */
export function pagoActivo(pago: Pick<Pago, "anulado_en">): boolean {
  return !pago.anulado_en;
}

/**
 * Lo abonado de verdad: pagos y ajustes suman, reembolsos restan, y los
 * anulados no existen para la cuenta.
 */
export function balancePagos(pagos: Pick<Pago, "monto" | "tipo" | "anulado_en">[]): number {
  return pagos.filter(pagoActivo).reduce((suma, p) => {
    const monto = Number(p.monto) || 0;
    return p.tipo === "reembolso" ? suma - monto : suma + monto;
  }, 0);
}

export type EstadoCobro = "pendiente" | "parcial" | "pagado";

/**
 * La situación del cobro, DERIVADA de las transacciones — nunca una
 * columna que alguien actualiza a mano y se desincroniza.
 */
export function estadoCobro(precio: number, abonado: number): EstadoCobro {
  if (abonado <= 0) return "pendiente";
  // Con centavos de por medio, "me faltan 20 centavos" no es deuda real.
  if (abonado >= Number(precio) - 0.01) return "pagado";
  return "parcial";
}

/** Valida un monto que entra del formulario: número real, positivo y con techo. */
export function montoValido(monto: number): boolean {
  return Number.isFinite(monto) && monto > 0 && monto <= 10_000_000;
}
