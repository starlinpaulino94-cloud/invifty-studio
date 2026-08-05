import { NextRequest, NextResponse } from "next/server";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { limitarCompartido, ipDePeticion } from "@/lib/limite";
import { puedeDecidir, seccionValida, type RevisionVigencia } from "@/lib/revision";
import { encolarAvisoEquipo } from "@/lib/avisos";
import { registrarError } from "@/lib/registro";
import { urlBase } from "@/lib/url";
import type { DatosInvitacion } from "@/lib/tipos";

/**
 * COMENTARIO DEL CLIENTE — POST /api/revision/<token>/comentario
 * ===============================================================
 * Sin sesión: el token ES la autorización, igual que el formulario /f.
 * El servidor valida que la revisión siga viva (ni revocada, ni caducada,
 * ni ya decidida), que la sección exista en el catálogo y que el texto
 * tenga un tamaño humano. El equipo se entera por la bandeja de avisos.
 */

const MAX_TEXTO = 1000;
const MAX_COMENTARIOS = 100;
const FRENO = { max: 30, ventanaS: 10 * 60 };

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const freno = await limitarCompartido(
    crearClienteAdmin(),
    `revision:${ipDePeticion(req.headers)}`,
    FRENO
  );
  if (!freno.ok) {
    return NextResponse.json(
      { error: "Demasiados envíos seguidos. Espera un momento." },
      { status: 429, headers: { "Retry-After": String(freno.esperaS) } }
    );
  }

  const body = await req.json().catch(() => null);
  const seccion = String(body?.seccion ?? "general");
  const texto = String(body?.texto ?? "").trim().slice(0, MAX_TEXTO);

  if (!seccionValida(seccion)) {
    return NextResponse.json({ error: "Sección desconocida" }, { status: 400 });
  }
  if (texto.length < 2) {
    return NextResponse.json({ error: "Escribe el comentario." }, { status: 400 });
  }

  const supabase = crearClienteAdmin();
  const { data: revision } = await supabase
    .from("revisiones")
    .select("id, estado, expira_en, revocada_en, invitacion_id, versiones(datos)")
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

  // Tope por revisión: nadie escribe cien comentarios de buena fe.
  const { count } = await supabase
    .from("comentarios")
    .select("id", { count: "exact", head: true })
    .eq("revision_id", revision.id);
  if ((count ?? 0) >= MAX_COMENTARIOS) {
    return NextResponse.json(
      { error: "Esta revisión alcanzó el máximo de comentarios." },
      { status: 429 }
    );
  }

  const { error } = await supabase.from("comentarios").insert({
    revision_id: revision.id,
    seccion,
    texto,
    autor: "cliente",
  });
  if (error) {
    registrarError("revision", error, { codigo: error.code, paso: "comentar" });
    return NextResponse.json({ error: "No se pudo guardar el comentario." }, { status: 500 });
  }

  const datos = (revision.versiones as unknown as { datos: DatosInvitacion } | null)?.datos;
  await encolarAvisoEquipo(
    supabase,
    "comentario_nuevo",
    {
      nombre: datos?.titulo || "Un cliente",
      detalle: seccion,
      rutaPanel: `/panel/invitaciones/${revision.invitacion_id}`,
      urlBase: urlBase(),
    },
    { tipo: "revision", id: revision.id }
  );

  return NextResponse.json({ ok: true });
}
