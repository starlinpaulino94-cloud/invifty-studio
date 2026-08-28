import { NextRequest, NextResponse } from "next/server";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { ipDePeticion, limitarCompartido } from "@/lib/limite";
import { contratoDePedido } from "@/lib/capacidades";
import { tieneMesaRegalos, validarAporte } from "@/lib/regalos";
import { registrarError } from "@/lib/registro";

/**
 * EL INVITADO REGISTRA SU REGALO — /api/regalos/<slug>/aportar
 * =============================================================
 * Autenticado por conocer el enlace, como el RSVP. Solo REGISTRA para
 * la lista de agradecimientos: el dinero ya viajó directo del invitado
 * al anfitrión, por fuera de Invifty.
 */

/** Un invitado real registra un regalo, no veinte. */
const FRENO = { max: 10, ventanaS: 15 * 60 };

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const admin = crearClienteAdmin();
  const freno = await limitarCompartido(admin, `regalos:${ipDePeticion(req.headers)}`, FRENO);
  if (!freno.ok) {
    return NextResponse.json(
      { error: "Demasiados intentos seguidos. Espera un momento." },
      { status: 429, headers: { "Retry-After": String(freno.esperaS) } }
    );
  }

  const { data: invitacion } = await admin
    .from("invitaciones")
    .select("id, estado, pedidos(extras, plan, capacidades_contratadas)")
    .eq("slug", slug)
    .maybeSingle();
  const pedido = invitacion?.pedidos as unknown as {
    extras: string[]; plan: string; capacidades_contratadas: unknown;
  } | null;
  if (
    !invitacion ||
    !pedido ||
    invitacion.estado !== "publicada" ||
    !tieneMesaRegalos(contratoDePedido(pedido))
  ) {
    return NextResponse.json({ error: "Mesa de regalos no encontrada" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const veredicto = validarAporte({
    nombre: body?.nombre,
    monto: body?.monto,
    mensaje: body?.mensaje,
  });
  if (!veredicto.ok) return NextResponse.json({ error: veredicto.error }, { status: 400 });

  const { error } = await admin.from("aportes").insert({
    invitacion_id: invitacion.id,
    nombre: veredicto.nombre,
    monto: veredicto.monto,
    mensaje: veredicto.mensaje,
  });
  if (error) {
    registrarError("regalos", error, { slug, paso: "insertar aporte" });
    return NextResponse.json(
      { error: "No se pudo registrar tu regalo. Inténtalo de nuevo." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
