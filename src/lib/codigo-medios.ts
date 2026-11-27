/**
 * LOS ARCHIVOS DEL CÓDIGO PROPIO
 * ===============================
 * Un HTML hecho fuera del sistema suele traer sus imágenes, tipografías,
 * música y hasta videos METIDOS DENTRO como `data:…;base64,…`. Eso hace el
 * HTML enorme, y un HTML enorme no se puede mandar por una acción de
 * servidor: Next la corta en 1 MB y Vercel en 4,5 MB (el error que dejó a
 * una invitación sin guardarse).
 *
 * En vez de subir el tope sin fin, el editor SACA esos archivos del HTML
 * antes de guardar: los sube directo al almacenamiento (sin pasar por una
 * función, así que no hay tope de 4,5 MB) y deja en el HTML un marcador
 * `{{MEDIO_<id>}}` de unos 30 bytes. Al mostrar la invitación, cada
 * marcador se cambia por una dirección firmada y fresca — el mismo trato
 * que ya tienen las fotos del cliente.
 *
 * Este archivo es PURO (sin red ni Supabase) para que lo usen igual el
 * navegador, el servidor y las pruebas.
 */

/** Cuántos caracteres base64 hacen falta para sacar un archivo del HTML.
 *  Los íconos diminutos se quedan dentro: sacarlos no ahorra nada. */
export const MINIMO_BASE64_CHARS = 8_000;

/** Tope por archivo, según su clase. El video iguala al del formulario. */
const MB = 1024 * 1024;
export const TOPE_POR_CLASE = {
  imagen: 15 * MB,
  video: 50 * MB,
  audio: 20 * MB,
  fuente: 5 * MB,
} as const;
export type ClaseMedio = keyof typeof TOPE_POR_CLASE;

const CLASES: Record<string, ClaseMedio> = {
  "image/png": "imagen",
  "image/jpeg": "imagen",
  "image/jpg": "imagen",
  "image/webp": "imagen",
  "image/gif": "imagen",
  "image/avif": "imagen",
  "video/mp4": "video",
  "video/webm": "video",
  "video/quicktime": "video",
  "audio/mpeg": "audio",
  "audio/mp3": "audio",
  "audio/mp4": "audio",
  "audio/aac": "audio",
  "audio/ogg": "audio",
  "audio/wav": "audio",
  "audio/webm": "audio",
  "font/woff2": "fuente",
  "font/woff": "fuente",
  "font/ttf": "fuente",
  "font/otf": "fuente",
  "application/font-woff": "fuente",
  "application/font-woff2": "fuente",
  "application/x-font-ttf": "fuente",
  "application/x-font-woff": "fuente",
};
// SVG queda fuera A PROPÓSITO: es código. Si viene embebido se queda dentro
// del HTML (que ya va aislado en su iframe) y no se aloja en nuestro bucket.

export function claseDeMedio(mime: string): ClaseMedio | null {
  return CLASES[mime.toLowerCase()] ?? null;
}

/** Motivo por el que un archivo no se puede alojar, o null si sirve. */
export function errorDeMedio(mime: string, bytes: number): string | null {
  const clase = claseDeMedio(mime);
  if (!clase) return `El tipo «${mime}» no se puede alojar.`;
  if (bytes <= 0) return "El archivo está vacío.";
  if (bytes > TOPE_POR_CLASE[clase]) {
    return (
      `Un archivo de tipo ${clase} pesa ${(bytes / MB).toFixed(1).replace(".", ",")} MB ` +
      `y el máximo es ${TOPE_POR_CLASE[clase] / MB} MB. Comprímelo antes de pegarlo.`
    );
  }
  return null;
}

/* ============================================================
   MARCADORES
   ============================================================ */

const LARGO_ID = 16;

/** `{{MEDIO_0123456789ABCDEF}}` — mayúsculas y hex, como el resto de marcadores. */
export function marcadorDeMedio(id: string): string {
  return `{{MEDIO_${id}}}`;
}

export function esIdDeMedio(id: string): boolean {
  return /^[0-9A-F]{16}$/.test(id);
}

