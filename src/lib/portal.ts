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

/* =====================================================================
 * LA ACTIVIDAD DEL PORTAL, contada al equipo
 * =====================================================================
 * Todo lo que un cliente hace en su portal ya queda en `auditoria`;
 * esto lo traduce a frases que el tablero puede enseñar. Si una acción
 * del portal no está aquí, el tablero no la cuenta — así que cada
 * acción nueva del portal AGREGA su frase (hay una prueba que compara
 * esta lista con las acciones que las acciones de servidor registran).
 */

export const ACCIONES_PORTAL: Record<string, string> = {
  "cuenta:activar": "activó su portal",
  "cuenta:activar_colaborador": "activó su acceso como colaborador",
  "cuenta:invitar_colaborador": "invitó a un colaborador",
  "cuenta:revocar_invitacion": "revocó una invitación",
  "cuenta:quitar_colaborador": "quitó a un colaborador",
  "cuenta:recuperar_password": "eligió una contraseña nueva",
  "invitacion:contenido_cliente": "editó los textos de su invitación",
};

export interface FilaActividad {
  accion: string;
  usuario_email: string | null;
  creado_en: string;
}

/** La frase del tablero, o null si la acción no es del portal. */
export function describirActividad(fila: FilaActividad): string | null {
  const frase = ACCIONES_PORTAL[fila.accion];
  if (!frase) return null;
  return `${fila.usuario_email ?? "Alguien"} ${frase}`;
}

/** "hace 5 min", "hace 3 h", "hace 2 días" — para la lista de actividad. */
export function haceCuanto(fecha: string, ahora: Date): string {
  const ms = ahora.getTime() - new Date(fecha).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "ahora mismo";
  if (min < 60) return `hace ${min} min`;
  const horas = Math.floor(min / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  return `hace ${dias} día${dias === 1 ? "" : "s"}`;
}
