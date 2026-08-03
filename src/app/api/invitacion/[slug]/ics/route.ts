import { NextRequest, NextResponse } from "next/server";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { icsDeInvitacion } from "@/lib/ics";
import { urlBase } from "@/lib/url";
import type { DatosInvitacion } from "@/lib/tipos";

/**
 * EL EVENTO EN FORMATO CALENDARIO — /api/invitacion/<slug>/ics
 * =============================================================
 * Descarga un .ics con la fecha, hora y lugar del evento, que abre
 * cualquier calendario (Apple, Google, Outlook). Lo enlaza el botón
 * "Guardar la fecha" de las plantillas.
 *
 * Vive bajo /api y no bajo /i con toda la intención: /api es lo único que
 * el proxy sirve igual en los dominios propios de los clientes (ver
 * lib/dominios.ts). En /i, el invitado que llega por www.suboda.com no
 * podría bajarse el archivo.
 */

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const admin = crearClienteAdmin();

  const { data: invitacion } = await admin
    .from("invitaciones")
    .select("slug, estado, datos, dominio, actualizado_en")
    .eq("slug", slug)
    .maybeSingle();

  if (!invitacion) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

  // Los borradores, igual que su página: solo el equipo con sesión.
  if (invitacion.estado !== "publicada") {
    const supabase = await crearClienteServidor();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  }

  const datos = (invitacion.datos ?? {}) as DatosInvitacion;
  if (!datos.fechaEvento) {
    return NextResponse.json({ error: "El evento no tiene fecha todavía." }, { status: 409 });
  }

  const lugar = datos.lugares?.[0];
  const url = invitacion.dominio
    ? `https://${invitacion.dominio}`
    : `${urlBase()}/i/${invitacion.slug}`;

  const ics = icsDeInvitacion({
    slug: invitacion.slug,
    titulo: datos.titulo || "Nuestra celebración",
    fecha: datos.fechaEvento,
    hora: datos.horaEvento,
    lugar: [lugar?.nombre, lugar?.detalle].filter(Boolean).join(", "),
    descripcion: [datos.subtitulo, `Invitación: ${url}`].filter(Boolean).join("\n"),
    url,
    actualizadoEn: invitacion.actualizado_en,
  });

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="evento.ics"',
      // La página de la invitación ya es noindex; su archivo también.
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    },
  });
}
