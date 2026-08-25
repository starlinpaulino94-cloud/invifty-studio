import type { DatosInvitacion } from "./tipos";

/**
 * LO QUE EL CLIENTE PUEDE EDITAR DE SU INVITACIÓN — el modelo híbrido
 * ====================================================================
 * El cliente edita CONTENIDO (sus textos: el título, la historia, la
 * despedida…) mientras la invitación no esté aprobada. El DISEÑO
 * (plantilla, paleta, tipografía, secciones, fotos, RSVP) es del equipo:
 * no está en esta lista y por tanto no existe para la edición del
 * portal — la lista blanca ES la frontera, no un if en la pantalla.
 *
 * La fecha y el lugar tampoco están: cambiarlos mueve coordinación y
 * vencimientos, así que pasan por el equipo (WhatsApp), no por un campo.
 *
 * Tras aprobar (bloqueada_en) no se edita nada: el candado es el mismo
 * que ya respeta el editor del equipo. Desbloquear existe, es explícito
 * y firma en auditoría.
 */

export interface CampoContenido {
  id: keyof DatosInvitacion & string;
  etiqueta: string;
  /** Ayuda corta bajo el campo. */
  nota?: string;
  max: number;
  multilinea: boolean;
}

export const CAMPOS_CONTENIDO: CampoContenido[] = [
  { id: "titulo", etiqueta: "Título", nota: "Los nombres tal como quieren verse.", max: 80, multilinea: false },
  { id: "subtitulo", etiqueta: "Subtítulo", max: 120, multilinea: false },
  { id: "frase", etiqueta: "Frase de portada", nota: "Una frase o versículo, si quieren llevar uno.", max: 240, multilinea: false },
  { id: "historia", etiqueta: "Nuestra historia", max: 2000, multilinea: true },
  { id: "dressCode", etiqueta: "Código de vestimenta", max: 120, multilinea: false },
  { id: "hashtag", etiqueta: "Hashtag", nota: "Ej. #CamilaYLucas2026", max: 60, multilinea: false },
  { id: "mensajeFinal", etiqueta: "Mensaje de despedida", max: 300, multilinea: true },
];

export type CambiosContenido = Partial<Record<string, string>>;

/**
 * Valida lo que llegó del navegador contra la lista blanca. Devuelve los
 * cambios limpios y los errores CON NOMBRE — pasarse del tope no se
 * recorta en silencio: se le dice al cliente cuánto cabe.
 */
export function validarContenido(crudo: unknown): {
  cambios: CambiosContenido;
  errores: string[];
} {
  const cambios: CambiosContenido = {};
  const errores: string[] = [];
  if (!crudo || typeof crudo !== "object") return { cambios, errores: ["No llegó nada que guardar."] };

  for (const campo of CAMPOS_CONTENIDO) {
    const valor = (crudo as Record<string, unknown>)[campo.id];
    if (valor === undefined) continue; // no se tocó
    if (typeof valor !== "string") {
      errores.push(`${campo.etiqueta}: valor no válido.`);
      continue;
    }
    // Sin caracteres de control; el salto de línea se conserva y luego
    // se decide según el campo.
    let limpio = valor.replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, "");
    if (!campo.multilinea) limpio = limpio.replace(/\s*\n\s*/g, " ");
    limpio = limpio.trim();
    if (limpio.length > campo.max) {
      errores.push(`${campo.etiqueta}: máximo ${campo.max} caracteres (tiene ${limpio.length}).`);
      continue;
    }
    cambios[campo.id] = limpio;
  }
  return { cambios, errores };
}

/**
 * Aplica los cambios validados sobre los datos actuales. SOLO los campos
 * de la lista blanca: aunque el navegador mandara "paleta", aquí no
 * entra. Devuelve datos nuevos; no muta los de entrada.
 */
export function aplicarContenido(
  datos: DatosInvitacion,
  cambios: CambiosContenido
): DatosInvitacion {
  const resultado = { ...datos };
  for (const campo of CAMPOS_CONTENIDO) {
    const valor = cambios[campo.id];
    if (valor !== undefined) {
      (resultado as unknown as Record<string, string>)[campo.id] = valor;
    }
  }
  return resultado;
}

/**
 * ¿Se puede editar el contenido de esta invitación? El candado de la
 * aprobación manda: lo aprobado no se toca por descuido, ni por el
 * equipo ni por el cliente.
 */
export function puedeEditarContenido(invitacion: {
  bloqueada_en: string | null;
}): { ok: true } | { ok: false; motivo: string } {
  if (invitacion.bloqueada_en) {
    return {
      ok: false,
      motivo:
        "Tu invitación ya está aprobada y protegida contra cambios. Si necesitas ajustar algo, escríbenos por WhatsApp.",
    };
  }
  return { ok: true };
}
