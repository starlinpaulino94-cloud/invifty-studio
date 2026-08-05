import type { DensidadOrnamental, Plan, TipoEvento } from "../tipos";

/**
 * EL PIPELINE CREATIVO — los contratos
 * =====================================
 * La regla de oro de todo el pipeline: la IA NO genera HTML libre. Genera
 * un BRIEF (lo que sabemos del evento) y CONCEPTOS (elecciones dentro del
 * sistema de diseño que ya existe: plantilla, paleta, tipografía, densidad
 * y textos cortos). El renderizador determinista de siempre es quien
 * dibuja. Así un concepto malo es feo, nunca roto ni inseguro.
 *
 * Y la segunda regla: los DATOS FACTUALES (fecha, hora, lugares, teléfono,
 * fecha límite) no pasan por la IA jamás. Un concepto no puede ni
 * mencionarlos: el validador (esquema.ts) lo rechaza si lo intenta.
 */

/** Versión del esquema del brief. Cambia si cambia la forma. */
export const BRIEF_VERSION = "1.0";

/**
 * Lo que sabemos del evento, normalizado para pedirle conceptos a un
 * proveedor. Se deriva SOLO de datos que ya existen (pedido + invitación):
 * no se inventa nada y no incluye datos de contacto.
 */
export interface BriefCreativo {
  version: typeof BRIEF_VERSION;
  tipoEvento: TipoEvento;
  plan: Plan;
  /** "Camila & Lucas" — se usa para el tono, no se modifica. */
  titulo: string;
  /** Qué secciones tiene activas la invitación actual. */
  secciones: string[];
  /** Elecciones visuales actuales, para proponer distinto, no más de lo mismo. */
  estiloActual: {
    plantilla: string;
    paleta: string;
    tipografia: string;
    densidad: DensidadOrnamental;
  };
  /** true si el cliente escribió su historia (los conceptos no la tocan). */
  tieneHistoria: boolean;
  /** true si hay fotos para lucir en la portada y la galería. */
  tieneFotos: boolean;
}

/**
 * Una propuesta de la IA: elecciones del catálogo + copy corto. Nada más.
 * Si el proveedor devolviera campos de sobra, el validador los rechaza.
 */
export interface ConceptoCreativo {
  /** "Jardín nocturno", "Gala clásica"… */
  nombre: string;
  /** La idea en una o dos frases, para que el equipo elija con criterio. */
  idea: string;
  plantilla: string;
  paleta: string;
  tipografia: string;
  densidad: DensidadOrnamental;
  copy: {
    subtitulo?: string;
    frase?: string;
    mensajeFinal?: string;
  };
  /** Riesgo honesto del concepto ("puede ser mucho para un bautizo"). */
  riesgo?: string;
}

/** Lo que un proveedor devuelve, con su contabilidad. */
export interface ResultadoGeneracion {
  conceptos: ConceptoCreativo[];
  proveedor: "mock" | "anthropic";
  modelo: string;
  promptVersion: string;
  tokensEntrada: number;
  tokensSalida: number;
  /** USD estimado; 0 en mock. */
  costoEstimadoUsd: number;
  latenciaMs: number;
}

/** El contrato de todo proveedor. `intento` varía la propuesta al repetir. */
export interface ProveedorCreativo {
  generarConceptos(brief: BriefCreativo, intento: number): Promise<ResultadoGeneracion>;
}
