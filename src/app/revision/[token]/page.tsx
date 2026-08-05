import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import Publicada, { type InvitacionPublicable } from "@/components/invitacion/Publicada";
import BarraRevision, { type ComentarioCliente } from "@/components/revision/BarraRevision";
import { estadoDeRevision, type RevisionVigencia } from "@/lib/revision";
import type { DatosInvitacion } from "@/lib/tipos";

/**
 * LA REVISIÓN DEL CLIENTE — /revision/<token>
 * ============================================
 * El cliente ve EXACTAMENTE la versión que el equipo congeló (tabla
 * `versiones`), no el borrador vivo del editor: si el equipo sigue
 * tocando, lo que el cliente aprueba no se mueve debajo de sus pies.
 *
 * Se dibuja con la misma `Publicada` de siempre en modo borrador, así que
 * lo que revisa es lo que sus invitados verían — y sin efectos
 * secundarios: en borrador no se cuentan visitas ni se guardan RSVP de
 * prueba. Encima flota la barra de revisión: comentar por sección,
 * pedir cambios o aprobar con su nombre.
 *
 * Un token revocado, caducado o inexistente es un 404 sin explicaciones:
 * a quien anda probando enlaces no se le confirma nada.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Revisa tu invitación — Invifty",
  robots: { index: false, follow: false, noarchive: true },
};

export default async function PaginaRevision({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = crearClienteAdmin();

  const { data: revisionData } = await supabase
    .from("revisiones")
    .select(
      "id, estado, expira_en, revocada_en, aprobada_en, aprobada_por, invitacion_id, " +
        "versiones(numero, plantilla, datos, codigo_html), " +
        "invitaciones(slug, pedido_id)"
    )
    .eq("token", token)
    .maybeSingle();
  if (!revisionData) notFound();

  const revision = revisionData as unknown as RevisionVigencia & {
    id: string;
    aprobada_en: string | null;
    aprobada_por: string | null;
    invitacion_id: string;
    versiones: {
      numero: number;
      plantilla: string;
      datos: DatosInvitacion;
      codigo_html: string | null;
    } | null;
    invitaciones: { slug: string; pedido_id: string } | null;
  };

  const estado = estadoDeRevision(revision, new Date());
  if (estado === "revocada" || estado === "expirada") notFound();

  const version = revision.versiones;
  const invitacion = revision.invitaciones;
  if (!version || !invitacion) notFound();

  // Lo que el propio cliente ya comentó, para que no lo repita.
  const { data: comentarios } = await supabase
    .from("comentarios")
    .select("seccion, texto, estado, creado_en")
    .eq("revision_id", revision.id)
    .eq("autor", "cliente")
    .order("creado_en");

  const instantanea: InvitacionPublicable = {
    slug: invitacion.slug,
    estado: "borrador",
    plantilla: version.plantilla,
    datos: version.datos,
    codigo_html: version.codigo_html,
    pedido_id: invitacion.pedido_id,
  };

  return (
    <>
      {/* Hueco para que la barra fija no tape el final de la invitación */}
      <div className="pb-24">
        <Publicada invitacion={instantanea} esBorrador />
      </div>
      <BarraRevision
        token={token}
        numeroVersion={version.numero}
        estado={estado}
        expiraEn={revision.expira_en}
        aprobadaPor={revision.aprobada_por}
        aprobadaEn={revision.aprobada_en}
        comentariosPrevios={(comentarios ?? []) as ComentarioCliente[]}
      />
    </>
  );
}
