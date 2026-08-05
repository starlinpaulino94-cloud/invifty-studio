import Anthropic from "@anthropic-ai/sdk";
import { PLANTILLAS } from "@/config/plantillas";
import { PALETAS, TIPOGRAFIAS, DENSIDADES } from "@/config/diseno";
import { claveIA } from "../entorno";
import type { BriefCreativo, ProveedorCreativo, ResultadoGeneracion } from "./tipos";

/**
 * EL PROVEEDOR REAL — Claude, con el mismo contrato que el mock
 * ==============================================================
 * Pide los tres conceptos con SALIDA ESTRUCTURADA (output_config.format):
 * la API garantiza JSON conforme al esquema, y aun así todo pasa después
 * por nuestra aduana (esquema.ts) — la doble validación es deliberada,
 * porque el esquema de la API no sabe qué paletas existen HOY en nuestro
 * catálogo... de hecho sí lo sabe: los enums de abajo se construyen del
 * catálogo real en cada llamada, así que una paleta nueva entra sola.
 *
 * Corre SOLO en el servidor (claveIA revienta en el navegador) y solo si
 * IA_PROVEEDOR=anthropic con clave puesta. Sin eso, el sistema usa el
 * mock y nadie gasta un token.
 */

/** Cambia al editar el prompt: queda registrado en cada generación. */
export const PROMPT_VERSION = "anthropic-1.0";

const MODELO = "claude-opus-5";
/** USD por millón de tokens (entrada, salida) del modelo de arriba. */
const PRECIO_ENTRADA = 5;
const PRECIO_SALIDA = 25;

const SISTEMA = `Eres el director creativo de Invifty, un estudio de invitaciones digitales premium en República Dominicana.

Recibirás el BRIEF de un evento y propondrás EXACTAMENTE tres conceptos visuales genuinamente distintos entre sí: uno seguro y fácil de aprobar, uno más arriesgado pero usable, y uno editorial con más narrativa. Cada concepto elige DEL CATÁLOGO que se te da: plantilla, paleta, tipografía y densidad ornamental. No existen otras opciones.

Reglas inquebrantables:
- No menciones ni inventes fechas, horas, direcciones, teléfonos ni datos de regalos. Esos datos no te pertenecen.
- El copy es corto y en español natural dominicano-neutro: subtítulo, frase de portada y despedida. Sin clichés vacíos ni referencias religiosas que el brief no traiga.
- No repitas la combinación actual del brief (estiloActual): el equipo pide alternativas, no un espejo.
- En "riesgo" di la verdad de cada concepto: para quién puede no funcionar.
- Tres conceptos que solo cambian el color no son tres conceptos.`;

function esquemaSalida() {
  const plantillas = PLANTILLAS.map((p) => p.id);
  const paletas = Object.keys(PALETAS);
  const tipografias = Object.keys(TIPOGRAFIAS);
  const densidades = DENSIDADES.map((d) => d.id);

  const concepto = {
    type: "object",
    additionalProperties: false,
    required: ["nombre", "idea", "plantilla", "paleta", "tipografia", "densidad", "copy"],
    properties: {
      nombre: { type: "string" },
      idea: { type: "string" },
      plantilla: { type: "string", enum: plantillas },
      paleta: { type: "string", enum: paletas },
      tipografia: { type: "string", enum: tipografias },
      densidad: { type: "string", enum: densidades },
      copy: {
        type: "object",
        additionalProperties: false,
        properties: {
          subtitulo: { type: "string" },
          frase: { type: "string" },
          mensajeFinal: { type: "string" },
        },
      },
      riesgo: { type: "string" },
    },
  };

  return {
    type: "object",
    additionalProperties: false,
    required: ["conceptos"],
    properties: { conceptos: { type: "array", items: concepto } },
  };
}

/** Qué es cada opción del catálogo, para que el modelo elija con criterio. */
function catalogoParaElModelo(): string {
  const plantillas = PLANTILLAS.map((p) => `- ${p.id}: ${p.nombre}. ${p.descripcion} Ideal: ${p.ideal}`);
  const paletas = Object.entries(PALETAS).map(([id, p]) => `- ${id}: ${p.nombre}`);
  const tipografias = Object.entries(TIPOGRAFIAS).map(([id, t]) => `- ${id}: ${t.nombre}. ${t.descripcion}`);
  const densidades = DENSIDADES.map((d) => `- ${d.id}: ${d.descripcion}`);
  return [
    "PLANTILLAS:", ...plantillas,
    "\nPALETAS:", ...paletas,
    "\nTIPOGRAFÍAS:", ...tipografias,
    "\nDENSIDADES:", ...densidades,
  ].join("\n");
}

export const proveedorAnthropic: ProveedorCreativo = {
  async generarConceptos(brief: BriefCreativo, intento: number): Promise<ResultadoGeneracion> {
    const inicio = Date.now();
    const client = new Anthropic({
      apiKey: claveIA() ?? undefined,
      timeout: 120_000, // milisegundos: los conceptos no justifican esperas eternas
      maxRetries: 2,
    });

    const respuesta = await client.messages.create({
      model: MODELO,
      max_tokens: 16000,
      system: SISTEMA,
      output_config: {
        format: { type: "json_schema", schema: esquemaSalida() },
      },
      messages: [
        {
          role: "user",
          content:
            `BRIEF (intento ${intento}):\n${JSON.stringify(brief, null, 2)}\n\n` +
            `CATÁLOGO DISPONIBLE:\n${catalogoParaElModelo()}\n\n` +
            "Propón los tres conceptos.",
        },
      ],
    });

    // Los clasificadores del modelo pueden declinar (HTTP 200 con
    // stop_reason "refusal"): se trata como error explícito, nunca se lee
    // content a ciegas.
    if (respuesta.stop_reason === "refusal") {
      throw new Error("El modelo declinó la petición (refusal). Reintenta o usa el modo mock.");
    }

    const bloqueTexto = respuesta.content.find((b) => b.type === "text");
    if (!bloqueTexto || bloqueTexto.type !== "text") {
      throw new Error("La respuesta del modelo no trajo texto.");
    }

    const tokensEntrada = respuesta.usage.input_tokens;
    const tokensSalida = respuesta.usage.output_tokens;

    return {
      // Se parsea aquí; la VALIDACIÓN de fondo la hace esquema.ts en quien llama.
      conceptos: JSON.parse(bloqueTexto.text).conceptos,
      proveedor: "anthropic",
      modelo: respuesta.model,
      promptVersion: PROMPT_VERSION,
      tokensEntrada,
      tokensSalida,
      costoEstimadoUsd:
        (tokensEntrada * PRECIO_ENTRADA + tokensSalida * PRECIO_SALIDA) / 1_000_000,
      latenciaMs: Date.now() - inicio,
    };
  },
};
