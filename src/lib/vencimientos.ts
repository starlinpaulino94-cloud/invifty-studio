import type { EstadoPedido, Plan } from "./tipos";
import { VIGENCIA_MESES } from "./planes";

/**
 * VIGENCIA DE LAS INVITACIONES
 * =============================
 * Cada plan incluye la invitación publicada durante unos meses. Hasta ahora
 * la fecha de vencimiento solo se veía en una lista: nadie avisaba al
 * equipo, y ningún pedido pasaba nunca al estado "vencida" por sí solo.
 *
 * Aquí vive el cálculo, separado de la base de datos para poder probarlo.
 */

/** Con cuántos días de antelación se avisa. Dos semanas da margen a renovar. */
export const DIAS_DE_AVISO = 15;

/**
 * Suma meses de calendario a una fecha "YYYY-MM-DD", cuidando los meses
 * cortos: el 31 de agosto más 6 meses es el 28 de febrero, no el 3 de marzo.
 *
 * El cálculo anterior usaba `setMonth`, que desborda al mes siguiente y le
 * regalaba días sueltos a unos clientes sí y a otros no.
 */
export function sumarMeses(fecha: string, meses: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(fecha ?? "");
  if (!m) return "";

  const anio = Number(m[1]);
  const mesDestino = Number(m[2]) - 1 + meses;
  const dia = Number(m[3]);

  // Día 0 del mes siguiente = último día del mes destino.
  const ultimoDiaDelMes = new Date(Date.UTC(anio, mesDestino + 1, 0)).getUTCDate();

  return new Date(Date.UTC(anio, mesDestino, Math.min(dia, ultimoDiaDelMes)))
    .toISOString()
    .slice(0, 10);
}

/**
 * Fecha en que vence una invitación entregada en la fecha dada, según los
 * meses que incluye su plan (ver VIGENCIA_MESES en planes.ts).
 */
export function calcularVencimiento(fechaEntrega: string, plan: Plan): string {
  return sumarMeses(fechaEntrega, VIGENCIA_MESES[plan] ?? 0);
}

export type EstadoVigencia = "vencida" | "por_vencer" | "vigente";

/** Fecha "YYYY-MM-DD" a medianoche UTC, para restar días sin líos de zona. */
function aMedianoche(fecha: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(fecha ?? "");
  return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : NaN;
}

/**
 * Días que faltan para el vencimiento. Negativo si ya pasó, 0 si vence hoy.
 * Se trabaja en UTC a propósito; el aviso diario corre a media mañana en
 * República Dominicana, así que el día natural coincide.
 */
export function diasHasta(vencimiento: string, hoy = new Date()): number {
  const fin = aMedianoche(vencimiento);
  if (Number.isNaN(fin)) return NaN;
  const inicio = Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate());
  return Math.round((fin - inicio) / 86_400_000);
}

export function estadoVigencia(
  vencimiento: string,
  hoy = new Date(),
  diasAviso = DIAS_DE_AVISO
): EstadoVigencia {
  const dias = diasHasta(vencimiento, hoy);
  if (Number.isNaN(dias)) return "vigente";
  if (dias < 0) return "vencida";
  if (dias <= diasAviso) return "por_vencer";
  return "vigente";
}

/** "vence en 12 días" / "vence hoy" / "venció hace 3 días" */
export function textoVigencia(vencimiento: string, hoy = new Date()): string {
  const dias = diasHasta(vencimiento, hoy);
  if (Number.isNaN(dias)) return "";
  if (dias === 0) return "vence hoy";
  if (dias === 1) return "vence mañana";
  if (dias > 1) return `vence en ${dias} días`;
  if (dias === -1) return "venció ayer";
  return `venció hace ${Math.abs(dias)} días`;
}

export interface PedidoVigencia {
  id: string;
  estado: EstadoPedido;
  fecha_vencimiento: string | null;
  aviso_vencimiento_en: string | null;
}