/** Ids de los archivos que el HTML referencia con marcador (sin repetir). */
export function idsDeMedios(html: string): string[] {
  const ids = new Set<string>();
  for (const m of html.matchAll(/\{\{\s*MEDIO_([0-9A-F]{16})\s*\}\}/g)) ids.add(m[1]);
  return [...ids];
}

/** Dónde vive el archivo en el bucket: subcarpeta propia, fuera del conteo de fotos del plan. */
export function rutaDeMedioCodigo(pedidoId: string, id: string): string {
  return `${pedidoId}/codigo/${id}`;
}

/* ============================================================
   EXTRACCIÓN
   ============================================================ */

const DATA_URI = /data:([a-z0-9.+-]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)/gi;

/** ¿Trae el HTML archivos embebidos que valga la pena sacar? */
export function tieneMediosEmbebidos(html: string): boolean {
  for (const m of html.matchAll(DATA_URI)) {
    if (m[2].length >= MINIMO_BASE64_CHARS && claseDeMedio(m[1])) return true;
  }
  return false;
}

export interface MedioExtraido {
  id: string;
  mime: string;
  bytes: Uint8Array<ArrayBuffer>;
}

function decodificar(base64: string): Uint8Array<ArrayBuffer> {
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

async function idDeContenido(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const huella = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(huella)]
    .slice(0, LARGO_ID / 2)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

/**
 * Saca del HTML los archivos embebidos y los cambia por marcadores.
 *
 * El id sale del CONTENIDO (SHA-256), no de un contador: el mismo archivo
 * repetido diez veces en el HTML se sube una sola vez, y guardar de nuevo
 * un HTML que ya se extrajo no duplica nada. Lo que no se puede alojar
 * (tipo no permitido, base64 roto) se deja donde estaba.
 *
 * Devuelve además los `omitidos`: archivos grandes que no se pudieron
 * alojar y por qué, para decírselo a quien pegó el código en vez de
 * guardar en silencio un HTML que sigue pesado.
 */
export async function extraerMediosEmbebidos(html: string): Promise<{
  html: string;
  medios: MedioExtraido[];
  omitidos: string[];
}> {
  const medios = new Map<string, MedioExtraido>();
  const omitidos: string[] = [];
  const reemplazos = new Map<string, string>(); // data URI completo → marcador

  for (const m of html.matchAll(DATA_URI)) {
    const [completo, mime, base64] = m;
    if (base64.length < MINIMO_BASE64_CHARS || reemplazos.has(completo)) continue;

    if (!claseDeMedio(mime)) {
      omitidos.push(`Un archivo «${mime}» se dejó dentro del HTML (ese tipo no se aloja aparte).`);
      continue;
    }

    let bytes: Uint8Array<ArrayBuffer>;
    try {
      bytes = decodificar(base64);
    } catch {
      omitidos.push(`Un archivo «${mime}» venía mal codificado y se dejó dentro del HTML.`);
      continue;
    }

    const problema = errorDeMedio(mime, bytes.length);
    if (problema) {
      omitidos.push(problema);
      continue;
    }

    const id = await idDeContenido(bytes);
    if (!medios.has(id)) medios.set(id, { id, mime, bytes });
    reemplazos.set(completo, marcadorDeMedio(id));
  }

  let resultado = html;
  for (const [uri, marcador] of reemplazos) resultado = resultado.split(uri).join(marcador);

  return { html: resultado, medios: [...medios.values()], omitidos: [...new Set(omitidos)] };
}

/**
 * Cuánto pesaría el HTML una vez sacados sus archivos embebidos. Sirve para
 * avisar al pegar sin asustar por algo que el guardado resuelve solo.
 */
export function htmlSinMedios(html: string): string {
  return html.replace(DATA_URI, (completo, mime: string, base64: string) =>
    base64.length >= MINIMO_BASE64_CHARS && claseDeMedio(mime)
      ? marcadorDeMedio("0".repeat(LARGO_ID))
      : completo
  );
}
