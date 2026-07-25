import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import Renderizador from "@/components/invitacion/Renderizador";
import { DatosInvitacion } from "@/lib/tipos";
import { urlFuentes } from "@/config/diseno";

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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const invitacion = await buscarInvitacion(slug);
  if (!invitacion) return { title: "Invitación — Invifty" };
  const datos = invitacion.datos as DatosInvitacion;
  return {
    title: `${datos.titulo} — Invitación`,
    description: datos.subtitulo || "Estás invitado. Abre tu invitación digital.",
    robots: { index: false, follow: false },
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

  // Fotos del pedido con URLs firmadas (frescas en cada visita)
  const admin = crearClienteAdmin();
  const pedidoId = invitacion.pedido_id as string;
  const { data: archivos } = await admin.storage
    .from("fotos-pedidos")
    .list(pedidoId, { limit: 60 });

  const fotos = await Promise.all(
    (archivos ?? [])
      .filter((a) => !a.name.startsWith("video-"))
      .map(async (a) => {
        const { data } = await admin.storage
          .from("fotos-pedidos")
          .createSignedUrl(`${pedidoId}/${a.name}`, 3600);
        return { nombre: a.name, url: data?.signedUrl };
      })
  );

  const datos = invitacion.datos as DatosInvitacion;

  return (
    <>
      {/* Solo se cargan las familias tipográficas que esta invitación usa */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="stylesheet" href={urlFuentes(datos.tipografia)} />

      <Renderizador
        plantilla={invitacion.plantilla as string}
        datos={datos}
        fotos={fotos}
        esBorrador={esBorrador}
      />
    </>
  );
}
