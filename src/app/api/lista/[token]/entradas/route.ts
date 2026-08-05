import { NextRequest, NextResponse } from "next/server";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { limitar } from "@/lib/limite";
import { personasValidas } from "@/lib/checkin";
import { registrarError } from "@/lib/registro";

/**
 * LA PUERTA — /api/lista/<token>/entradas
 * ========================================
 * Registrar quién va entrando el día del evento, desde el panel del
 * anfitrión (pestaña Recepción). Autenticado por el mismo token secreto:
 * quien está en la puerta es el anfitrión o alguien con su enlace.
 *
 * La puerta REGISTRA, no impide: los avisos de cupo o reingreso los
 * calcula lib/checkin.ts y los decide el humano. Y como es historial, una
 * entrada equivocada se ANULA (queda tachada), nunca se borra.
 */

const FRENO = { max: 120, ventanaMs: 10 * 60 * 1000 };

async function invitacionDelToken(token: string) {
  const supabase = crearClienteAdmin();
  const { data } = await supabase
    .from("invitaciones")
    .select("id")
    .eq("token_lista", token)
    .maybeSingle();
  return data;
}

/* ---------- Registrar una entrada ---------- */

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  // El día del evento las entradas van seguidas: el freno es más ancho
  // que el de editar la lista, pero sigue existiendo.
  const freno = limitar(`entradas:${token}`, FRENO);
  if (!freno.ok) {
    return NextResponse.json(
      { error: "Demasiadas entradas seguidas. Espera un momento." },
      { status: 429, headers: { "Retry-After": String(freno.esperaS) } }
    );
  }

  const invitacion = await invitacionDelToken(token);
  if (!invitacion) return NextResponse.json({ error: "Lista no encontrada" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const nombre = String(body?.nombre ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
  const personas = personasValidas(body?.personas);
  const operador = String(body?.operador ?? "").trim().slice(0, 60) || null;
  const nota = String(body?.nota ?? "").trim().slice(0, 200) || null;
  const hogarId = typeof body?.hogarId === "string" && body.hogarId ? body.hogarId : null;

  if (nombre.length < 2) {
    return NextResponse.json({ error: "¿A quién estás registrando?" }, { status: 400 });
  }

  const supabase = crearClienteAdmin();

  // Si viene con hogar, el hogar tiene que ser de ESTA invitación.
  if (hogarId) {
    const { data: hogar } = await supabase
      .from("hogares")
      .select("id")
      .eq("id", hogarId)
      .eq("invitacion_id", invitacion.id)
      .maybeSingle();
    if (!hogar) {
      return NextResponse.json({ error: "Ese hogar no es de este evento." }, { status: 400 });
    }
  }

  const { data: entrada, error } = await supabase
    .from("entradas")
    .insert({
      invitacion_id: invitacion.id,
      hogar_id: hogarId,
      nombre,
      personas,
      operador,
      nota,
    })
    .select("id, hogar_id, nombre, personas, operador, nota, anulada_en, creado_en")
    .single();

  if (error) {
    registrarError("entradas", error, { codigo: error.code, paso: "registrar" });
    return NextResponse.json({ error: "No se pudo registrar la entrada." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, entrada });
}

/* ---------- Anular una entrada (nunca borrar) ---------- */

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const freno = limitar(`entradas:${token}`, FRENO);
  if (!freno.ok) {
    return NextResponse.json(
      { error: "Demasiados cambios seguidos. Espera un momento." },
      { status: 429, headers: { "Retry-After": String(freno.esperaS) } }
    );
  }

  const invitacion = await invitacionDelToken(token);
  if (!invitacion) return NextResponse.json({ error: "Lista no encontrada" }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body.id !== "string") {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const supabase = crearClienteAdmin();
  const { error } = await supabase
    .from("entradas")
    .update({ anulada_en: new Date().toISOString() })
    .eq("id", body.id)
    .eq("invitacion_id", invitacion.id)
    .is("anulada_en", null);

  if (error) {
    registrarError("entradas", error, { codigo: error.code, paso: "anular" });
    return NextResponse.json({ error: "No se pudo anular la entrada." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
