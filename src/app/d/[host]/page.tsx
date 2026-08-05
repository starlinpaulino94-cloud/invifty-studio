import { notFound } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata, Viewport } from "next";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import Publicada, {
  metadatosDeInvitacion, type InvitacionPublicable,
} from "@/components/invitacion/Publicada";
import { paleta } from "@/config/diseno";
import { normalizarDominio } from "@/lib/dominios";
import { hogarDeEnlace } from "@/lib/hogares";

export const dynamic = "force-dynamic";

/**
 * LA INVITACIÓN EN EL DOMINIO DEL CLIENTE
 * ========================================
 * Aquí llegan las peticiones que entraron por un dominio que no es el
 * nuestro: el proxy (src/proxy.ts) las reescribe a /d/<dominio>.
 *
 * A esta ruta no se entra escribiéndola a mano — quien lo intente por el
 * dominio del Studio verá un 404, porque el Host real no coincide.
 *
 * Un dominio que llega de verdad pero no tiene invitación NO da un 404
 * mudo: enseña una página que dice qué falta (conectar el dominio en el
 * editor, o NEXT_PUBLIC_APP_URL si el dominio es del propio Studio).
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
  searchParams,
}: {
  params: Promise<{ host: string }>;
  searchParams: Promise<{ h?: string }>;
}) {
  const { host } = await params;
  const pedido = normalizarDominio(decodeURIComponent(host));
  const real = normalizarDominio((await headers()).get("host") ?? "");

  // /d/loquesea escrito a mano en el dominio del Studio: 404 sin más.
  if (!pedido || pedido !== real) notFound();

  const invitacion = await buscarPorDominio(pedido);
  if (invitacion) {
    // El enlace personal (?h=) funciona igual en el dominio propio.
    const { h } = await searchParams;
    const hogar = await hogarDeEnlace(
      crearClienteAdmin(),
      (invitacion as InvitacionPublicable & { id: string }).id,
      h
    );
    return <Publicada invitacion={invitacion} esBorrador={false} hogar={hogar} />;
  }

  /**
   * El dominio llegó de verdad hasta aquí (DNS y Vercel ya funcionan) pero
   * ninguna invitación publicada lo tiene. Un 404 mudo aquí es una tarde
   * de depuración; esta página dice qué falta y a quién le toca:
   *  - dominio de un cliente → conectarlo en el editor o publicar;
   *  - dominio del propio Studio → NEXT_PUBLIC_APP_URL sin actualizar,
   *    que fue exactamente lo que pasó con studio.invifty.com.
   */
  return (
    <div className="min-h-dvh bg-[#0D0D0F] flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <p className="text-[10px] uppercase tracking-[0.4em] text-[#D4AF37] font-semibold mb-4">
          Invifty
        </p>
        <h1 className="font-serif text-2xl text-white mb-3">
          Este dominio aún no está conectado
        </h1>
        <p className="text-white/50 text-sm leading-relaxed">
          <span className="text-white/80">{pedido}</span> llega hasta aquí, pero
          no hay ninguna invitación publicada que lo tenga asignado.
        </p>
        <p className="text-white/30 text-xs leading-relaxed mt-6">
          ¿Es la invitación de un cliente? Asigna el dominio en el editor y
          publícala. ¿Es el dominio del propio Studio? Entonces falta poner
          NEXT_PUBLIC_APP_URL con esta dirección y volver a desplegar.
        </p>
      </div>
    </div>
  );
}
