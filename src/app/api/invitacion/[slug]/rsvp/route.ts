import { NextRequest, NextResponse } from "next/server";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { limitarCompartido, ipDePeticion } from "@/lib/limite";
import { normalizarNombre } from "@/lib/nombres";
import { fechaVencida } from "@/lib/fechas";
import { registrarError } from "@/lib/registro";

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
const FRENO = { max: 20, ventanaS: 10 * 60 };

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

  // Compartido entre instancias: ruta pública de escritura (ver lib/limite.ts).
  const freno = await limitarCompartido(
    crearClienteAdmin(),
    `rsvp:${ipDePeticion(req.headers)}`,
    FRENO
  );
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

  const datosInvitacion = invitacion.datos as {
    secciones?: { rsvp?: boolean };
    rsvp?: { fechaLimite?: string };
  };

  if (datosInvitacion?.secciones?.rsvp === false) {
    return NextResponse.json(
      { error: "Esta invitación no está recibiendo confirmaciones." },
      { status: 409 }
    );
  }

  // La fecha límite se cierra aquí y no solo en la pantalla: la pantalla se
  // la salta cualquiera que llame a la API directo. El día límite cuenta
  // entero ("antes del 15" admite el 15), en la hora de Santo Domingo.
  if (fechaVencida(datosInvitacion?.rsvp?.fechaLimite ?? "")) {
    return NextResponse.json(
      {
        error:
          "El período de confirmación ha finalizado. Escríbeles directamente a los anfitriones.",
      },
      { status: 409 }
    );
  }

  // ---------- El hogar del enlace personal, si vino con uno ----------
  // El cupo se aplica AQUÍ y no solo en la pantalla: la pantalla se la
  // salta cualquiera que llame a la API directo. Un token que no es de
  // esta invitación se ignora (el primo con el enlace reenviado confirma
  // normal, sin hogar), pero un token VÁLIDO respeta su cupo.
  let hogarId: string | null = null;
  const tokenHogar = String(body.hogar ?? "");
  if (/^[0-9a-f]{16,64}$/.test(tokenHogar)) {
    const { data: hogar } = await supabase
      .from("hogares")
      .select("id, cupo, nombre")
      .eq("invitacion_id", invitacion.id)
      .eq("token", tokenHogar)
      .maybeSingle();
    if (hogar) {
      hogarId = hogar.id;
      if (asiste && cantidad > hogar.cupo) {
        return NextResponse.json(
          {
            error: `Tu invitación tiene cupo para ${hogar.cupo} ${hogar.cupo === 1 ? "persona" : "personas"}. Si necesitan más, escríbanles a los anfitriones.`,
          },
          { status: 409 }
        );
      }
    }
  }

  const nombreNormalizado = normalizarNombre(nombre);

  // ---------- Guardar (o corregir una respuesta anterior) ----------
  const { data: previa } = await supabase
    .from("confirmaciones")
    .select("id")
    .eq("invitacion_id", invitacion.id)
    .eq("nombre_normalizado", nombreNormalizado)
    .maybeSingle();

  // `hogar_id` solo viaja cuando hay hogar: así una base sin la migración
  // de la Etapa E sigue aceptando confirmaciones normales sin quejarse.
  const extraHogar = hogarId ? { hogar_id: hogarId } : {};

  if (previa) {
    const { error } = await supabase
      .from("confirmaciones")
      .update({ nombre, asiste, cantidad, nota, ...extraHogar })
      .eq("id", previa.id);
    if (error) {
      registrarError("rsvp", error, { slug, codigo: error.code, paso: "actualizar" });
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
    ...extraHogar,
  });

  if (error) {
    // Dos envíos simultáneos del mismo invitado chocan con el índice único:
    // no es un fallo real, su confirmación ya quedó registrada.
    if (error.code === "23505") return NextResponse.json({ ok: true, actualizada: true });
    registrarError("rsvp", error, { slug, codigo: error.code, paso: "insertar" });
    return NextResponse.json({ error: "No se pudo guardar tu confirmación." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
