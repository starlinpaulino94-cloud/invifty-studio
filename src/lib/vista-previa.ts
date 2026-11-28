/**
 * LA IMAGEN QUE ACOMPAÑA AL ENLACE
 * =================================
 * Cuando el cliente (o un invitado) pega el enlace en WhatsApp, Instagram o
 * Facebook, la app pide la etiqueta og:image y enseña esa imagen encima del
 * nombre del evento. Con una foto real de la invitación, el enlace deja de
 * parecer un texto seco y se lee como lo que es: una invitación.
 *
 * Este archivo decide DE DÓNDE sale esa imagen y CÓMO se encuadra. Es puro
 * (sin red ni Storage) para poder probarlo; quien baja los archivos y los
 * convierte es `vista-previa-servidor.ts`.
 */

/** Tamaño estándar de la tarjeta de vista previa (1,91 : 1). */
export const ANCHO_VISTA = 1200;
export const ALTO_VISTA = 630;

/** Cuántas imágenes se intentan antes de rendirse y dibujar la tarjeta. */
export const MAXIMO_INTENTOS = 4;

export type Candidato =
  | { tipo: "medio"; id: string }
  | { tipo: "foto"; indice: number };

/**
 * Las imágenes que el HTML de código propio menciona, en el orden en que
 * aparecen. La primera es, casi siempre, la portada del diseño.
 *
 * Solo cuentan los marcadores que el sistema sabe resolver a un archivo
 * suyo ({{MEDIO_…}}, {{FOTO_n}}, {{PORTADA}}). Una imagen que el HTML carga
 * de una dirección externa NO se descarga a propósito: obligaría al
 * servidor a pedir direcciones que decide un tercero.
 *
 * Los `@font-face` se descartan antes de mirar: una tipografía alojada
 * también es un {{MEDIO_…}} y no es una imagen.
 */
export function candidatosDeImagen(html: string | null | undefined): Candidato[] {
  if (!html) return [];

  const sinTipografias = html.replace(/@font-face\s*\{[^}]*\}/gi, "");
  const vistos = new Set<string>();
  const candidatos: Candidato[] = [];

  for (const m of sinTipografias.matchAll(/\{\{\s*([A-Z][A-Z0-9_]*)\s*\}\}/g)) {
    const nombre = m[1];
    let candidato: Candidato | null = null;

    const medio = /^MEDIO_([0-9A-F]{16})$/.exec(nombre);
    const foto = /^FOTO_(\d+)$/.exec(nombre);

    if (medio) candidato = { tipo: "medio", id: medio[1] };
    else if (nombre === "PORTADA") candidato = { tipo: "foto", indice: 1 };
    else if (foto && Number(foto[1]) >= 1) candidato = { tipo: "foto", indice: Number(foto[1]) };

    if (!candidato) continue;
    const clave = candidato.tipo === "medio" ? `m${candidato.id}` : `f${candidato.indice}`;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    candidatos.push(candidato);
    if (candidatos.length >= MAXIMO_INTENTOS) break;
  }

  return candidatos;
}

/**
 * ¿Llenar la tarjeta recortando, o enseñar la imagen entera sobre un fondo
 * difuminado de sí misma?
 *
 * Una invitación suele ser un cartel vertical, con el texto repartido por
 * toda la imagen. Recortarlo a 1,91 : 1 se llevaría el nombre o la fecha.
 * Solo se recorta cuando la imagen ya es casi tan ancha como la tarjeta y
 * lo que se pierde es poco.
 */
export function encuadreDe(ancho: number, alto: number): "cubrir" | "contener" {
  if (!(ancho > 0) || !(alto > 0)) return "contener";
  return ancho / alto >= 1.45 ? "cubrir" : "contener";
}
