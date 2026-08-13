/**
 * LAS PREGUNTAS EXTRA DEL RSVP
 * =============================
 * La regla que manda aquí es "no pedir información innecesaria": un
 * cumpleaños no pregunta menú, y una boda sin bufé tampoco. Por eso las
 * preguntas extra son CONFIGURABLES por invitación — el equipo activa en
 * el editor solo las que ese evento necesita — y el mecanismo es UNO
 * solo y genérico: menú, alergias y transporte son atajos del mismo
 * sistema que las preguntas propias.
 *
 * La validación vive dos veces a propósito:
 *  - `sanearPreguntas` al GUARDAR en el editor: la configuración que
 *    entra a la base ya viene acotada (5 preguntas, textos con tope).
 *  - `validarRespuestas` al CONFIRMAR: la respuesta del invitado se
 *    valida contra la configuración REAL de esa invitación — un id
 *    desconocido se descarta, una opción inventada se rechaza, un texto
 *    se recorta. La pantalla se la salta cualquiera; esto no.
 */

export interface PreguntaRsvp {
  /** Identificador estable: es la clave de la respuesta guardada. */
  id: string;
  texto: string;
  tipo: "opciones" | "texto";
  /** Solo para tipo "opciones". */
  opciones?: string[];
}

export const MAX_PREGUNTAS = 5;
export const MAX_TEXTO_PREGUNTA = 120;
export const MAX_OPCIONES = 8;
export const MAX_TEXTO_OPCION = 40;
export const MAX_TEXTO_RESPUESTA = 200;

/**
 * Los tres atajos que cubren casi todas las bodas. Son plantillas: al
 * añadirlas, el equipo puede editar el texto y las opciones como en
 * cualquier pregunta propia.
 */
export const PREGUNTAS_PREDEFINIDAS: PreguntaRsvp[] = [
  {
    id: "menu",
    texto: "¿Qué menú prefieren?",
    tipo: "opciones",
    opciones: ["Res", "Pollo", "Pescado", "Vegetariano"],
  },
  {
    id: "alergias",
    texto: "¿Alguna alergia o restricción alimentaria?",
    tipo: "texto",
  },
  {
    id: "transporte",
    texto: "¿Necesitan transporte al evento?",
    tipo: "opciones",
    opciones: ["No, vamos por nuestra cuenta", "Sí, nos interesa"],
  },
];

/** Un id legible y estable a partir del texto de una pregunta propia. */
export function idDePregunta(texto: string): string {
  return (
    texto
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || "pregunta"
  );
}

/**
 * Acota la configuración antes de guardarla: tope de preguntas, textos
 * recortados, ids únicos, opciones limpias. Una pregunta sin texto o un
 * tipo "opciones" que se quedó sin opciones se descartan enteros.
 */
export function sanearPreguntas(crudas: unknown): PreguntaRsvp[] {
  if (!Array.isArray(crudas)) return [];
  const limpias: PreguntaRsvp[] = [];
  const vistos = new Set<string>();

  for (const cruda of crudas) {
    if (limpias.length >= MAX_PREGUNTAS) break;
    if (!cruda || typeof cruda !== "object") continue;
    const { id, texto, tipo, opciones } = cruda as Partial<PreguntaRsvp>;

    const textoLimpio = String(texto ?? "").trim().replace(/\s+/g, " ").slice(0, MAX_TEXTO_PREGUNTA);
    if (textoLimpio.length < 3) continue;

    const tipoLimpio = tipo === "opciones" ? "opciones" : "texto";
    let idLimpio = String(id ?? "").trim().slice(0, 40) || idDePregunta(textoLimpio);
    while (vistos.has(idLimpio)) idLimpio = `${idLimpio.slice(0, 37)}_2`;
    vistos.add(idLimpio);

    if (tipoLimpio === "opciones") {
      const opcionesLimpias = (Array.isArray(opciones) ? opciones : [])
        .map((o) => String(o).trim().replace(/\s+/g, " ").slice(0, MAX_TEXTO_OPCION))
        .filter((o) => o.length > 0)
        .slice(0, MAX_OPCIONES);
      if (opcionesLimpias.length < 2) continue; // una sola opción no es pregunta
      limpias.push({ id: idLimpio, texto: textoLimpio, tipo: "opciones", opciones: opcionesLimpias });
    } else {
      limpias.push({ id: idLimpio, texto: textoLimpio, tipo: "texto" });
    }
  }

  return limpias;
}

/**
 * Valida lo que contestó el invitado contra la configuración real de la
 * invitación. Devuelve SOLO respuestas legítimas: id conocido, opción
 * del catálogo de esa pregunta (o texto recortado). Lo desconocido se
 * descarta en silencio — el primo con la API abierta no guarda basura, y
 * el invitado de buena fe nunca ve un error por esto.
 */
export function validarRespuestas(
  preguntas: PreguntaRsvp[],
  brutas: unknown
): Record<string, string> {
  const limpias: Record<string, string> = {};
  if (!brutas || typeof brutas !== "object") return limpias;

  for (const pregunta of preguntas) {
    const bruta = (brutas as Record<string, unknown>)[pregunta.id];
    if (bruta === undefined || bruta === null) continue;
    const texto = String(bruta).trim().slice(0, MAX_TEXTO_RESPUESTA);
    if (!texto) continue;

    if (pregunta.tipo === "opciones") {
      // Una opción inventada no se corrige a la más parecida: se ignora.
      if (pregunta.opciones?.includes(texto)) limpias[pregunta.id] = texto;
    } else {
      limpias[pregunta.id] = texto;
    }
  }

  return limpias;
}
