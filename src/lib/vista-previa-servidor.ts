import sharp from "sharp";
import type { crearClienteAdmin } from "./supabase/admin";
import { esInvitacionDeCodigo } from "./codigo";
import { rutaDeMedioCodigo } from "./codigo-medios";
import {
  BUCKET, listarArchivos, ordenarFotos, rutaOriginal, rutaWeb, type ArchivoPedido,
} from "./fotos";
import {
  ALTO_VISTA, ANCHO_VISTA, MAXIMO_INTENTOS, candidatosDeImagen, encuadreDe,
} from "./vista-previa";
import type { DatosInvitacion } from "./tipos";

type ClienteAdmin = ReturnType<typeof crearClienteAdmin>;

/**
 * WhatsApp descarta las imágenes de vista previa que pesan demasiado (en la
 * práctica, por encima de unos 300 KB deja de mostrarlas o las degrada) y
 * se cansa de esperar a los pocos segundos. Por eso la imagen sale siempre
 * como JPEG de 1200 × 630, ligera, y no como el PNG de una foto de 6 MB.
 */
const CALIDAD_JPEG = 76;

/** Más que esto no se baja: una foto normal pesa 2-6 MB; un video, 50. */
const MAXIMO_BYTES_ORIGEN = 15 * 1024 * 1024;

export interface InvitacionParaVista {
  estado: string;
  plantilla: string;
  codigo_html: string | null;
  pedido_id: string;
  datos: DatosInvitacion;
}

/**
 * Convierte una imagen cualquiera en la tarjeta de 1200 × 630.
 * Lanza si `origen` no es una imagen que sharp pueda leer (un video, una
 * tipografía…): quien llama prueba entonces con el siguiente candidato.
 */
export async function jpegDeVistaPrevia(origen: Buffer): Promise<Buffer> {
  // `rotate()` aplica la orientación EXIF: sin esto, una foto tomada en
  // vertical con el celular saldría acostada.
  const base = sharp(origen, { failOn: "none", limitInputPixels: 100_000_000 }).rotate();

  const { width = 0, height = 0, orientation = 1 } = await sharp(origen, {
    failOn: "none",
    limitInputPixels: 100_000_000,
  }).metadata();
  // Las orientaciones 5-8 giran la imagen un cuarto de vuelta: ancho y alto se cambian.
  const girada = orientation >= 5;
  const ancho = girada ? height : width;
  const alto = girada ? width : height;

  if (encuadreDe(ancho, alto) === "cubrir") {
    return base
      .resize(ANCHO_VISTA, ALTO_VISTA, { fit: "cover", position: sharp.strategy.attention })
      .jpeg({ quality: CALIDAD_JPEG, mozjpeg: true })
      .toBuffer();
  }

  // Imagen vertical o cuadrada: se enseña entera, sobre un fondo hecho con
  // ella misma muy difuminado y apagado. Se difumina en pequeño y se amplía:
  // el resultado es igual de suave y cuesta una fracción.
  const fondo = await base
    .clone()
    .resize(300, 158, { fit: "cover" })
    .blur(10)
    .modulate({ brightness: 0.7 })
    .resize(ANCHO_VISTA, ALTO_VISTA)
    .toBuffer();

  const frente = await base
    .clone()
    .resize(ANCHO_VISTA, ALTO_VISTA, { fit: "inside", withoutEnlargement: true })
    .toBuffer();

  return sharp(fondo)
    .composite([{ input: frente, gravity: "centre" }])
    .jpeg({ quality: CALIDAD_JPEG, mozjpeg: true })
    .toBuffer();
}

function rutaDeFoto(pedidoId: string, foto: ArchivoPedido): string {
  // La versión web (≤1600 px, WebP) ya es ligera; el original puede pesar 6 MB.
  return foto.tieneDerivados
    ? rutaWeb(pedidoId, foto.nombre)
    : rutaOriginal(pedidoId, foto.nombre);
}

/**
 * Las rutas de Storage a probar, en orden de preferencia:
 *  1. Si es código propio: las imágenes del HTML, en el orden en que salen.
 *  2. La foto de portada que eligió el equipo (la primera del orden).
 */
async function rutasCandidatas(
  admin: ClienteAdmin,
  inv: InvitacionParaVista
): Promise<string[]> {
  const archivos = await listarArchivos(admin, inv.pedido_id, 60);
  const fotos = ordenarFotos(
    archivos.filter((a) => !a.esVideo),
    inv.datos.ordenFotos,
    inv.datos.fotosOcultas
  );

  const rutas: string[] = [];

  if (esInvitacionDeCodigo(inv.plantilla)) {
    const candidatos = candidatosDeImagen(inv.codigo_html);

    // Lo alojado aparte no tiene extensión: el tipo y el peso se leen del
    // listado, para no bajar un video de 50 MB solo para descubrir que lo es.
    const hayMedios = candidatos.some((c) => c.tipo === "medio");
    const medios = new Map<string, { tipo?: string; peso?: number }>();
    if (hayMedios) {
      const { data } = await admin.storage
        .from(BUCKET)
        .list(`${inv.pedido_id}/codigo`, { limit: 200 });
      for (const f of data ?? []) {
        const meta = f.metadata as { mimetype?: string; size?: number } | null;
        medios.set(f.name, { tipo: meta?.mimetype, peso: meta?.size });
      }
    }

    for (const c of candidatos) {
      if (c.tipo === "medio") {
        const info = medios.get(c.id);
        if (!info?.tipo?.startsWith("image/")) continue;
        if ((info.peso ?? 0) > MAXIMO_BYTES_ORIGEN) continue;
        rutas.push(rutaDeMedioCodigo(inv.pedido_id, c.id));
      } else {
        const foto = fotos[c.indice - 1];
        if (foto) rutas.push(rutaDeFoto(inv.pedido_id, foto));
      }
    }
  }

  if (fotos[0]) rutas.push(rutaDeFoto(inv.pedido_id, fotos[0]));

  return [...new Set(rutas)].slice(0, MAXIMO_INTENTOS);
}

/**
 * La imagen principal de una invitación, lista para compartir, o null si no
 * hay ninguna que sirva (entonces se dibuja la tarjeta con su paleta).
 *
 * Solo las PUBLICADAS: este endpoint lo consultan robots sin sesión, y un
 * borrador aún no es del cliente para enseñarlo.
 */
export async function imagenPrincipalDeVista(
  admin: ClienteAdmin,
  inv: InvitacionParaVista
): Promise<Buffer | null> {
  if (inv.estado !== "publicada") return null;

  for (const ruta of await rutasCandidatas(admin, inv)) {
    try {
      const { data, error } = await admin.storage.from(BUCKET).download(ruta);
      if (error || !data || data.size > MAXIMO_BYTES_ORIGEN) continue;
      return await jpegDeVistaPrevia(Buffer.from(await data.arrayBuffer()));
    } catch {
      // No era una imagen legible: se prueba con la siguiente.
    }
  }
  return null;
}
