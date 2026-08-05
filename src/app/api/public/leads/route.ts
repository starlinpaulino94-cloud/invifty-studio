import { NextRequest, NextResponse } from "next/server";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { validarLead } from "@/lib/leads";
import { cabecerasCors } from "@/lib/cors-publico";
import { limitarCompartido, ipDePeticion } from "@/lib/limite";
import { registrarError } from "@/lib/registro";

/**
 * POST /api/public/leads — el formulario de contacto de Invifty Web
 * ==================================================================
 * Lo que un interesado escribe en la web acaba aquí y aparece en
 * /panel/leads con su atribución. Antes vivía en el WhatsApp de quien lo
 * atendió: sin lista, sin estados, sin saber cuántos se perdieron.
 *
 * Es pública sin clave A PROPÓSITO: una clave dentro del JavaScript de la
 * web deja de ser secreta en el primer F12. Las defensas reales:
 *  - validación estricta (lib/leads.ts, probada aparte);
 *  - honeypot: el campo "web" es invisible para humanos — si viene lleno
 *    es un bot, y se le dice "ok" para que no aprenda;
 *  - idempotencia: el doble clic trae la misma clave y el índice único lo
 *    hace un solo lead;
 *  - freno por IP, y CORS que limita desde qué páginas puede llamar un
 *    navegador.
 *
 * Las respuestas de error son genéricas hacia fuera; el detalle vive en
 * el log del servidor, redactado.
 */

/** Nadie legítimo envía el formulario de contacto 10 veces en 10 minutos. */
const FRENO = { max: 10, ventanaS: 10 * 60 };

export async function POST(req: NextRequest) {
  const cors = cabecerasCors(req.headers.get("origin"));

  // Freno compartido entre instancias (con respaldo local si la base no
  // responde): esta ruta la puede llamar cualquiera desde la web pública.
  const freno = await limitarCompartido(
    crearClienteAdmin(),
    `leads:${ipDePeticion(req.headers)}`,
    FRENO
  );
  if (!freno.ok) {
    return NextResponse.json(
      { error: "Demasiados envíos seguidos. Espera un momento." },
      { status: 429, headers: { "Retry-After": String(freno.esperaS), ...cors } }
    );
  }

  const body = await req.json().catch(() => null);

  // Honeypot: campo invisible en el formulario real. Un humano no lo ve;
  // un bot que rellena todo lo delata. Se responde ok para no darle pistas.
  if (body && typeof body === "object" && (body as Record<string, unknown>).web) {
    return NextResponse.json({ ok: true }, { headers: cors });
  }

  const resultado = validarLead(body);
  if (!resultado.ok) {
    return NextResponse.json({ error: resultado.error }, { status: 400, headers: cors });
  }

  const supabase = crearClienteAdmin();
  const { error } = await supabase.from("leads").insert(resultado.lead);

  if (error) {
    // Clave de idempotencia repetida = doble clic. El lead ya está: ok.
    if (error.code === "23505") return NextResponse.json({ ok: true }, { headers: cors });
    registrarError("leads", error, { codigo: error.code });
    return NextResponse.json(
      { error: "No se pudo enviar. Inténtalo de nuevo." },
      { status: 500, headers: cors }
    );
  }

  return NextResponse.json({ ok: true }, { status: 201, headers: cors });
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: cabecerasCors(req.headers.get("origin")),
  });
}
