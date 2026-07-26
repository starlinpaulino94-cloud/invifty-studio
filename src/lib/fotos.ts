import { crearClienteAdmin } from "./supabase/admin";

/**
 * ARCHIVOS DE UN PEDIDO
 * ======================
 * Un único sitio donde vive cómo se guardan y se nombran las fotos, para
 * que las reglas no queden repartidas por media docena de archivos.
 *
 * Estructura en el bucket `fotos-pedidos`:
 *
 *   <pedidoId>/<nombre>                      ← original tal cual lo subió
 *   <pedidoId>/<nombre> (video-…)            ← video de portada
 *   <pedidoId>/derivados/web-<nombre>.webp   ← versión a pantalla completa
 *   <pedidoId>/derivados/min-<nombre>.webp   ← miniatura
 *
 * Los derivados van en una subcarpeta a propósito: así el listado de
 * `<pedidoId>` sigue devolviendo exactamente las fotos que subió el
 * cliente, y ni el conteo del límite del plan ni la galería los ven.
 */

export const BUCKET = "fotos-pedidos";
const CARPETA_DERIVADOS = "derivados";

/** Duración de las URLs firmadas. Un invitado puede dejar la invitación
 *  abierta un buen rato; una hora se le quedaba corta y las fotos se
 *  rompían al volver a la pestaña. */
export const HORAS_FIRMA = 24;
const SEGUNDOS_FIRMA = HORAS_FIRMA * 60 * 60;

type ClienteAdmin = ReturnType<typeof crearClienteAdmin>;

export function esVideo(nombre: string): boolean {
  return nombre.startsWith("video-");
}

export function rutaOriginal(pedidoId: string, nombre: string): string {
  return `${pedidoId}/${nombre}`;
}

export function rutaWeb(pedidoId: string, nombre: string): string {
  return `${pedidoId}/${CARPETA_DERIVADOS}/web-${nombre}.webp`;
}

export function rutaMiniatura(pedidoId: string, nombre: string): string {
  return `${pedidoId}/${CARPETA_DERIVADOS}/min-${nombre}.webp`;
}

export interface ArchivoPedido {
  nombre: string;
  esVideo: boolean;
  /** true si existen las versiones ligeras (las fotos antiguas no las tienen). */
  tieneDerivados: boolean;
}

/**
 * Lista los archivos que subió el cliente, indicando cuáles ya tienen
 * versiones ligeras. Las fotos subidas antes de esta mejora simplemente
 * no las tienen y se siguen sirviendo desde el original.
 */
export async function listarArchivos(
  admin: ClienteAdmin,
  pedidoId: string,
  limite = 200
): Promise<ArchivoPedido[]> {
  const [{ data: raiz }, { data: derivados }] = await Promise.all([
    admin.storage.from(BUCKET).list(pedidoId, { limit: limite }),
    admin.storage.from(BUCKET).list(`${pedidoId}/${CARPETA_DERIVADOS}`, { limit: limite * 2 }),
  ]);

  const conDerivado = new Set((derivados ?? []).map((d) => d.name));

  return (raiz ?? [])
    // Las carpetas aparecen en el listado con id nulo: aquí solo queremos archivos.
    .filter((a) => a.id !== null)
    .map((a) => ({
      nombre: a.name,
      esVideo: esVideo(a.name),
      tieneDerivados: conDerivado.has(`web-${a.name}.webp`),
    }));
}

export interface UrlsFoto {
  nombre: string;
  /** Versión a pantalla completa (portada y visor). */
  url?: string;
  /** Miniatura para cuadrículas y vistas previas. */
  urlMiniatura?: string;
}

async function firmar(admin: ClienteAdmin, ruta: string): Promise<string | undefined> {
  const { data } = await admin.storage.from(BUCKET).createSignedUrl(ruta, SEGUNDOS_FIRMA);
  return data?.signedUrl;
}

/**
 * URLs firmadas de una foto, prefiriendo siempre la versión más ligera
 * disponible. Si la foto no tiene derivados (subida antes de la mejora),
 * ambas apuntan al original y todo sigue funcionando igual que antes.
 */
export async function urlsDeFoto(
  admin: ClienteAdmin,
  pedidoId: string,
  archivo: ArchivoPedido
): Promise<UrlsFoto> {
  if (!archivo.tieneDerivados || archivo.esVideo) {
    const url = await firmar(admin, rutaOriginal(pedidoId, archivo.nombre));
    return { nombre: archivo.nombre, url, urlMiniatura: url };
  }

  const [url, urlMiniatura] = await Promise.all([
    firmar(admin, rutaWeb(pedidoId, archivo.nombre)),
    firmar(admin, rutaMiniatura(pedidoId, archivo.nombre)),
  ]);

  return { nombre: archivo.nombre, url, urlMiniatura };
}

/** Borra un archivo y, si los tiene, sus derivados. */
export async function borrarArchivo(
  admin: ClienteAdmin,
  pedidoId: string,
  nombre: string
): Promise<{ error?: string }> {
  const { error } = await admin.storage
    .from(BUCKET)
    .remove([
      rutaOriginal(pedidoId, nombre),
      rutaWeb(pedidoId, nombre),
      rutaMiniatura(pedidoId, nombre),
    ]);
  return { error: error?.message };
}
