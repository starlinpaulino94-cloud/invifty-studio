import type { Paleta } from "@/config/diseno";
import { sanearSvg } from "./svg";

/**
 * ARTE A MEDIDA — las tres piezas que dejan de ser plantilla
 * ===========================================================
 * Hasta ahora la IA ELEGÍA dentro del catálogo: plantilla, paleta,
 * tipografía. Dos bodas con el mismo gusto salían parecidas, y el
 * monograma eran literalmente dos letras de una fuente dentro de un
 * círculo igual para todos.
 *
 * Estas tres piezas se DIBUJAN para cada evento, y son las tres que el
 * ojo registra como "hecho a mano":
 *
 *  - monograma: las iniciales trazadas, no escritas. Es lo primero que se
 *    ve al abrir la invitación.
 *  - divisor:   la filigrana que separa secciones. Hoy hay 13 fijas; esta
 *    es suya.
 *  - esquina:   el adorno de las cuatro esquinas del marco.
 *
 * Lo que NO cambia: la IA no escribe HTML ni CSS, y su SVG no se pinta
 * hasta pasar por la aduana (ia/svg.ts), que lo reconstruye desde una
 * lista blanca. Un adorno malo es feo. Nunca roto, nunca ejecutable.
 */

export const PIEZAS_ARTE = [
  {
    id: "monograma",
    nombre: "Monograma",
    /** El lienzo que tiene que declarar el SVG. */
    viewBox: "0 0 120 120",
    proporcion: 1,
    /** Para el prompt: qué es esta pieza y qué NO puede ser. */
    guia:
      "Las iniciales del evento entrelazadas y TRAZADAS como dibujo (contornos, no texto): " +
      "no existe la etiqueta <text>, así que las letras se construyen con <path>. " +
      "Puede llevar un aro, una corona de hojas o una filigrana alrededor. " +
      "Tiene que leerse a 48 px de ancho en un celular.",
  },
  {
    id: "divisor",
    nombre: "Divisor",
    viewBox: "0 0 240 40",
    proporcion: 6,
    guia:
      "Una filigrana horizontal y SIMÉTRICA que separa dos secciones. " +
      "Pesa en el centro y se adelgaza hacia los extremos. " +
      "Se ve a 200 px de ancho y 34 px de alto: nada de detalle que a ese tamaño sea una mancha.",
  },
  {
    id: "esquina",
    nombre: "Esquina",
    viewBox: "0 0 80 80",
    proporcion: 1,
    guia:
      "Un adorno de ESQUINA SUPERIOR IZQUIERDA: nace en la esquina (0,0) y crece hacia dentro. " +
      "El renderizador lo gira y lo espeja para las otras tres, así que no puede ser simétrico " +
      "ni estar centrado. Se dibuja a 64 px.",
  },
] as const;

export type PiezaArteId = (typeof PIEZAS_ARTE)[number]["id"];

export const IDS_PIEZAS: PiezaArteId[] = PIEZAS_ARTE.map((p) => p.id);

export function piezaMeta(id: string) {
  return PIEZAS_ARTE.find((p) => p.id === id) ?? null;
}

/** Una pieza guardada en `invitaciones.datos.arte`. */
export interface PiezaArte {
  svg: string;
  /** Qué quiso dibujar, en una frase. Para que el equipo decida con criterio. */
  idea: string;
  generadoEn: string;
}

export interface ArteInvitacion {
  version: 1;
  monograma?: PiezaArte;
  divisor?: PiezaArte;
  esquina?: PiezaArte;
}

/** Lo que el proveedor propone, antes de la aduana. */
export interface PropuestaArte {
  pieza: string;
  svg: string;
  idea: string;
}

export interface ResultadoArte {
  propuestas: PropuestaArte[];
  proveedor: "anthropic";
  modelo: string;
  promptVersion: string;
  tokensEntrada: number;
  tokensSalida: number;
  costoEstimadoUsd: number;
  latenciaMs: number;
}

/** El brief del arte: qué dibujar y con qué colores. Sin datos factuales. */
export interface BriefArte {
  tipoEvento: string;
  /** "C & L" — las iniciales ya calculadas, para que las trace. */
  iniciales: string;
  /** El nombre de la plantilla, para que el adorno no pelee con ella. */
  plantilla: string;
  /** Cómo se llama la paleta ("Dorado y negro"), para el tono. */
  paleta: string;
  /** Los hex EXACTOS que puede usar, en minúsculas. */
  colores: string[];
  /** Lo que el cliente pidió en el formulario sobre estilo, si lo hay. */
  estilo?: string;
}

export type PiezaValidada =
  | { ok: true; pieza: PiezaArteId; svg: string; idea: string }
  | { ok: false; pieza: string; motivo: string };

/**
 * La aduana del arte, encima de la del SVG: además de que el documento
 * sea seguro, la pieza tiene que servir PARA SU HUECO. Un divisor
 * dibujado cuadrado no es un divisor feo: es un divisor que descuadra la
 * invitación entera.
 */
