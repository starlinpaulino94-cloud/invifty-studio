import { NextRequest, NextResponse } from "next/server";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { limitar, ipDePeticion } from "@/lib/limite";
import { normalizarNombre } from "@/lib/nombres";

/**
 * CONFIRMACIÓN DE ASISTENCIA (RSVP)
 * ==================================
 * Ruta pública que usan los invitados desde la invitación publicada.
 * Antes la confirmación solo abría WhatsApp: si el invitado no llegaba a
 * pulsar "enviar", se perdía. Ahora queda guardada aquí primero y el
 * mensaje de WhatsApp sigue saliendo como aviso inmediato al anfitrión.
 *
 * Es un endpoint sin sesión, así que valida en el servidor:
 *  - que la invitación exista y esté PUBLICADA (los borradores no cuentan);
 *  - que la sección de confirmación esté activa;
 *  - el contenido y el tamaño de cada campo;
 *  - un tope de confirmaciones por invitación, como freno a abusos.
 */

const MAX_NOMBRE = 80;
const MAX_NOTA = 500;
const MAX_ACOMPANANTES = 20;
/** Ninguna celebración real pasa de aquí; frena el llenado automatizado. */
const MAX_CONFIRMACIONES = 1500;

/**
 * Una familia entera confirmando desde el mismo wifi son unas pocas
 * confirmaciones seguidas; veinte en diez minutos ya no es una familia.
 * El tope de 1500 de más abajo protege la tabla; esto protege el rato.
 */
const FRENO = { max: 20, ventanaMs: 10 * 60 * 1000 };

/**
 * `normalizarNombre` vive en lib/nombres.ts porque lo comparte con el panel
 * del anfitrion, que cruza estas confirmaciones con su lista de invitados.
 * Si cada lado normalizara a su manera, alguien confirmaria y seguiria
 * apareciendo como "sin responder".
 */

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const freno = limitar(`rsvp:${ipDePeticion(req.headers)}`, FRENO);
  if (!freno.ok) {
    return NextResponse.json(
      { error: "Demasiadas confirmaciones seguidas. Espera un momento." },
      { status: 429, headers: { "Retry-After": String(freno.esperaS) } }
    );
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  // ---------- Validación de campos ----------
  const nombre = String(body.nombre ?? "").trim().slice(0, MAX_NOMBRE);
  if (nombre.length < 2) {
    return NextResponse.json({ error: "Escribe tu nombre completo." }, { status: 400 });
  }

  const asiste = body.asiste === true;
  const nota = String(body.nota ?? "").trim().slice(0, MAX_NOTA) || null;

  // Solo cuenta gente si asiste; así la suma de la columna es el total real.
  let cantidad = 0;
  if (asiste) {
    const bruta = Number(body.cantidad);
    cantidad = Number.isFinite(bruta) ? Math.floor(bruta) : 1;
    cantidad = Math.min(Math.max(cantidad, 1), MAX_ACOMPANANTES);
  }

  const supabase = crearClienteAdmin();

  // ---------- La invitación tiene que aceptar confirmaciones ----------
  const { data: invitacion } = await supabase
    .from("invitaciones")
    .select("id, estado, datos")
    .eq("slug", slug)
    .single();

  if (!invitacion || invitacion.estado !== "publicada") {
    return NextResponse.json({ error: "Invitación no disponible" }, { status: 404 });
  }

  const secciones = (invitacion.datos as { secciones?: { rsvp?: boolean } })?.secciones;
  if (secciones?.rsvp === false) {
    return NextResponse.json(
      { error: "Esta invitación no está recibiendo confirmaciones." },
      { status: 409 }
    );
  }

  const nombreNormalizado = normalizarNombre(nombre);

  // ---------- Guardar (o corregir una respuesta anterior) ----------
  const { data: previa } = await supabase
    .from("confirmaciones")
    .select("id")
    .eq("invitacion_id", invitacion.id)
    .eq("nombre_normalizado", nombreNormalizado)
    .maybeSingle();

  if (previa) {
    const { error } = await supabase
      .from("confirmaciones")
      .update({ nombre, asiste, cantidad, nota })
      .eq("id", previa.id);
    if (error) {
      return NextResponse.json({ error: "No se pudo guardar tu confirmación." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, actualizada: true });
  }

  const { count } = await supabase
    .from("confirmaciones")
    .select("id", { count: "exact", head: true })
    .eq("invitacion_id", invitacion.id);

  if ((count ?? 0) >= MAX_CONFIRMACIONES) {
    return NextResponse.json(
      { error: "Esta invitación alcanzó el máximo de confirmaciones." },
      { status: 429 }
    );
  }

  const { error } = await supabase.from("confirmaciones").insert({
    invitacion_id: invitacion.id,
    nombre,
    nombre_normalizado: nombreNormalizado,
    asiste,
    cantidad,
    nota,
  });

  if (error) {
    // Dos envíos simultáneos del mismo invitado chocan con el índice único:
    // no es un fallo real, su confirmación ya quedó registrada.
    if (error.code === "23505") return NextResponse.json({ ok: true, actualizada: true });
    return NextResponse.json({ error: "No se pudo guardar tu confirmación." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
