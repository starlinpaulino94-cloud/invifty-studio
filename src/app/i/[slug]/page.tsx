import { notFound } from "next/navigation";
import type { Metadata, Viewport } from "next";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import Renderizador from "@/components/invitacion/Renderizador";
import { ProveedorInvitacion } from "@/components/invitacion/base/Contexto";
import { DatosInvitacion } from "@/lib/tipos";
import { urlFuentes, paleta } from "@/config/diseno";
import { fechaLarga } from "@/lib/fechas";
import { listarArchivos, urlsDeFoto } from "@/lib/fotos";
import { urlBase } from "@/lib/url";

export const dynamic = "force-dynamic";

/**
 * Página pública de la invitación: /i/<slug>
 * - Publicada → visible para todo el mundo.
 * - Borrador  → visible SOLO para el equipo con sesión iniciada
 *   (vista previa antes de publicar); el público recibe 404.
 * Las fotos usan URLs firmadas generadas en cada visita (bucket privado).
 */

async function buscarInvitacion(slug: string) {
  const admin = crearClienteAdmin();
  const { data } = await admin
    .from("invitaciones")
    .select("*, pedidos(id)")
    .eq("slug", slug)
    .single();
  return data;
}

/**
 * La barra del navegador móvil toma el color de fondo de la invitación,
 * para que la pantalla completa se sienta de una sola pieza.
 */
export async function generateViewport({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Viewport> {
  const { slug } = await params;
  const invitacion = await buscarInvitacion(slug);
  const datos = invitacion?.datos as DatosInvitacion | undefined;
  return { themeColor: paleta(datos?.paleta).fondo };
}

/**
 * Metadatos para compartir. Lo que el cliente hace con su invitación es
 * mandarla por WhatsApp a todos sus invitados: estos tags (más la imagen de
 * `opengraph-image.tsx`) son los que convierten ese enlace en una tarjeta
 * con los colores y el nombre del evento en vez de un link gris.
 *
 * Se mantiene `noindex` a propósito: la invitación no debe salir en Google.
 * No afecta a la vista previa — WhatsApp y Facebook leen los tags igual.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const invitacion = await buscarInvitacion(slug);
  if (!invitacion) return { title: "Invitación — Invifty" };

  const datos = invitacion.datos as DatosInvitacion;
  const publicada = invitacion.estado === "publicada";

  // Los borradores no anuncian nada: aún no son del cliente para compartir.
  if (!publicada) {
    return { title: "Invitación — Invifty", robots: { index: false, follow: false } };
  }

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
      url: `${urlBase()}/i/${slug}`,
    },
    twitter: {
      card: "summary_large_image",
      title: titulo,
      description: descripcion,
    },
  };
}

export default async function PaginaInvitacion({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const invitacion = await buscarInvitacion(slug);
  if (!invitacion) notFound();

  const esBorrador = invitacion.estado !== "publicada";

  // Los borradores solo los ve el equipo autenticado
  if (esBorrador) {
    const supabase = await crearClienteServidor();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) notFound();
  }

  // Fotos del pedido con URLs firmadas (frescas en cada visita).
  // Se sirven las versiones ligeras: la miniatura en la cuadrícula de la
  // galería y la versión web en la portada y el visor a pantalla completa.
  const admin = crearClienteAdmin();
  const pedidoId = invitacion.pedido_id as string;
  const archivos = await listarArchivos(admin, pedidoId, 60);

  const fotos = await Promise.all(
    archivos.filter((a) => !a.esVideo).map((a) => urlsDeFoto(admin, pedidoId, a))
  );

  const datos = invitacion.datos as DatosInvitacion;

  return (
    <>
      {/* Solo se cargan las familias tipográficas que esta invitación usa */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="stylesheet" href={urlFuentes(datos.tipografia)} />

      <ProveedorInvitacion slug={slug} esBorrador={esBorrador}>
        <Renderizador
          plantilla={invitacion.plantilla as string}
          datos={datos}
          fotos={fotos}
          esBorrador={esBorrador}
        />
      </ProveedorInvitacion>
    </>
  );
}
