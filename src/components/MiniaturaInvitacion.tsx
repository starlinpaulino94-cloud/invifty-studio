import { ImageOff } from "lucide-react";

/**
 * LA IMAGEN DE UN ENLACE DE INVITACIÓN
 * =====================================
 * Donde el sistema enseña el enlace de una invitación, enseña también la
 * imagen que lo representa: la MISMA que ve quien lo recibe por WhatsApp
 * (/i/<slug>/opengraph-image, ver lib/vista-previa.ts). Así el equipo y el
 * cliente comprueban lo que se va a compartir sin salir de la pantalla.
 *
 * Un borrador no lleva imagen al compartirse (ese endpoint solo enseña lo
 * publicado), y esa es la verdad que se muestra: un marcador, no la tarjeta
 * neutra que vería un robot.
 *
 * Sin estado ni hooks: sirve igual en páginas de servidor y de cliente.
 */
export default function MiniaturaInvitacion({
  slug,
  publicada = true,
  version,
  className = "",
}: {
  slug: string;
  publicada?: boolean;
  /** Cualquier valor que cambie al editar (p. ej. `actualizado_en`): fuerza a recargar la imagen. */
  version?: string | null;
  /** El ancho lo decide quien la usa (p. ej. "w-40"). */
  className?: string;
}) {
  const marco = `block aspect-[1200/630] overflow-hidden rounded-lg border border-black/10 bg-black/5 ${className}`;

  if (!publicada) {
    return (
      <span
        className={`${marco} flex flex-col items-center justify-center gap-1 text-[10px] text-gray-400`}
      >
        <ImageOff className="w-4 h-4" aria-hidden />
        Borrador
      </span>
    );
  }

  const v = version ? `?v=${encodeURIComponent(version)}` : "";
  return (
    <span className={marco}>
      {/* eslint-disable-next-line @next/next/no-img-element -- ya es un JPEG de 1200×630 optimizado por nosotros */}
      <img
        src={`/i/${encodeURIComponent(slug)}/opengraph-image${v}`}
        alt="Imagen con la que se comparte la invitación"
        width={1200}
        height={630}
        loading="lazy"
        decoding="async"
        className="block w-full h-full object-cover"
      />
    </span>
  );
}
