import { NextRequest, NextResponse } from "next/server";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { limitar } from "@/lib/limite";
import { normalizarNombre } from "@/lib/nombres";
import { leerNombresPegados } from "@/lib/lista";
import { registrarError } from "@/lib/registro";

/**
 * LA LISTA DE INVITADOS DEL ANFITRIÓN
 * ====================================
 * La usa el panel /lista/<token>. Autenticada por ese token secreto y nada
 * más: el anfitrión no tiene cuenta en el sistema, igual que el cliente que
 * rellena el formulario en /f/<token>.
 *
 * El anfitrión NUNCA habla con Supabase directamente: pasa por aquí, y aquí
 * se usa la clave de servicio. Por eso cada ruta comprueba el token por su
 * cuenta antes de tocar nada.
 */

/** Ninguna boda de verdad pasa de aquí, y frena el llenado automatizado. */
const MAX_INVITADOS = 1000;

/** Pegar una lista entera es una petición, no mil. Con esto sobra. */
const FRENO = { max: 60, ventanaMs: 10 * 60 * 1000 };

/** Devuelve la invitación dueña de ese token, o null. */
async function invitacionDelToken(token: string) {
  const supabase = crearClienteAdmin();
  const { data } = await supabase
    .from("invitaciones")
    .select("id")
    .eq("token_lista", token)
    .maybeSingle();
  return data;
}

/* ---------- Añadir nombres ---------- */

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const freno = limitar(`lista:${token}`, FRENO);
  if (!freno.ok) {
    return NextResponse.json(
      { error: "Demasiados cambios seguidos. Espera un momento." },
      { status: 429, headers: { "Retry-After": String(freno.esperaS) } }
    );
  }

  const invitacion = await invitacionDelToken(token);
  if (!invitacion) {
    return NextResponse.json({ error: "Lista no encontrada" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body.texto !== "string") {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const nombres = leerNombresPegados(body.texto, MAX_INVITADOS);
  if (nombres.length === 0) {
    return NextResponse.json({ error: "No se leyó ningún nombre." }, { status: 400 });
  }

  const supabase = crearClienteAdmin();

  const { count } = await supabase
    .from("invitados")
    .select("id", { count: "exact", head: true })
    .eq("invitacion_id", invitacion.id);

  if ((count ?? 0) + nombres.length > MAX_INVITADOS) {
    return NextResponse.json(
      { error: `La lista no puede pasar de ${MAX_INVITADOS} invitados.` },
      { status: 409 }
    );
  }

  // `ignoreDuplicates` para que pegar la lista dos veces no dé error ni
  // duplique: el índice único (invitacion_id, nombre_normalizado) manda.
  const { error } = await supabase.from("invitados").upsert(
    nombres.map((nombre) => ({
      invitacion_id: invitacion.id,
      nombre,
      nombre_normalizado: normalizarNombre(nombre),
    })),
    { onConflict: "invitacion_id,nombre_normalizado", ignoreDuplicates: true }
  );

  if (error) {
    registrarError("lista-invitados", error, { codigo: error.code, paso: "guardar" });
    return NextResponse.json({ error: "No se pudo guardar la lista." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, anadidos: nombres.length });
}

/* ---------- Quitar un nombre ---------- */

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const freno = limitar(`lista:${token}`, FRENO);
  if (!freno.ok) {
    return NextResponse.json(
      { error: "Demasiados cambios seguidos. Espera un momento." },
      { status: 429, headers: { "Retry-After": String(freno.esperaS) } }
    );
  }

  const invitacion = await invitacionDelToken(token);
  if (!invitacion) {
    return NextResponse.json({ error: "Lista no encontrada" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body.id !== "string") {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const supabase = crearClienteAdmin();
  // El filtro por invitacion_id no sobra: sin él, quien tuviera un token
  // válido podría borrar invitados de OTRA boda pasando su id.
  const { error } = await supabase
    .from("invitados")
    .delete()
    .eq("id", body.id)
    .eq("invitacion_id", invitacion.id);

  if (error) {
    registrarError("lista-invitados", error, { codigo: error.code, paso: "quitar" });
    return NextResponse.json({ error: "No se pudo quitar el nombre." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
