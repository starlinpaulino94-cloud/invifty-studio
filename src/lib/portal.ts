import type { ContratoCapacidades } from "./capacidades";
import type { Capacidad, EstadoCapacidad } from "./planes";

/**
 * LO QUE EL PORTAL LE ENSEÑA AL CLIENTE — la lógica pura
 * =======================================================
 * Dos cosas que tienen que decir la verdad:
 *
 *  - El resumen del RSVP: números que el anfitrión usa para pagar el
 *    catering. Contarlos mal cuesta dinero de verdad.
 *  - Las capacidades del contrato: lo que compró, con su estado honesto.
 *    Una capacidad "manual" o "pendiente" NO se esconde (la pagó), pero
 *    tampoco se pinta como un botón que funciona.
 */

export interface ResumenRsvp {
  /** Grupos que dijeron que sí. */
  confirmaciones: number;
  /** Personas en total (cada confirmación trae su cantidad). */
  personas: number;
  /** Grupos que avisaron que no vienen. */
  noVienen: number;
}

export function resumenRsvp(
  confirmaciones: { asiste: boolean; cantidad: number }[]
): ResumenRsvp {
  let si = 0;
  let personas = 0;
  let no = 0;
  for (const c of confirmaciones) {
    if (c.asiste) {
      si += 1;
      // Al menos el que confirma, aunque la cantidad venga rara.
      personas += Math.max(1, Number(c.cantidad) || 0);
    } else {
      no += 1;
    }
  }
  return { confirmaciones: si, personas, noVienen: no };
}

/**
 * Las capacidades que el cliente VE en su contrato: todas menos las
 * apagadas ("no_disponible" no se vendió, no existe para él). Las demás
 * salen con su estado, porque esconder una capacidad pagada sería mentir
 * y pintarla como activa también.
 */
export function capacidadesDelCliente(contrato: ContratoCapacidades): Capacidad[] {
  return contrato.capacidades.filter((c) => c.estado !== "no_disponible");
}

/** Cómo se le explica cada estado al cliente, sin jerga interna. */
export const NOTA_ESTADO_CAPACIDAD: Record<Exclude<EstadoCapacidad, "no_disponible">, string | null> = {
  activa: null, // funciona y no hay nada que aclarar
  manual: "La gestiona el equipo de Invifty por ti",
  vendida_sin_implementar: "Incluida en tu plan — disponible pronto",
};
