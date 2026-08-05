import { notFound } from "next/navigation";
import type { Metadata, Viewport } from "next";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import Publicada, {
  metadatosDeInvitacion, type InvitacionPublicable,
} from "@/components/invitacion/Publicada";
import { paleta } from "@/config/diseno";
import { hogarDeEnlace } from "@/lib/hogares";
import { urlBase } from "@/lib/url";

export const dynamic = "force-dynamic";

/**
 * Página pública de la invitación: /i/<slug>
 * - Publicada → visible para todo el mundo.
 * - Borrador  → visible SOLO para el equipo con sesión iniciada
 *   (vista previa antes de publicar); el público recibe 404.
 *
 * Quien pagó el extra de dominio propio llega por otra puerta a lo mismo:
 * ver `src/app/d/[host]/page.tsx`. Lo que se dibuja está en `Publicada`.
 */

async function buscarInvitacion(slug: string): Promise<InvitacionPublicable | null> {
  const admin = crearClienteAdmin();
  const { data } = await admin
    .from("invitaciones")
    .select("*, pedidos(id)")
    .eq("slug", slug)
    .single();
  return (data as InvitacionPublicable | null) ?? null;
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
  return { themeColor: paleta(invitacion?.datos?.paleta).fondo };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const invitacion = await buscarInvitacion(slug);
  return metadatosDeInvitacion(invitacion, `${urlBase()}/i/${slug}`);
}

export default async function PaginaInvitacion({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ h?: string }>;
}) {
  const { slug } = await params;
  const { h } = await searchParams;
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

  // ?h=<token>: el enlace personal de un hogar (ver lib/hogares.ts).
  const hogar = await hogarDeEnlace(
    crearClienteAdmin(),
    (invitacion as InvitacionPublicable & { id: string }).id,
    h
  );

  return <Publicada invitacion={invitacion} esBorrador={esBorrador} hogar={hogar} />;
}