export function validarPieza(
  propuesta: PropuestaArte,
  coloresPermitidos: string[]
): PiezaValidada {
  const meta = piezaMeta(propuesta.pieza);
  if (!meta) return { ok: false, pieza: propuesta.pieza, motivo: "Esa pieza no existe en el catálogo." };

  const idea = (propuesta.idea ?? "").trim().slice(0, 240);
  if (!idea) return { ok: false, pieza: meta.id, motivo: "Vino sin explicar qué dibujó." };

  // `currentColor` siempre vale: así el adorno hereda el acento del tema
  // y sigue cuadrando si mañana se cambia la paleta de la invitación.
  const saneado = sanearSvg(propuesta.svg, { coloresPermitidos });
  if (!saneado.ok) return { ok: false, pieza: meta.id, motivo: saneado.motivo };

  const caja = saneado.svg.match(/viewBox="([^"]+)"/);
  if (!caja) return { ok: false, pieza: meta.id, motivo: "Perdió el viewBox." };
  const [, , ancho, alto] = caja[1].trim().split(/[\s,]+/).map(Number);
  const proporcion = ancho / alto;
  // Un 15% de margen: la proporción tiene que ser la del hueco, pero no
  // se rechaza una pieza por dos píxeles de diferencia.
  if (Math.abs(proporcion - meta.proporcion) / meta.proporcion > 0.15) {
    return {
      ok: false,
      pieza: meta.id,
      motivo: `La forma no cuadra con el hueco: el ${meta.nombre.toLowerCase()} se dibuja en ${meta.viewBox} (proporción ${meta.proporcion}:1) y vino en ${proporcion.toFixed(2)}:1.`,
    };
  }

  // Un documento válido y vacío pasa la aduana y no dibuja nada: eso es
  // un adorno que "funciona" y no se ve, el peor de los resultados.
  if (saneado.nodos < 3) {
    return { ok: false, pieza: meta.id, motivo: "Tiene tan pocos trazos que no se vería nada." };
  }

  return { ok: true, pieza: meta.id, svg: saneado.svg, idea };
}

/** Valida la tanda completa, en el orden del catálogo. */
export function validarPropuestas(
  propuestas: PropuestaArte[],
  coloresPermitidos: string[]
): PiezaValidada[] {
  const vistas = new Set<string>();
  const salida: PiezaValidada[] = [];
  for (const p of propuestas ?? []) {
    const id = String(p?.pieza ?? "");
    if (vistas.has(id)) continue; // una pieza repetida: se queda la primera
    vistas.add(id);
    salida.push(validarPieza(p, coloresPermitidos));
  }
  return salida;
}

/**
 * Mezcla las piezas aprobadas con el arte que ya tenía la invitación.
 * Aplicar un monograma nuevo no puede borrar el divisor de la semana
 * pasada: cada pieza se cambia sola.
 */
export function aplicarArte(
  actual: ArteInvitacion | null | undefined,
  nuevas: PiezaValidada[],
  ahora: string
): ArteInvitacion {
  const arte: ArteInvitacion = { version: 1, ...(actual ?? {}) };
  for (const p of nuevas) {
    if (!p.ok) continue;
    arte[p.pieza] = { svg: p.svg, idea: p.idea, generadoEn: ahora };
  }
  return arte;
}

/** Quita una pieza (volver al ornamento de la plantilla). */
export function quitarPieza(
  actual: ArteInvitacion | null | undefined,
  pieza: PiezaArteId
): ArteInvitacion {
  const arte: ArteInvitacion = { version: 1, ...(actual ?? {}) };
  delete arte[pieza];
  return arte;
}

/**
 * Vuelve a pasar por la aduana el arte que llega para GUARDARSE.
 *
 * Existe porque `datos` viene del navegador: la tarjeta del editor manda
 * SVG ya validado, pero una acción de servidor se puede llamar con
 * cualquier cosa, y esto se pinta después en el celular de cada invitado.
 * Lo que no pasa no se guarda a medias: se descarta la pieza y se dice.
 *
 * Nota: aquí NO se exige la paleta. La paleta puede haber cambiado desde
 * que se dibujó el adorno, y un ornamento que ya estaba puesto no se
 * borra solo porque el equipo cambiara de color: eso sería una invitación
 * que se desarma sin que nadie la toque.
 */
export function sanearArteGuardado(
  entrante: unknown
): { arte: ArteInvitacion | undefined; descartadas: string[] } {
  if (!entrante || typeof entrante !== "object") return { arte: undefined, descartadas: [] };

  const fuente = entrante as Record<string, unknown>;
  const arte: ArteInvitacion = { version: 1 };
  const descartadas: string[] = [];

  for (const id of IDS_PIEZAS) {
    const pieza = fuente[id];
    if (!pieza || typeof pieza !== "object") continue;
    const fila = pieza as Record<string, unknown>;

    const revisada = validarPieza(
      { pieza: id, svg: String(fila.svg ?? ""), idea: String(fila.idea ?? "—") },
      []
    );
    if (!revisada.ok) {
      descartadas.push(`${id}: ${revisada.motivo}`);
      continue;
    }
    arte[id] = {
      svg: revisada.svg,
      idea: revisada.idea,
      generadoEn:
        typeof fila.generadoEn === "string" && fila.generadoEn.length <= 40
          ? fila.generadoEn
          : new Date().toISOString(),
    };
  }

  return { arte: hayArte(arte) ? arte : undefined, descartadas };
}

/** ¿Tiene esta invitación arte propio en alguna pieza? */
export function hayArte(arte: ArteInvitacion | null | undefined): boolean {
  return IDS_PIEZAS.some((id) => Boolean(arte?.[id]?.svg));
}

/**
 * Los colores que puede usar el arte de esta invitación. Se le dan a la
 * IA y se le exigen después: así "trazado para su paleta" es una
 * propiedad comprobada y no una esperanza.
 */
export function coloresDePaleta(paleta: Paleta): string[] {
  return [
    paleta.acento,
    paleta.acentoClaro,
    paleta.texto,
    paleta.textoSuave,
    paleta.tarjeta,
    paleta.fondo,
  ]
    .filter((c) => /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(c ?? ""))
    .map((c) => c.toLowerCase());
}
