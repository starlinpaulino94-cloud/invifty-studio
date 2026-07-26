import type { EstadoPedido } from "./tipos";

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
