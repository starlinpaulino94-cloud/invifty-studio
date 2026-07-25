import { NextRequest, NextResponse } from "next/server";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { construirFormulario } from "@/config/formularios";
import { LIMITE_FOTOS } from "@/lib/planes";
import { Plan, TipoEvento } from "@/lib/tipos";

/**
 * API pública del formulario del cliente, autenticada por el token único
 * del link. Usa la service_role key en el servidor; el cliente nunca
 * habla con Supabase directamente.
 */

async function buscarFormulario(token: string) {
  const supabase = crearClienteAdmin();
  const { data, error } = await supabase
    .from("formularios")
    .select("*, pedidos(*, clientes(*))")
    .eq("token", token)
    .single();
  if (error || !data) return null;
  return data;
}

// GET /api/formulario/[token] → estructura del formulario + progreso guardado
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const formulario = await buscarFormulario(token);
  if (!formulario) {
    return NextResponse.json({ error: "Formulario no encontrado" }, { status: 404 });
  }

  const pedido = formulario.pedidos;
  const bloques = construirFormulario(pedido.tipo_evento as TipoEvento, pedido.plan as Plan);
  const limiteFotos = LIMITE_FOTOS[pedido.plan as Plan];

  // Fotos ya subidas
  const supabase = crearClienteAdmin();
  const { data: archivos } = await supabase.storage
    .from("fotos-pedidos")
    .list(pedido.id, { limit: 200 });

  return NextResponse.json({
    estado: formulario.estado,
    respuestas: formulario.respuestas ?? {},
    bloques,
    limiteFotos: Number.isFinite(limiteFotos) ? limiteFotos : null,
    plan: pedido.plan,
    tipoEvento: pedido.tipo_evento,
    nombreCliente: pedido.clientes?.nombre ?? "",
    fotos: (archivos ?? []).map((a) => ({ nombre: a.name, ruta: `${pedido.id}/${a.name}` })),
  });
}

// PATCH /api/formulario/[token] → guardar progreso (autosave)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const formulario = await buscarFormulario(token);
  if (!formulario) {
    return NextResponse.json({ error: "Formulario no encontrado" }, { status: 404 });
  }
  if (formulario.estado === "completado") {
    return NextResponse.json({ error: "El formulario ya fue completado" }, { status: 409 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body.respuestas !== "object") {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const supabase = crearClienteAdmin();
  const { error } = await supabase
    .from("formularios")
    .update({ respuestas: body.respuestas, estado: "en_progreso" })
    .eq("id", formulario.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// POST /api/formulario/[token] → marcar como completado
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const formulario = await buscarFormulario(token);
  if (!formulario) {
    return NextResponse.json({ error: "Formulario no encontrado" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const supabase = crearClienteAdmin();

  const { error } = await supabase
    .from("formularios")
    .update({
      respuestas: body.respuestas ?? formulario.respuestas,
      estado: "completado",
      fecha_completado: new Date().toISOString(),
    })
    .eq("id", formulario.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Avanza el pedido en el pipeline si aún estaba en etapas iniciales
  const pedido = formulario.pedidos;
  if (["nuevo", "formulario_enviado"].includes(pedido.estado)) {
    await supabase
      .from("pedidos")
      .update({ estado: "formulario_completado" })
      .eq("id", pedido.id);
  }

  return NextResponse.json({ ok: true });
}
