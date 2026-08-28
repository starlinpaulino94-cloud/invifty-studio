import { NextRequest, NextResponse } from "next/server";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { limitar } from "@/lib/limite";
import { sanearCuentasRegalo } from "@/lib/regalos";

/**
 * LA MESA DE REGALOS DEL ANFITRIÓN — /api/lista/<token>/regalos
 * ==============================================================
 * Con su token secreto: guardar SUS cuentas bancarias (saneadas), ver
 * la lista completa de agradecimientos (montos incluidos: son suyos) y
 * ocultar o borrar un aporte. La pertenencia se exige en cada
 * escritura.
 */

const FRENO = { max: 60, ventanaMs: 10 * 60 * 1000 };

async function invitacionDelToken(token: string) {
  const supabase = crearClienteAdmin();
  const { data } = await supabase
    .from("invitaciones")
    .select("id, cuentas_regalo")
    .eq("token_lista", token)
    .maybeSingle();
  return data;
}

function frenar(token: string) {
  const freno = limitar(`regalos-anfitrion:${token}`, FRENO);
  if (freno.ok) return null;
  return NextResponse.json(
    { error: "Demasiadas acciones seguidas. Espera un momento." },
    { status: 429, headers: { "Retry-After": String(freno.esperaS) } }
  );
}

/* ---------- La lista de agradecimientos y las cuentas ---------- */

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const frenada = frenar(token);
  if (frenada) return frenada;

  const invitacion = await invitacionDelToken(token);
  if (!invitacion) return NextResponse.json({ error: "Lista no encontrada" }, { status: 404 });

  const supabase = crearClienteAdmin();
  const { data: aportes } = await supabase
    .from("aportes")
    .select("id, nombre, monto, mensaje, estado, creado_en")
    .eq("invitacion_id", invitacion.id)
    .order("creado_en", { ascending: false })
    .limit(500);

  return NextResponse.json({
    cuentas: sanearCuentasRegalo(invitacion.cuentas_regalo),
    aportes: aportes ?? [],
  });
}

/* ---------- Guardar cuentas u ocultar/mostrar un aporte ---------- */

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const frenada = frenar(token);
  if (frenada) return frenada;

  const invitacion = await invitacionDelToken(token);
  if (!invitacion) return NextResponse.json({ error: "Lista no encontrada" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const supabase = crearClienteAdmin();

  // Las cuentas del anfitrión, SIEMPRE saneadas antes de guardar.
  if (body?.cuentas !== undefined) {
    const cuentas = sanearCuentasRegalo(body.cuentas);
    const { error } = await supabase
      .from("invitaciones")
      .update({ cuentas_regalo: cuentas })
      .eq("id", invitacion.id);
    if (error) return NextResponse.json({ error: "No se pudieron guardar las cuentas." }, { status: 500 });
    return NextResponse.json({ ok: true, cuentas });
  }

  // Ocultar o volver a mostrar un aporte de SU invitación.
  const aporteId = typeof body?.aporteId === "string" ? body.aporteId : null;
  const estado = body?.estado === "oculta" || body?.estado === "visible" ? body.estado : null;
  if (!aporteId || !estado) {
    return NextResponse.json({ error: "Falta qué cambiar." }, { status: 400 });
  }

  const { data: filas, error } = await supabase
    .from("aportes")
    .update({ estado })
    .eq("id", aporteId)
    .eq("invitacion_id", invitacion.id)
    .select("id");
  if (error) return NextResponse.json({ error: "No se pudo guardar." }, { status: 500 });
  if (!filas?.length) return NextResponse.json({ error: "Ese aporte no existe." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

/* ---------- Borrar un aporte ---------- */

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const frenada = frenar(token);
  if (frenada) return frenada;

  const invitacion = await invitacionDelToken(token);
  if (!invitacion) return NextResponse.json({ error: "Lista no encontrada" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const aporteId = typeof body?.aporteId === "string" ? body.aporteId : null;
  if (!aporteId) return NextResponse.json({ error: "Falta el aporte." }, { status: 400 });

  const supabase = crearClienteAdmin();
  const { data: filas, error } = await supabase
    .from("aportes")
    .delete()
    .eq("id", aporteId)
    .eq("invitacion_id", invitacion.id)
    .select("id");
  if (error) return NextResponse.json({ error: "No se pudo eliminar." }, { status: 500 });
  if (!filas?.length) return NextResponse.json({ error: "Ese aporte no existe." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
