"use client";

import { useSyncExternalStore, type CSSProperties } from "react";
import { esVideo } from "@/lib/fotos";

/**
 * LA PORTADA: FOTO O VIDEO
 * =========================
 * El plan Luxury promete que el video del cliente "se verá en bucle en la
 * portada". El video se subía y se guardaba, pero ninguna plantilla sabía
 * dibujarlo: se quedaba en el bucket. Esto lo arregla en un solo sitio.
 *
 * Las doce plantillas piden su portada aquí en vez de escribir un <img>, así
 * que da igual cuál elija el cliente y una plantilla nueva lo hereda sin
 * enterarse. Si el archivo es un video se dibuja en bucle, mudo y sin
 * controles; si es una foto, exactamente lo de antes.
 *
 * MUDO NO ES OPCIONAL: ningún navegador deja que un video con sonido se
 * reproduzca solo, y si se intenta no arranca ninguno. La música de la
 * invitación es cosa aparte, con su botón.
 */

/* ---------- Movimiento reducido ---------- */

const CONSULTA = "(prefers-reduced-motion: reduce)";

function suscribirse(avisar: () => void) {
  const mq = window.matchMedia(CONSULTA);
  mq.addEventListener("change", avisar);
  return () => mq.removeEventListener("change", avisar);
}

const prefiereQuieto = () => window.matchMedia(CONSULTA).matches;

export interface MedioPortadaProps {
  /**
   * La portada elegida. Si su nombre empieza por "video-", es un video, y
   * entonces `urlMiniatura` es la foto que se enseña mientras carga.
   */
  medio?: { nombre: string; url?: string; urlMiniatura?: string };
  className?: string;
  style?: CSSProperties;
}

export default function MedioPortada({ medio, className, style }: MedioPortadaProps) {
  /**
   * Hay quien tiene activado "reducir movimiento" en su teléfono, muchas
   * veces por mareos o migrañas. A esa persona se le enseña el primer
   * fotograma quieto en vez de un bucle a pantalla completa.
   *
   * useSyncExternalStore y no un efecto: en el servidor devuelve false, así
   * que el HTML sale igual para todos y el navegador ajusta al hidratar.
   */
  const quieto = useSyncExternalStore(suscribirse, prefiereQuieto, () => false);

  if (!medio?.url) return null;

  // Para un video, `urlMiniatura` trae la primera foto del cliente: es lo
  // que se ve mientras el video carga y lo que queda fijo si el invitado
  // pidió menos movimiento. Si no hay fotos, apunta al propio video y no
  // sirve de respaldo.
  const respaldo = medio.urlMiniatura !== medio.url ? medio.urlMiniatura : undefined;

  if (!esVideo(medio.nombre)) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={medio.url} alt="" className={className} style={style} />;
  }

  return (
    <video
      src={medio.url}
      poster={respaldo}
      className={className}
      style={style}
      autoPlay={!quieto}
      loop
      muted
      // Sin esto, iOS abre el video a pantalla completa en cuanto empieza y
      // se lleva por delante la invitación entera.
      playsInline
      // Solo la cabecera hasta que haga falta: son 50 MB como mucho y
      // muchos invitados abren la invitación con datos móviles.
      preload="metadata"
      aria-hidden="true"
      tabIndex={-1}
    />
  );
}
