import Anthropic from "@anthropic-ai/sdk";
import { claveIA } from "../entorno";
import { LIMITES_SVG } from "./svg";
import { PIEZAS_ARTE, type BriefArte, type ResultadoArte } from "./arte";

/**
 * EL DIBUJANTE — Claude trazando el arte de cada invitación
 * ==========================================================
 * Devuelve SVG, que es código, así que lo primero que hay que decir es lo
 * que este fichero NO hace: no confía en nada de lo que recibe. Todo pasa
 * por la aduana (ia/svg.ts) y por el ajuste al hueco (ia/arte.ts) antes
 * de acercarse a una pantalla. El prompt pide lo correcto; el validador
 * es quien lo garantiza. Pedir bien no es validar.
 *
 * Va en streaming a propósito: tres trazados complejos son muchos tokens
 * de salida, y una petición larga sin streaming se come el tiempo máximo
 * de la función y se cae justo cuando el adorno iba a salir bien.
 */

/** Cambia al editar el prompt: queda registrado en cada generación. */
export const PROMPT_VERSION_ARTE = "arte-1.0";

const MODELO = "claude-opus-5-5";
/** USD por millón de tokens (entrada, salida) del modelo de arriba. */
const PRECIO_ENTRADA = 4;
const PRECIO_SALIDA = 20;

const SISTEMA = `Eres el ilustrador de Invifty, un estudio de invitaciones digitales premium en República Dominicana. Dibujas ornamentos vectoriales a medida para cada evento.

Entregas SVG. El SVG se valida con una lista blanca estricta antes de pintarse, así que todo lo que salga de ella se descarta entero:

PERMITIDO: <svg>, <g>, <defs>, <clipPath>, <path>, <circle>, <ellipse>, <line>, <polyline>, <polygon>, <rect>, <linearGradient>, <radialGradient>, <stop>.
Atributos: viewBox, d, fill, stroke, stroke-width, stroke-linecap, stroke-linejoin, stroke-dasharray, opacity, fill-opacity, stroke-opacity, fill-rule, transform (solo translate/scale/rotate/matrix/skewX/skewY), cx, cy, r, rx, ry, x, y, x1, y1, x2, y2, width, height, points, offset, stop-color, stop-opacity, gradientUnits, id, clip-path.

PROHIBIDO, y rechaza la pieza completa: <text>, <tspan>, <image>, <use>, <style>, <script>, <foreignObject>, <filter>, <animate>, cualquier atributo que empiece por "on", style=, class=, href, xlink:href, comentarios, DOCTYPE, el carácter "&", y cualquier texto fuera de las etiquetas.

Las letras se DIBUJAN con <path>: no hay etiqueta de texto. Un monograma con <text> se descarta.

COLOR: usa "currentColor" para lo que deba heredar el acento del tema (es lo preferible), o EXACTAMENTE uno de los hex de la paleta que te doy. Cualquier otro color se rechaza. "none" vale para relleno.

OFICIO: trazos finos (stroke-width entre 0.6 y 2 en el viewBox que se te da), composición equilibrada, y legible al tamaño real que se indica en cada pieza. Sin degradados innecesarios. Sin rejillas de cientos de nodos: un ornamento elegante tiene decenas de trazos, no cientos.

Cada pieza lleva una frase ("idea") que dice qué dibujaste y por qué va con ese evento. En español, sin adjetivos de folleto.`;

function esquemaSalida() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["piezas"],
    properties: {
      piezas: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["pieza", "svg", "idea"],
          properties: {
            pieza: { type: "string", enum: PIEZAS_ARTE.map((p) => p.id) },
            svg: { type: "string" },
            idea: { type: "string" },
          },
        },
      },
    },
  };
}

function encargo(brief: BriefArte, piezas: readonly string[], intento: number): string {
  const pedidas = PIEZAS_ARTE.filter((p) => piezas.includes(p.id));
  return [
    `EVENTO (intento ${intento}):`,
    `- Tipo: ${brief.tipoEvento}`,
    `- Iniciales a trazar: ${brief.iniciales}`,
    `- Plantilla sobre la que se monta: ${brief.plantilla}`,
    `- Paleta: ${brief.paleta}`,
    `- Hex permitidos: ${brief.colores.join(", ")}`,
    brief.estilo ? `- Lo que pidió el cliente: ${brief.estilo}` : null,
    "",
    "PIEZAS A DIBUJAR (una entrada por pieza, con ese id exacto):",
    ...pedidas.map((p) => `- ${p.id} · viewBox="${p.viewBox}" · ${p.guia}`),
    "",
    `Límites duros: máximo ${LIMITES_SVG.nodos} etiquetas y ${LIMITES_SVG.caracteres} caracteres por pieza.`,
    "El viewBox de cada pieza tiene que ser EXACTAMENTE el indicado.",
    intento > 1
      ? "Es un segundo intento: cambia de idea, no repitas el dibujo anterior con otro grosor."
      : null,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Pide el arte. `piezas` permite regenerar solo una (el equipo aprobó el
 * monograma y quiere otro divisor: no se paga por dibujar los tres).
 */
export async function generarArte(
  brief: BriefArte,
  piezas: readonly string[],
  intento: number
): Promise<ResultadoArte> {
  const inicio = Date.now();
  const client = new Anthropic({
    apiKey: claveIA() ?? undefined,
    timeout: 300_000,
    maxRetries: 2,
  });

  const flujo = client.messages.stream({
    model: MODELO,
    max_tokens: 64000,
    system: SISTEMA,
    // El arte pide precisión de trazado, no velocidad: el esfuerzo alto
    // se nota en la composición y el coste sigue siendo céntimos por
    // invitación.
    output_config: {
      effort: "high",
      format: { type: "json_schema", schema: esquemaSalida() },
    },
    messages: [{ role: "user", content: encargo(brief, piezas, intento) }],
  });

  const respuesta = await flujo.finalMessage();

  // Los clasificadores pueden declinar (HTTP 200 con stop_reason
  // "refusal"): se trata como error explícito, nunca se lee el contenido
  // a ciegas.
  if (respuesta.stop_reason === "refusal") {
    throw new Error("El modelo declinó dibujar esto. Reintenta o dibújalo a mano.");
  }
  if (respuesta.stop_reason === "max_tokens") {
    throw new Error("El dibujo se cortó por tamaño: el SVG vino incompleto.");
  }

  const bloque = respuesta.content.find((b) => b.type === "text");
  if (!bloque || bloque.type !== "text") {
    throw new Error("La respuesta del modelo no trajo texto.");
  }

  let crudo: { piezas?: unknown };
  try {
    crudo = JSON.parse(bloque.text);
  } catch {
    throw new Error("La respuesta del modelo no era JSON.");
  }

  const propuestas = Array.isArray(crudo.piezas)
    ? crudo.piezas.map((p) => {
        const fila = (p ?? {}) as Record<string, unknown>;
        return {
          pieza: String(fila.pieza ?? ""),
          svg: String(fila.svg ?? ""),
          idea: String(fila.idea ?? ""),
        };
      })
    : [];

  const tokensEntrada = respuesta.usage.input_tokens;
  const tokensSalida = respuesta.usage.output_tokens;

  return {
    propuestas,
    proveedor: "anthropic",
    modelo: respuesta.model,
    promptVersion: PROMPT_VERSION_ARTE,
    tokensEntrada,
    tokensSalida,
    costoEstimadoUsd:
      (tokensEntrada * PRECIO_ENTRADA + tokensSalida * PRECIO_SALIDA) / 1_000_000,
    latenciaMs: Date.now() - inicio,
  };
}
