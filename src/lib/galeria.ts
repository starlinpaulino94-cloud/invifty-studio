import { estadoDeCapacidad, type ContratoCapacidades } from "./capacidades";

/**
 * LA GALERÍA COLABORATIVA DEL EVENTO — la lógica pura
 * ====================================================
 * Un QR/enlace en el evento (/galeria/<slug>) donde los invitados suben
 * sus fotos a un álbum común. Sin cuentas, como todo lo de invitados:
 * la credencial es conocer el enlace, y los frenos y topes técnicos
 * cuidan el resto.
 *
 * QUIÉN LA TIENE. El pedido que compró el extra galeria_post_evento, o
 * cuyo contrato incluye la capacidad. Y una decisión deliberada: los
 * contratos VIEJOS que la compraron cuando el catálogo decía "vendida
 * sin implementar" también la tienen — la pagaron; ahora que existe,
 * se les honra. Negarla por el estado congelado sería castigar al que
 * confió primero.
 */

/** Tope técnico anti-abuso (no comercial): fotos por galería. */
export const MAX_FOTOS_GALERIA = 300;

/** Tamaño máximo por foto. Los invitados suben desde el celular. */
export const GALERIA_MAX_MB = 10;

export const GALERIA_TIPOS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

/** Tope del nombre que el invitado deja junto a su foto. */
export const MAX_AUTOR = 60;

export function autorLimpio(autor: unknown): string | null {
  if (typeof autor !== "string") return null;
  const limpio = autor.replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, MAX_AUTOR);
  return limpio || null;
}

/**
 * ¿Este pedido tiene galería? Extra comprado o capacidad en el contrato.
 * "activa" y "vendida_sin_implementar" cuentan las dos: la segunda es un
 * contrato viejo que la pagó antes de que existiera.
 */
export function tieneGaleria(pedido: { extras: string[] }, contrato: ContratoCapacidades): boolean {
  if (pedido.extras?.includes("galeria_post_evento")) return true;
  const estado = estadoDeCapacidad(contrato, "galeria_post_evento");
  return estado === "activa" || estado === "vendida_sin_implementar";
}

/**
 * ¿La galería acepta fotos ahora mismo? Tres puertas a la vez: el pedido
 * la incluye, la invitación está publicada (una galería de un borrador
 * no existe para el público) y el anfitrión la abrió.
 */
export function estadoDeGaleria(
  incluida: boolean,
  invitacion: { estado: string; galeria_abierta: boolean }
): "abierta" | "cerrada" | "no_disponible" {
  if (!incluida || invitacion.estado !== "publicada") return "no_disponible";
  return invitacion.galeria_abierta ? "abierta" : "cerrada";
}

/** Ruta en el bucket privado de la versión web de una foto de galería. */
export function rutaGaleria(invitacionId: string, id: string): string {
  return `galeria/${invitacionId}/${id}.webp`;
}

/** Ruta de la miniatura. */
export function rutaGaleriaMiniatura(invitacionId: string, id: string): string {
  return `galeria/${invitacionId}/min-${id}.webp`;
}

/** Mensaje listo para que el anfitrión comparta el álbum por WhatsApp. */
export function mensajeWhatsAppGaleria(url: string): string {
  return (
    `📸 ¡Comparte tus fotos del evento!\n\n` +
    `Sube las fotos que tomaste y mira las de todos aquí:\n\n` +
    `${url}\n\n` +
    `Entre todos armamos el álbum del recuerdo. 💛`
  );
}
