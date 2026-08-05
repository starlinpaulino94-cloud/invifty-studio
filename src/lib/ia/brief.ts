import { plantillaMeta } from "@/config/plantillas";
import { DENSIDAD_POR_DEFECTO } from "@/config/diseno";
import { BRIEF_VERSION, type BriefCreativo } from "./tipos";
import type { DatosInvitacion, Plan, TipoEvento } from "../tipos";

/**
 * DERIVAR EL BRIEF — de los datos reales, sin inventar
 * =====================================================
 * El brief se construye SOLO con lo que ya existe en el pedido y la
 * invitación. Determinista: el mismo pedido produce el mismo brief, que es
 * lo que hace comparables dos generaciones y auditable el registro.
 *
 * Lo que NO lleva, a propósito: teléfono, fecha, hora, lugares, datos de
 * regalos. La IA no los necesita para proponer estética, y lo que no
 * viaja no se puede filtrar ni "mejorar".
 */
export function derivarBrief(
  tipoEvento: TipoEvento,
  plan: Plan,
  datos: DatosInvitacion,
  plantilla: string | undefined,
  tieneFotos: boolean
): BriefCreativo {
  const secciones = Object.entries(datos.secciones ?? {})
    .filter(([, activa]) => activa)
    .map(([nombre]) => nombre)
    .sort();

  return {
    version: BRIEF_VERSION,
    tipoEvento,
    plan,
    titulo: datos.titulo || "Evento sin título",
    secciones,
    estiloActual: {
      plantilla: plantillaMeta(plantilla).id,
      paleta: datos.paleta || "dorado_negro",
      tipografia: datos.tipografia || "clasica_real",
      densidad: datos.densidad ?? DENSIDAD_POR_DEFECTO,
    },
    tieneHistoria: Boolean(datos.historia?.trim()),
    tieneFotos,
  };
}

/**
 * Semilla determinista de un brief + número de intento (FNV-1a). Sin
 * Math.random: el mismo pedido en el mismo intento propone lo mismo, y
 * "regenerar" (intento+1) propone distinto. Reproducible y testeable.
 */
export function semillaDeBrief(brief: BriefCreativo, intento: number): number {
  const texto = JSON.stringify(brief) + "#" + intento;
  let hash = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    hash ^= texto.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
