import type { Pago } from "./tipos";

/**
 * EL DINERO DE UN PEDIDO
 * =======================
 * Un solo sitio para las cuentas que antes se hacían a mano donde
 * tocara: cuánto se ha abonado, cuánto se ha devuelto y en qué situación
 * está el cobro. Importa centralizarlo porque la suma ingenua MIENTE dos
 * veces: un pago anulado sigue en la tabla (tachado, con motivo y firma)
 * y no debe contar, y un reembolso es una fila más que RESTA — sumarlo
 * como ingreso infla el mes exactamente cuando peor vino (hubo que
 * devolver dinero).
 *
 * UNA SOLA MONEDA, A PROPÓSITO. Todo se registra en DOP. Un pago que
 * llegó por Zelle o PayPal en USD se anota convertido, y la nota guarda
 * el monto original ("USD 100 a 59.5"). Así "monedas mezcladas sin
 * conversión explícita" es imposible por diseño, sin construir un
 * sistema multi-moneda que nadie pidió.
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

/* ============================================================
   EL ESTADO COMPLETO DEL COBRO (con reembolsos)
   ============================================================ */

export interface DesglosePagos {
  /** Lo que entró: pagos + ajustes activos. */
  abonado: number;
  /** Lo que se devolvió: reembolsos activos. */
  reembolsado: number;
  /** Lo que de verdad queda en caja: abonado − reembolsado. */
  neto: number;
}

/** Las tres cifras del dinero de un pedido, ignorando lo anulado. */
export function desglosePagos(
  pagos: Pick<Pago, "monto" | "tipo" | "anulado_en">[]
): DesglosePagos {
  let abonado = 0;
  let reembolsado = 0;
  for (const p of pagos.filter(pagoActivo)) {
    const monto = Number(p.monto) || 0;
    if (p.tipo === "reembolso") reembolsado += monto;
    else abonado += monto;
  }
  return { abonado, reembolsado, neto: abonado - reembolsado };
}

export type EstadoPago =
  | "pendiente"
  | "parcial"
  | "pagado"
  | "reembolsado_parcial"
  | "reembolsado";

/**
 * La situación del cobro DERIVADA de las transacciones, nunca una columna
 * que alguien actualiza a mano. Con reembolsos de por medio, los estados
 * de reembolso mandan: "pagado pero le devolvimos la mitad" no es
 * "pagado", es una historia distinta que el equipo tiene que ver.
 */
export function estadoPago(
  precio: number,
  pagos: Pick<Pago, "monto" | "tipo" | "anulado_en">[]
): EstadoPago {
  const { reembolsado, neto } = desglosePagos(pagos);
  if (reembolsado > 0) {
    return neto <= 0.01 ? "reembolsado" : "reembolsado_parcial";
  }
  return estadoCobro(precio, neto);
}

export const NOMBRE_ESTADO_PAGO: Record<EstadoPago, string> = {
  pendiente: "Sin abonos",
  parcial: "Abono parcial",
  pagado: "Pagado",
  reembolsado_parcial: "Reembolso parcial",
  reembolsado: "Reembolsado",
};

/* ============================================================
   VALIDACIONES DE UNA TRANSACCIÓN NUEVA
   ============================================================ */

export const TIPOS_TRANSACCION = ["pago", "reembolso", "ajuste"] as const;

/**
 * ¿Se puede registrar esta transacción? Devuelve el motivo del no, o null
 * si pasa. Las reglas que protegen la caja:
 *  - el monto siempre entra positivo (el TIPO dice si suma o resta);
 *  - un reembolso jamás supera lo que hay neto en caja — devolver dinero
 *    que nunca entró es un agujero contable, no una transacción.
 */
export function motivoRechazoTransaccion(
  tipo: string,
  monto: number,
  pagosPrevios: Pick<Pago, "monto" | "tipo" | "anulado_en">[]
): string | null {
  if (!(TIPOS_TRANSACCION as readonly string[]).includes(tipo)) {
    return "Tipo de transacción desconocido.";
  }
  if (!montoValido(monto)) {
    return "El monto debe ser un número mayor que cero.";
  }
  if (tipo === "reembolso") {
    const { neto } = desglosePagos(pagosPrevios);
    if (monto > neto + 0.01) {
      return `No se puede reembolsar ${monto.toFixed(2)}: en caja hay ${neto.toFixed(2)}.`;
    }
  }
  return null;
}

/**
 * La fecha EFECTIVA (cuándo entró el dinero, no cuándo se anotó): ni en
 * el futuro ni antes de que existiera el negocio. Vacía vale — significa
 * "hoy" y la pone la base.
 */
export function fechaEfectivaValida(fecha: string, hoy: Date): boolean {
  if (!fecha) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
  const limite = hoy.toISOString().slice(0, 10);
  return fecha >= "2020-01-01" && fecha <= limite;
}

/* ============================================================
   MÉTRICAS FINANCIERAS
   ============================================================ */

/**
 * Lo cobrado NETO en un período: pagos y ajustes menos reembolsos, solo
 * activos. Es la cifra de "cobrado este mes" — la suma ingenua que
 * ignoraba el tipo contaba una devolución como ingreso.
 */
export function cobradoNeto(
  pagos: Pick<Pago, "monto" | "tipo" | "anulado_en" | "fecha">[],
  desde?: Date
): { cobrado: number; reembolsado: number } {
  let cobrado = 0;
  let reembolsado = 0;
  for (const p of pagos.filter(pagoActivo)) {
    if (desde && new Date(p.fecha) < desde) continue;
    const monto = Number(p.monto) || 0;
    if (p.tipo === "reembolso") {
      reembolsado += monto;
      cobrado -= monto;
    } else {
      cobrado += monto;
    }
  }
  return { cobrado, reembolsado };
}

export interface TramoAntiguedad {
  etiqueta: string;
  /** Suma de saldos pendientes cuyos pedidos tienen esta edad. */
  monto: number;
  pedidos: number;
}

/**
 * ANTIGÜEDAD DE SALDOS: cuánto dinero pendiente hay y desde hace cuánto.
 * Un saldo de esta semana es normal; uno de hace 90 días es un cobro que
 * nadie está persiguiendo. Se cuenta desde la creación del pedido, y los
 * cancelados no deben dinero (su saldo no es cobrable).
 */
export function antiguedadSaldos(
  pedidos: { id: string; precio: number; creado_en: string; estado: string }[],
  pagosPorPedido: Map<string, Pick<Pago, "monto" | "tipo" | "anulado_en">[]>,
  hoy: Date
): TramoAntiguedad[] {
  const tramos: TramoAntiguedad[] = [
    { etiqueta: "0–30 días", monto: 0, pedidos: 0 },
    { etiqueta: "31–60 días", monto: 0, pedidos: 0 },
    { etiqueta: "61–90 días", monto: 0, pedidos: 0 },
    { etiqueta: "Más de 90 días", monto: 0, pedidos: 0 },
  ];

  for (const pedido of pedidos) {
    if (pedido.estado === "cancelado") continue;
    const { neto } = desglosePagos(pagosPorPedido.get(pedido.id) ?? []);
    const saldo = Number(pedido.precio) - neto;
    if (saldo <= 0.01) continue;

    const dias = Math.floor(
      (hoy.getTime() - new Date(pedido.creado_en).getTime()) / (24 * 60 * 60 * 1000)
    );
    const tramo = dias <= 30 ? 0 : dias <= 60 ? 1 : dias <= 90 ? 2 : 3;
    tramos[tramo].monto += saldo;
    tramos[tramo].pedidos += 1;
  }

  return tramos;
}
