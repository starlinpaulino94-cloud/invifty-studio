import { NextRequest, NextResponse } from "next/server";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { limitar } from "@/lib/limite";
import { capacidadValida, nombreMesaValido, MAX_MESAS } from "@/lib/mesas";

/**
 * LAS MESAS DEL ANFITRIÓN — /api/lista/<token>/mesas
 * ===================================================
 * Crear mesas, asignarles hogares (completos: las familias se sientan
 * juntas) y borrarlas. Autenticado por el token secreto de la lista, y
 * la pertenencia se exige en CADA escritura: una mesa o un hogar de
 * otra invitación no se toca ni sabiendo su id.
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

function frenar(token: string) {
  const freno = limitar(`mesas:${token}`, FRENO);
  if (freno.ok) return null;
  return NextResponse.json(
    { error: "Demasiadas acciones seguidas. Espera un momento." },
    { status: 429, headers: { "Retry-After": String(freno.esperaS) } }
  );
}

/* ---------- Crear una mesa ---------- */

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const frenada = frenar(token);
  if (frenada) return frenada;

  const invitacion = await invitacionDelToken(token);
  if (!invitacion) return NextResponse.json({ error: "Lista no encontrada" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const nombre = String(body?.nombre ?? "").trim().slice(0, 40);
  const capacidad = Number(body?.capacidad ?? 10);
  if (!nombreMesaValido(nombre)) {
    return NextResponse.json({ error: "Ponle un nombre a la mesa (hasta 40 letras)." }, { status: 400 });
  }
  if (!capacidadValida(capacidad)) {
    return NextResponse.json({ error: "La capacidad debe ser un número entre 1 y 100." }, { status: 400 });
  }

  const supabase = crearClienteAdmin();
  const { count } = await supabase
    .from("mesas")
    .select("id", { count: "exact", head: true })
    .eq("invitacion_id", invitacion.id);
  if ((count ?? 0) >= MAX_MESAS) {
    return NextResponse.json({ error: `El plano llegó al máximo de ${MAX_MESAS} mesas.` }, { status: 400 });
  }

  const { data: mesa, error } = await supabase
    .from("mesas")
    .insert({ invitacion_id: invitacion.id, nombre, capacidad })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: "No se pudo crear la mesa." }, { status: 500 });

  return NextResponse.json({ ok: true, id: mesa.id });
}

/* ---------- Editar una mesa o asignar un hogar ---------- */

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

  // Asignar (o quitar) la mesa de un hogar. Si viene una mesa, tiene que
  // ser de ESTA invitación — sin eso, un id ajeno colaría un hogar en la
  // boda de otro.
  if (typeof body?.hogarId === "string") {
    const mesaId = typeof body?.mesaId === "string" && body.mesaId ? body.mesaId : null;
    if (mesaId) {
      const { data: mesa } = await supabase
        .from("mesas")
        .select("id")
        .eq("id", mesaId)
        .eq("invitacion_id", invitacion.id)
        .maybeSingle();
      if (!mesa) return NextResponse.json({ error: "Esa mesa no existe." }, { status: 404 });
    }
    const { data: filas, error } = await supabase
      .from("hogares")
      .update({ mesa_id: mesaId })
      .eq("id", body.hogarId)
      .eq("invitacion_id", invitacion.id)
      .select("id");
    if (error) return NextResponse.json({ error: "No se pudo asignar." }, { status: 500 });
    if (!filas?.length) return NextResponse.json({ error: "Ese hogar no existe." }, { status: 404 });
    return NextResponse.json({ ok: true });
  }

  // Renombrar o cambiar la capacidad de una mesa.
  const mesaId = typeof body?.mesaId === "string" ? body.mesaId : null;
  if (!mesaId) return NextResponse.json({ error: "Falta qué cambiar." }, { status: 400 });
  const cambios: Record<string, unknown> = {};
  if (body?.nombre !== undefined) {
    const nombre = String(body.nombre).trim().slice(0, 40);
    if (!nombreMesaValido(nombre)) {
      return NextResponse.json({ error: "Ponle un nombre a la mesa." }, { status: 400 });
    }
    cambios.nombre = nombre;
  }
  if (body?.capacidad !== undefined) {
    const capacidad = Number(body.capacidad);
    if (!capacidadValida(capacidad)) {
      return NextResponse.json({ error: "La capacidad debe ser un número entre 1 y 100." }, { status: 400 });
    }
    cambios.capacidad = capacidad;
  }
  if (!Object.keys(cambios).length) {
    return NextResponse.json({ error: "Falta qué cambiar." }, { status: 400 });
  }

  const { data: filas, error } = await supabase
    .from("mesas")
    .update(cambios)
    .eq("id", mesaId)
    .eq("invitacion_id", invitacion.id)
    .select("id");
  if (error) return NextResponse.json({ error: "No se pudo guardar." }, { status: 500 });
  if (!filas?.length) return NextResponse.json({ error: "Esa mesa no existe." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

/* ---------- Borrar una mesa (sus hogares quedan sin mesa) ---------- */

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
  const mesaId = typeof body?.mesaId === "string" ? body.mesaId : null;
  if (!mesaId) return NextResponse.json({ error: "Falta la mesa." }, { status: 400 });

  const supabase = crearClienteAdmin();
  const { data: filas, error } = await supabase
    .from("mesas")
    .delete()
    .eq("id", mesaId)
    .eq("invitacion_id", invitacion.id)
    .select("id");
  if (error) return NextResponse.json({ error: "No se pudo eliminar." }, { status: 500 });
  if (!filas?.length) return NextResponse.json({ error: "Esa mesa no existe." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
