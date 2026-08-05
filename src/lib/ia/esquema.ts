import { PLANTILLAS } from "@/config/plantillas";
import { PALETAS, TIPOGRAFIAS, DENSIDADES } from "@/config/diseno";
import { PLANTILLA_CODIGO } from "../codigo";
import type { ConceptoCreativo } from "./tipos";
import type { DensidadOrnamental } from "../tipos";

/**
 * LA ADUANA DE LOS CONCEPTOS
 * ===========================
 * Todo lo que devuelve un proveedor de IA pasa por aquí antes de tocar
 * nada. La validación es estricta a propósito:
 *
 *  - Las elecciones tienen que EXISTIR en el catálogo real (plantillas,
 *    paletas, tipografías, densidades). Un id inventado no se corrige en
 *    silencio: se rechaza y queda registrado — corregir a escondidas
 *    disfrazaría a un proveedor que alucina.
 *  - Los DATOS FACTUALES están vetados: un concepto que traiga fecha,
 *    hora, lugares, teléfono o similares se rechaza entero. La IA no
 *    tiene voz sobre esos campos, ni siquiera para repetirlos bien.
 *  - Los textos van acotados: son frases de invitación, no ensayos.
 */

const MAX_NOMBRE = 60;
const MAX_IDEA = 300;
const MAX_COPY = 220;
const MAX_RIESGO = 200;

/**
 * Campos que un concepto JAMÁS puede traer, ni arriba ni dentro de copy.
 * Son los datos que costarían un evento si la IA los "mejorara".
 */
export const CAMPOS_VETADOS = [
  "fechaEvento", "horaEvento", "fecha", "hora", "lugares", "lugar",
  "rsvp", "whatsapp", "telefono", "fechaLimite", "dominio", "slug",
  "regalos", "cuenta", "notasEquipo",
] as const;

export type ResultadoValidacion =
  | { ok: true; concepto: ConceptoCreativo }
  | { ok: false; error: string };

const texto = (v: unknown, max: number): string | null =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;

function contieneVetados(objeto: Record<string, unknown>): string | null {
  for (const campo of CAMPOS_VETADOS) {
    if (campo in objeto) return campo;
  }
  return null;
}

export function validarConcepto(bruto: unknown): ResultadoValidacion {
  if (!bruto || typeof bruto !== "object" || Array.isArray(bruto)) {
    return { ok: false, error: "El concepto no es un objeto" };
  }
  const c = bruto as Record<string, unknown>;

  const vetado = contieneVetados(c);
  if (vetado) {
    return { ok: false, error: `El concepto intenta tocar un dato factual: "${vetado}"` };
  }

  const nombre = texto(c.nombre, MAX_NOMBRE);
  if (!nombre) return { ok: false, error: "Falta el nombre del concepto" };

  const idea = texto(c.idea, MAX_IDEA);
  if (!idea) return { ok: false, error: "Falta la idea del concepto" };

  const plantilla = texto(c.plantilla, 40);
  if (
    !plantilla ||
    plantilla === PLANTILLA_CODIGO ||
    !PLANTILLAS.some((p) => p.id === plantilla)
  ) {
    return { ok: false, error: `Plantilla desconocida: "${c.plantilla}"` };
  }

  const paleta = texto(c.paleta, 40);
  if (!paleta || !(paleta in PALETAS)) {
    return { ok: false, error: `Paleta desconocida: "${c.paleta}"` };
  }

  const tipografia = texto(c.tipografia, 40);
  if (!tipografia || !(tipografia in TIPOGRAFIAS)) {
    return { ok: false, error: `Tipografía desconocida: "${c.tipografia}"` };
  }

  const densidad = texto(c.densidad, 20);
  if (!densidad || !DENSIDADES.some((d) => d.id === densidad)) {
    return { ok: false, error: `Densidad desconocida: "${c.densidad}"` };
  }

  const copyBruto =
    c.copy && typeof c.copy === "object" && !Array.isArray(c.copy)
      ? (c.copy as Record<string, unknown>)
      : {};

  const vetadoEnCopy = contieneVetados(copyBruto);
  if (vetadoEnCopy) {
    return { ok: false, error: `El copy intenta tocar un dato factual: "${vetadoEnCopy}"` };
  }

  const copy: ConceptoCreativo["copy"] = {};
  const subtitulo = texto(copyBruto.subtitulo, MAX_COPY);
  const frase = texto(copyBruto.frase, MAX_COPY);
  const mensajeFinal = texto(copyBruto.mensajeFinal, MAX_COPY);
  if (subtitulo) copy.subtitulo = subtitulo;
  if (frase) copy.frase = frase;
  if (mensajeFinal) copy.mensajeFinal = mensajeFinal;

  const concepto: ConceptoCreativo = {
    nombre,
    idea,
    plantilla,
    paleta,
    tipografia,
    densidad: densidad as DensidadOrnamental,
    copy,
  };
  const riesgo = texto(c.riesgo, MAX_RIESGO);
  if (riesgo) concepto.riesgo = riesgo;

  return { ok: true, concepto };
}

/**
 * Valida la tanda completa. Se exigen EXACTAMENTE tres conceptos válidos:
 * menos es un proveedor a medias, y "el que sí salió" no se publica en
 * silencio — el error dice qué falló para poder reintentar con criterio.
 */
export function validarConceptos(
  brutos: unknown
): { ok: true; conceptos: ConceptoCreativo[] } | { ok: false; error: string } {
  if (!Array.isArray(brutos)) return { ok: false, error: "La respuesta no es una lista" };
  if (brutos.length !== 3) {
    return { ok: false, error: `Se esperaban 3 conceptos y llegaron ${brutos.length}` };
  }

  const conceptos: ConceptoCreativo[] = [];
  for (const [i, bruto] of brutos.entries()) {
    const r = validarConcepto(bruto);
    if (!r.ok) return { ok: false, error: `Concepto ${i + 1}: ${r.error}` };
    conceptos.push(r.concepto);
  }
  return { ok: true, conceptos };
}
