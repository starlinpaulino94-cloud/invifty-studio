import { NextRequest, NextResponse } from "next/server";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { limitar, ipDePeticion } from "@/lib/limite";
import { puedeDecidir, type RevisionVigencia } from "@/lib/revision";
import { encolarAvisoEquipo } from "@/lib/avisos";
import { registrarError } from "@/lib/registro";
import { urlBase } from "@/lib/url";
import type { DatosInvitacion } from "@/lib/tipos";

/**
 * LA DECISIÓN DEL CLIENTE — POST /api/revision/<token>/decidir
 * =============================================================
 * Una revisión se decide UNA vez: aprobar o pedir cambios.
 *
 * APROBAR es la que pesa. Queda la evidencia completa —quién (el nombre
 * que firma), cuándo, y sobre QUÉ versión exacta— y la invitación se
 * bloquea contra ediciones accidentales: a partir de aquí, editar exige
 * desbloquear a propósito desde el panel, con firma en auditoría. Lo que
 * NO hace es publicar: publicar sigue siendo un acto del equipo.
 *
 * PEDIR CAMBIOS cierra la ronda y avisa al equipo; el comentario que la
 * acompaña (opcional) se guarda como un comentario general más.
 */

const FRENO = { max: 15, ventanaMs: 10 * 60 * 1000 };

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const freno = limitar(`revision:${ipDePeticion(req.headers)}`, FRENO);
  if (!freno.ok) {
    return NextResponse.json(
      { error: "Demasiados envíos seguidos. Espera un momento." },
      { status: 429, headers: { "Retry-After": String(freno.esperaS) } }
    );
  }

  const body = await req.json().catch(() => null);
  const decision = String(body?.decision ?? "");
  if (decision !== "aprobar" && decision !== "cambios") {
    return NextResponse.json({ error: "Decisión desconocida" }, { status: 400 });
  }

  const supabase = crearClienteAdmin();
  const { data: revision } = await supabase
    .from("revisiones")
    .select(
      "id, estado, expira_en, revocada_en, invitacion_id, versiones(numero, datos)"
    )
    .eq("token", token)
    .maybeSingle();

  if (!revision) {
    return NextResponse.json({ error: "Enlace no disponible" }, { status: 404 });
  }
  if (!puedeDecidir(revision as unknown as RevisionVigencia, new Date())) {
    return NextResponse.json(
      { error: "Esta revisión ya se cerró. Pide al equipo un enlace nuevo." },
      { status: 409 }
    );
  }

  const version = revision.versiones as unknown as {
    numero: number;
    datos: DatosInvitacion;
  } | null;
  const titulo = version?.datos?.titulo || "Un cliente";
  const rutaPanel = `/panel/invitaciones/${revision.invitacion_id}`;
  const ahora = new Date().toISOString();

  if (decision === "aprobar") {
    const nombre = String(body?.nombre ?? "").trim().slice(0, 80);
    if (nombre.length < 2) {
      return NextResponse.json(
        { error: "Escribe tu nombre para firmar la aprobación." },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("revisiones")
      .update({ estado: "aprobada", aprobada_en: ahora, aprobada_por: nombre })
      .eq("id", revision.id)
      .eq("estado", "abierta");
    if (error) {
      registrarError("revision", error, { codigo: error.code, paso: "aprobar" });
      return NextResponse.json({ error: "No se pudo registrar la aprobación." }, { status: 500 });
    }

    // El candado: lo aprobado no se edita por descuido.
    await supabase
      .from("invitaciones")
      .update({ bloqueada_en: ahora })
      .eq("id", revision.invitacion_id);

    // Rastro en auditoría, firmado como acto del cliente (sin usuario del
    // equipo): la evidencia dura aunque la revisión se borre algún día.
    const { error: errorAuditoria } = await supabase.from("auditoria").insert({
      accion: "revision:aprobar",
      entidad: "invitacion",
      entidad_id: revision.invitacion_id,
      detalles: { version: version?.numero ?? null, aprobada_por: nombre },
    });
    if (errorAuditoria) {
      registrarError("revision", errorAuditoria, { paso: "auditoria" });
    }

    await encolarAvisoEquipo(
      supabase,
      "revision_aprobada",
      {
        nombre: titulo,
        detalle: `versión ${version?.numero ?? "?"}, firmada por ${nombre}`,
        rutaPanel,
        urlBase: urlBase(),
      },
      { tipo: "revision", id: revision.id }
    );

    return NextResponse.json({ ok: true, decision: "aprobada" });
  }

  // ---------- Pedir cambios ----------
  const comentario = String(body?.comentario ?? "").trim().slice(0, 1000);

  const { error } = await supabase
    .from("revisiones")
    .update({ estado: "cambios_solicitados" })
    .eq("id", revision.id)
    .eq("estado", "abierta");
  if (error) {
    registrarError("revision", error, { codigo: error.code, paso: "cambios" });
    return NextResponse.json({ error: "No se pudo registrar la solicitud." }, { status: 500 });
  }

  if (comentario.length >= 2) {
    await supabase.from("comentarios").insert({
      revision_id: revision.id,
      seccion: "general",
      texto: comentario,
      autor: "cliente",
    });
  }

  await encolarAvisoEquipo(
    supabase,
    "revision_cambios",
    {
      nombre: titulo,
      detalle: comentario.slice(0, 80) || undefined,
      rutaPanel,
      urlBase: urlBase(),
    },
    { tipo: "revision", id: revision.id }
  );

  return NextResponse.json({ ok: true, decision: "cambios_solicitados" });
}
