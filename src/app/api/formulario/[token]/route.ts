import { NextRequest, NextResponse } from "next/server";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { limitar } from "@/lib/limite";
import { construirFormulario } from "@/config/formularios";
import { LIMITE_FOTOS, PLANES, TIPOS_EVENTO } from "@/lib/planes";
import { Plan, TipoEvento } from "@/lib/tipos";
import { encolarAvisoEquipo } from "@/lib/avisos";
import { listarArchivos, rutaOriginal } from "@/lib/fotos";
import { urlBase } from "@/lib/url";

/**
 * API pública del formulario del cliente, autenticada por el token único
 * del link. Usa la service_role key en el servidor; el cliente nunca
 * habla con Supabase directamente.
 */

/**
 * El autosave guarda 800 ms después de cada cambio (components/formulario/
 * Asistente.tsx), así que un cliente escribiendo sin parar durante diez
 * minutos no llega ni de lejos a 300 guardados. Un bucle sí.
 *
 * Se cuenta por token y no por IP: una boda entera rellenando el formulario
 * desde el mismo wifi de la casa no tiene por qué compartir cupo.
 */
const FRENO_GUARDADO = { max: 300, ventanaMs: 10 * 60 * 1000 };

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

  // Fotos ya subidas (sin la subcarpeta de derivados: el cliente solo
  // debe ver los archivos que él mismo subió)
  const supabase = crearClienteAdmin();
  const archivos = await listarArchivos(supabase, pedido.id, 200);

  return NextResponse.json({
    estado: formulario.estado,
    respuestas: formulario.respuestas ?? {},
    bloques,
    limiteFotos: Number.isFinite(limiteFotos) ? limiteFotos : null,
    plan: pedido.plan,
    tipoEvento: pedido.tipo_evento,
    nombreCliente: pedido.clientes?.nombre ?? "",
    fotos: archivos.map((a) => ({ nombre: a.nombre, ruta: rutaOriginal(pedido.id, a.nombre) })),
  });
}

// PATCH /api/formulario/[token] → guardar progreso (autosave)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const freno = limitar(`formulario:${token}`, FRENO_GUARDADO);
  if (!freno.ok) {
    return NextResponse.json(
      { error: "Demasiados guardados seguidos. Espera un momento." },
      { status: 429, headers: { "Retry-After": String(freno.esperaS) } }
    );
  }

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

  // Aviso al equipo por la bandeja de salida (lib/avisos.ts): queda
  // encolado con reintentos aunque Resend falle ahora mismo, y la
  // respuesta al cliente no espera al correo.
  await encolarAvisoEquipo(
    supabase,
    "formulario_completado",
    {
      nombre: pedido.clientes?.nombre ?? "Cliente",
      detalle: `${TIPOS_EVENTO[pedido.tipo_evento as TipoEvento]} · Plan ${PLANES[pedido.plan as Plan].nombre}`,
      rutaPanel: `/panel/pedidos/${pedido.id}`,
      urlBase: urlBase(),
    },
    { tipo: "pedido", id: pedido.id }
  );

  return NextResponse.json({ ok: true });
}