export interface RepasoVencimientos<T extends PedidoVigencia> {
  /** Ya pasaron de fecha y siguen marcadas como entregadas o activas. */
  aMarcarVencidas: T[];
  /** Están por vencer y todavía no se ha avisado de ellas. */
  aAvisar: T[];
}

/** Estados en los que la invitación sigue publicada y su vigencia corre. */
const ESTADOS_VIVOS: EstadoPedido[] = ["entregada", "activa"];

/* ============================================================
   RECÁLCULO AL CAMBIAR LA POLÍTICA
   ============================================================ */

export interface PedidoRecalculo {
  id: string;
  plan: Plan;
  estado: EstadoPedido;
  fecha_entrega: string | null;
  fecha_vencimiento: string | null;
}

export interface CambioVencimiento<T extends PedidoRecalculo> {
  pedido: T;
  antes: string | null;
  despues: string;
  /** Estaba vencido y la fecha nueva lo devuelve a la vida. */
  revive: boolean;
}

export interface PlanRecalculo<T extends PedidoRecalculo> {
  /** Se les alarga la vigencia. */
  aAlargar: CambioVencimiento<T>[];
  /** La política nueva los acortaría: se dejan intactos. */
  seRespetan: CambioVencimiento<T>[];
}

/**
 * Decide qué pedidos ya entregados hay que tocar cuando cambia la política.
 *
 * REGLA DE ORO: solo alarga, nunca acorta. Si el recálculo diera una fecha
 * anterior a la que el pedido ya tiene, se deja como está — a un cliente no
 * se le quita algo que ya se le prometió, aunque la política nueva sea más
 * corta. No toca la base de datos: devuelve el plan y quien llama decide.
 */
export function planificarRecalculo<T extends PedidoRecalculo>(
  pedidos: T[],
  hoy = new Date()
): PlanRecalculo<T> {
  const aAlargar: CambioVencimiento<T>[] = [];
  const seRespetan: CambioVencimiento<T>[] = [];
  const hoyISO = hoy.toISOString().slice(0, 10);

  for (const pedido of pedidos) {
    if (!pedido.fecha_entrega) continue;

    const despues = calcularVencimiento(pedido.fecha_entrega, pedido.plan);
    if (!despues) continue;

    const antes = pedido.fecha_vencimiento;
    const cambio: CambioVencimiento<T> = {
      pedido,
      antes,
      despues,
      // Ya había pasado de fecha y la nueva lo devuelve al futuro.
      revive: !!antes && antes < hoyISO && despues >= hoyISO,
    };

    if (!antes || despues > antes) aAlargar.push(cambio);
    else if (despues < antes) seRespetan.push(cambio);
    // Si coinciden, no hay nada que hacer.
  }

  return { aAlargar, seRespetan };
}

/**
 * Decide qué hacer con cada pedido en el repaso diario. No toca la base de
 * datos: devuelve las dos listas y quien llama se encarga.
 */
export function repasarVencimientos<T extends PedidoVigencia>(
  pedidos: T[],
  hoy = new Date(),
  diasAviso = DIAS_DE_AVISO
): RepasoVencimientos<T> {
  const aMarcarVencidas: T[] = [];
  const aAvisar: T[] = [];

  for (const pedido of pedidos) {
    if (!pedido.fecha_vencimiento) continue;
    if (!ESTADOS_VIVOS.includes(pedido.estado)) continue;

    const estado = estadoVigencia(pedido.fecha_vencimiento, hoy, diasAviso);

    if (estado === "vencida") {
      aMarcarVencidas.push(pedido);
    } else if (estado === "por_vencer" && !pedido.aviso_vencimiento_en) {
      // Solo se avisa una vez por pedido: nadie quiere el mismo correo cada día.
      aAvisar.push(pedido);
    }
  }

  return { aMarcarVencidas, aAvisar };
}
