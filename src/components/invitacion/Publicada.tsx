import type { Metadata } from "next";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import Renderizador from "@/components/invitacion/Renderizador";
import { ProveedorInvitacion } from "@/components/invitacion/base/Contexto";
import RegistroVisita from "@/components/invitacion/base/RegistroVisita";
import CodigoPropio from "@/components/invitacion/CodigoPropio";
import { esInvitacionDeCodigo } from "@/lib/codigo";
import { urlFuentes } from "@/config/diseno";
import { fechaLarga } from "@/lib/fechas";
import { conVideoDePortada, listarArchivos, ordenarFotos, urlsDeFoto } from "@/lib/fotos";
import type { DatosInvitacion } from "@/lib/tipos";

/**
 * LA INVITACIÓN PUBLICADA
 * ========================
 * Lo que ve el invitado, sin importar por dónde entre:
 *
 *   /i/<slug>        la dirección de siempre
 *   su propio dominio  para quien pagó el extra (ver lib/dominios.ts)
 *
 * Vive aquí y no en la página para que las dos entradas dibujen lo mismo:
 * si se toca la portada, la galería o el registro de visitas, cambia en
 * ambas a la vez.
 */

export interface InvitacionPublicable {
  slug: string;
  estado: string;
  plantilla: string;
  datos: DatosInvitacion;
  codigo_html: string | null;
  pedido_id: string;
}

/**
 * Los tags que convierten el enlace en una tarjeta con el nombre y los
 * colores del evento cuando el cliente lo manda por WhatsApp.
 *
 * `noindex` a propósito: la invitación no debe salir en Google. No afecta a
 * la vista previa — WhatsApp y Facebook leen los tags igual.
 */
export function metadatosDeInvitacion(
  invitacion: InvitacionPublicable | null,
  url: string
): Metadata {
  if (!invitacion) return { title: "Invitación — Invifty" };

  // Los borradores no anuncian nada: aún no son del cliente para compartir.
  if (invitacion.estado !== "publicada") {
    return { title: "Invitación — Invifty", robots: { index: false, follow: false } };
  }

  const datos = invitacion.datos;
  const titulo = datos.titulo || "Nuestra celebración";
  const descripcion =
    [datos.subtitulo, datos.fechaEvento ? fechaLarga(datos.fechaEvento) : ""]
      .filter(Boolean)
      .join(" · ") || "Estás invitado. Abre tu invitación digital.";

  return {
    title: `${titulo} — Invitación`,
    description: descripcion,
    robots: { index: false, follow: false },
    openGraph: {
      type: "website",
      siteName: "Invifty",
      locale: "es_DO",
      title: titulo,
      description: descripcion,
      url,
    },
    twitter: { card: "summary_large_image", title: titulo, description: descripcion },
  };
}

export default async function Publicada({
  invitacion,
  esBorrador,
}: {
  invitacion: InvitacionPublicable;
  esBorrador: boolean;
}) {
  const datos = invitacion.datos;

  // Fotos del pedido con URLs firmadas (frescas en cada visita). Se sirven
  // las versiones ligeras: la miniatura en la cuadrícula de la galería y la
  // versión web en la portada y el visor a pantalla completa.
  const admin = crearClienteAdmin();
  const archivos = await listarArchivos(admin, invitacion.pedido_id, 60);

  // El orden lo decide el equipo en el editor; la primera es la portada.
  const fotos = ordenarFotos(
    await Promise.all(
      archivos
        .filter((a) => !a.esVideo)
        .map((a) => urlsDeFoto(admin, invitacion.pedido_id, a))
    ),
    datos.ordenFotos,
    datos.fotosOcultas
  );

  // Si el cliente subió un video, va de portada por delante de las fotos:
  // es lo que promete el plan Luxury. El equipo puede apagarlo en el editor.
  const archivoVideo = archivos.find((a) => a.esVideo);
  const medios = conVideoDePortada(
    fotos,
    archivoVideo ? await urlsDeFoto(admin, invitacion.pedido_id, archivoVideo) : undefined,
    datos.efectos?.videoPortada !== false
  );

  return (
    <>
      {/* Solo se cargan las familias tipográficas que esta invitación usa */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="stylesheet" href={urlFuentes(datos.tipografia)} />

      <ProveedorInvitacion slug={invitacion.slug} esBorrador={esBorrador}>
        <RegistroVisita />
        {esInvitacionDeCodigo(invitacion.plantilla) ? (
          <CodigoPropio html={invitacion.codigo_html} datos={datos} fotos={medios} />
        ) : (
          <Renderizador
            plantilla={invitacion.plantilla}
            datos={datos}
            fotos={medios}
            esBorrador={esBorrador}
          />
        )}
      </ProveedorInvitacion>
    </>
  );
}
