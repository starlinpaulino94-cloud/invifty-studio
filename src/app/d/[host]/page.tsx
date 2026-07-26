import { notFound } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata, Viewport } from "next";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import Publicada, {
  metadatosDeInvitacion, type InvitacionPublicable,
} from "@/components/invitacion/Publicada";
import { paleta } from "@/config/diseno";
import { normalizarDominio } from "@/lib/dominios";

export const dynamic = "force-dynamic";

/**
 * LA INVITACIÓN EN EL DOMINIO DEL CLIENTE
 * ========================================
 * Aquí llegan las peticiones que entraron por un dominio que no es el
 * nuestro: el proxy (src/proxy.ts) las reescribe a /d/<dominio>.
 *
 * A esta ruta no se entra escribiéndola a mano — quien lo intente por el
 * dominio del Studio verá un 404, porque nadie tiene ese dominio.
 *
 * SOLO SE SIRVEN INVITACIONES PUBLICADAS. En el dominio del cliente no hay
 * sesión del equipo, así que un borrador aquí es un 404 sin excepciones.
 */

async function buscarPorDominio(dominio: string): Promise<InvitacionPublicable | null> {
  if (!dominio) return null;
  const admin = crearClienteAdmin();
  const { data } = await admin
    .from("invitaciones")
    .select("*, pedidos(id)")
    .eq("dominio", dominio)
    .eq("estado", "publicada")
    .maybeSingle();
  return (data as InvitacionPublicable | null) ?? null;
}

/**
 * El Host llega tal cual lo mandó el navegador; se guarda normalizado.
 *
 * Se comprueba además que la petición venga DE VERDAD por ese dominio. Sin
 * esto, /d/bodacamila.com escrito a mano en la dirección del Studio sería
 * una segunda puerta pública a la misma invitación.
 */
async function resolver(params: Promise<{ host: string }>) {
  const { host } = await params;
  const pedido = normalizarDominio(decodeURIComponent(host));
  const real = normalizarDominio((await headers()).get("host") ?? "");
  if (!pedido || pedido !== real) return null;
  return buscarPorDominio(pedido);
}

export async function generateViewport({
  params,
}: {
  params: Promise<{ host: string }>;
}): Promise<Viewport> {
  const invitacion = await resolver(params);
  return { themeColor: paleta(invitacion?.datos?.paleta).fondo };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ host: string }>;
}): Promise<Metadata> {
  const { host } = await params;
  const invitacion = await resolver(params);
  const dominio = normalizarDominio(decodeURIComponent(host));
  return metadatosDeInvitacion(invitacion, `https://${dominio}`);
}

export default async function PaginaDominioPropio({
  params,
}: {
  params: Promise<{ host: string }>;
}) {
  const invitacion = await resolver(params);
  if (!invitacion) notFound();

  return <Publicada invitacion={invitacion} esBorrador={false} />;
}
