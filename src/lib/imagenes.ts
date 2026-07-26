import sharp from "sharp";

/**
 * VERSIONES LIGERAS DE LAS FOTOS
 * ===============================
 * Los clientes suben fotos tal como salen del celular: 3-6 MB cada una.
 * Una galería de 15 fotos servida así son 50-90 MB que el invitado
 * descarga con sus datos móviles, y mucha gente abandona antes.
 *
 * Al subir se generan dos derivados en WebP que pesan una fracción:
 *  - "web": la que se ve a pantalla completa (portada y visor de galería)
 *  - "min": la miniatura de la cuadrícula y de las vistas previas
 *
 * El archivo original NUNCA se toca: sigue disponible para el equipo de
 * diseño, que lo descarga desde la ficha del pedido.
 */

/** Lado mayor de la versión a pantalla completa. */
export const ANCHO_WEB = 1600;
/** Lado mayor de la miniatura. */
export const ANCHO_MINIATURA = 600;

export interface Derivados {
  web: Buffer;
  miniatura: Buffer;
}

/**
 * Genera los derivados de una imagen. Devuelve null si el formato no se
 * puede procesar (por ejemplo un HEIC en un servidor sin soporte HEIF):
 * en ese caso la foto se guarda igual y el sistema usa el original.
 */
export async function generarDerivados(datos: Buffer): Promise<Derivados | null> {
  try {
    // `rotate()` sin argumentos aplica la orientación EXIF: sin esto, las
    // fotos tomadas en vertical con el celular salen acostadas.
    const base = sharp(datos, { failOn: "none" }).rotate();

    const [web, miniatura] = await Promise.all([
      base
        .clone()
        .resize({ width: ANCHO_WEB, height: ANCHO_WEB, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer(),
      base
        .clone()
        .resize({ width: ANCHO_MINIATURA, height: ANCHO_MINIATURA, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 72 })
        .toBuffer(),
    ]);

    return { web, miniatura };
  } catch (e) {
    // Nunca rompemos la subida del cliente por un fallo de conversión.
    console.error("No se pudieron generar los derivados de la imagen:", e);
    return null;
  }
}
