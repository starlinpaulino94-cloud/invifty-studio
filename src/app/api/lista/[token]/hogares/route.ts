import { NextRequest, NextResponse } from "next/server";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { limitar } from "@/lib/limite";
import { tokenOpaco } from "@/lib/revision";
import { registrarError } from "@/lib/registro";

/**
 * LOS HOGARES DEL ANFITRIÓN — /api/lista/<token>/hogares
 * =======================================================
 * "Familia Pérez, hasta 4" en vez de cuatro nombres sueltos: así invita
 * la gente de verdad. Cada hogar nace con su TOKEN OPACO, que es lo que
 * viaja en el enlace personal (/i/<slug>?h=<token>) y en el QR de la
 * puerta — nunca un nombre, un teléfono ni una dirección.
 *
 * Misma casa que la lista de invitados: autenticado por el token secreto
 * del panel del anfitrión, y Supabase solo se toca desde aquí.
 */

const MAX_HOGARES = 500;
const FRENO = { max: 60, ventanaMs: 10 * 60 * 1000 };

async function invitacionDelToken(token: string) {
  const supabase = crearClienteAdmin();
  const { data } = await supabase
    .from("invitaciones")
    .select("id")
    .eq("token_lista", token)
    .maybeSingle();
  return data;
}

function frenar(token: string) {
  const freno = limitar(`lista:${token}`, FRENO);
  if (freno.ok) return null;
  return NextResponse.json(
    { error: "Demasiados cambios seguidos. Espera un momento." },
    { status: 429, headers: { "Retry-After": String(freno.esperaS) } }
  );
}

/* ---------- Crear un hogar ---------- */

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const frenado = frenar(token);
  if (frenado) return frenado;

  const invitacion = await invitacionDelToken(token);
  if (!invitacion) return NextResponse.json({ error: "Lista no encontrada" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const nombre = String(body?.nombre ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
  const cupo = Math.floor(Number(body?.cupo));

  if (nombre.length < 2) {
    return NextResponse.json({ error: "Escribe el nombre del hogar." }, { status: 400 });
  }
  if (!Number.isFinite(cupo) || cupo < 1 || cupo > 20) {
    return NextResponse.json({ error: "El cupo debe estar entre 1 y 20." }, { status: 400 });
  }

  const supabase = crearClienteAdmin();

  const { count } = await supabase
    .from("hogares")
    .select("id", { count: "exact", head: true })
    .eq("invitacion_id", invitacion.id);
  if ((count ?? 0) >= MAX_HOGARES) {
    return NextResponse.json(
      { error: `No se puede pasar de ${MAX_HOGARES} hogares.` },
      { status: 409 }
    );
  }

  const { data: hogar, error } = await supabase
    .from("hogares")
    .insert({ invitacion_id: invitacion.id, nombre, cupo, token: tokenOpaco() })
    .select("id, nombre, cupo, token")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Ya existe un hogar con ese nombre." }, { status: 409 });
    }
    registrarError("hogares", error, { codigo: error.code, paso: "crear" });
    return NextResponse.json({ error: "No se pudo crear el hogar." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, hogar });
}

/* ---------- Cambiar nombre o cupo ---------- */

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const frenado = frenar(token);
  if (frenado) return frenado;

  const invitacion = await invitacionDelToken(token);
  if (!invitacion) return NextResponse.json({ error: "Lista no encontrada" }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body.id !== "string") {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const cambios: Record<string, unknown> = {};
  if (body.nombre !== undefined) {
    const nombre = String(body.nombre).trim().replace(/\s+/g, " ").slice(0, 80);
    if (nombre.length < 2) {
      return NextResponse.json({ error: "El nombre no puede quedar vacío." }, { status: 400 });
    }
    cambios.nombre = nombre;
  }
  if (body.cupo !== undefined) {
    const cupo = Math.floor(Number(body.cupo));
    if (!Number.isFinite(cupo) || cupo < 1 || cupo > 20) {
      return NextResponse.json({ error: "El cupo debe estar entre 1 y 20." }, { status: 400 });
    }
    cambios.cupo = cupo;
  }
  if (Object.keys(cambios).length === 0) {
    return NextResponse.json({ error: "Nada que cambiar" }, { status: 400 });
  }

  const supabase = crearClienteAdmin();
  // El filtro por invitacion_id evita tocar hogares de otra boda.
  const { error } = await supabase
    .from("hogares")
    .update(cambios)
    .eq("id", body.id)
    .eq("invitacion_id", invitacion.id);

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Ya existe un hogar con ese nombre." }, { status: 409 });
    }
    registrarError("hogares", error, { codigo: error.code, paso: "editar" });
    return NextResponse.json({ error: "No se pudo guardar el cambio." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

/* ---------- Quitar un hogar ---------- */

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const frenado = frenar(token);
  if (frenado) return frenado;

  const invitacion = await invitacionDelToken(token);
  if (!invitacion) return NextResponse.json({ error: "Lista no encontrada" }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body.id !== "string") {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const supabase = crearClienteAdmin();
  // Los invitados y confirmaciones del hogar no se borran: su hogar_id
  // queda en null (on delete set null) y siguen contando en la lista.
  const { error } = await supabase
    .from("hogares")
    .delete()
    .eq("id", body.id)
    .eq("invitacion_id", invitacion.id);

  if (error) {
    registrarError("hogares", error, { codigo: error.code, paso: "quitar" });
    return NextResponse.json({ error: "No se pudo quitar el hogar." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
