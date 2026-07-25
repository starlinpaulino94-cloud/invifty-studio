"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "./supabase/servidor";
import { VIGENCIA_MESES } from "./planes";
import { EstadoPedido, Plan } from "./tipos";

/** Normaliza un teléfono a solo dígitos (formato WhatsApp: 18091234567). */
function normalizarTelefono(t: string): string {
  const digitos = t.replace(/\D/g, "");
  // Números dominicanos de 10 dígitos → anteponer 1
  return digitos.length === 10 ? `1${digitos}` : digitos;
}

/** Crea (o reutiliza) el cliente, crea el pedido y genera su formulario con token. */
export async function crearPedido(formData: FormData) {
  const supabase = await crearClienteServidor();

  const nombre = String(formData.get("nombre") ?? "").trim();
  const telefono = normalizarTelefono(String(formData.get("telefono") ?? ""));
  const email = String(formData.get("email") ?? "").trim() || null;
  const como = String(formData.get("como_nos_conocio") ?? "").trim() || null;
  const tipoEvento = String(formData.get("tipo_evento") ?? "boda");
  const plan = String(formData.get("plan") ?? "popular");
  const extras = formData.getAll("extras").map(String);
  const fechaEvento = String(formData.get("fecha_evento") ?? "") || null;
  const precio = Number(formData.get("precio") ?? 0);
  const notas = String(formData.get("notas") ?? "").trim() || null;

  if (!nombre || !telefono) throw new Error("Nombre y teléfono son obligatorios");

  // Cliente: buscar por teléfono o crear
  let clienteId: string;
  const { data: existente } = await supabase
    .from("clientes")
    .select("id")
    .eq("telefono", telefono)
    .maybeSingle();

  if (existente) {
    clienteId = existente.id;
  } else {
    const { data: nuevo, error } = await supabase
      .from("clientes")
      .insert({ nombre, telefono, email, como_nos_conocio: como })
      .select("id")
      .single();
    if (error) throw new Error(`No se pudo crear el cliente: ${error.message}`);
    clienteId = nuevo.id;
  }

  // Pedido
  const { data: pedido, error: errorPedido } = await supabase
    .from("pedidos")
    .insert({
      cliente_id: clienteId,
      tipo_evento: tipoEvento,
      plan,
      extras,
      fecha_evento: fechaEvento,
      precio,
      notas,
      estado: "nuevo",
    })
    .select("id")
    .single();
  if (errorPedido) throw new Error(`No se pudo crear el pedido: ${errorPedido.message}`);

  // Formulario con token único
  const token = crypto.randomUUID().replace(/-/g, "");
  const { error: errorForm } = await supabase
    .from("formularios")
    .insert({ pedido_id: pedido.id, token });
  if (errorForm) throw new Error(`No se pudo crear el formulario: ${errorForm.message}`);

  revalidatePath("/panel");
  redirect(`/panel/pedidos/${pedido.id}?nuevo=1`);
}

/** Cambia el estado del pedido. Al marcar "entregada" calcula el vencimiento según el plan. */
export async function cambiarEstado(pedidoId: string, estado: EstadoPedido) {
  const supabase = await crearClienteServidor();

  const cambios: Record<string, unknown> = { estado };

  if (estado === "entregada") {
    const { data: pedido } = await supabase
      .from("pedidos")
      .select("plan, fecha_entrega")
      .eq("id", pedidoId)
      .single();

    if (pedido && !pedido.fecha_entrega) {
      const hoy = new Date();
      const vencimiento = new Date(hoy);
      vencimiento.setMonth(vencimiento.getMonth() + VIGENCIA_MESES[pedido.plan as Plan]);
      cambios.fecha_entrega = hoy.toISOString().slice(0, 10);
      cambios.fecha_vencimiento = vencimiento.toISOString().slice(0, 10);
    }
  }

  const { error } = await supabase.from("pedidos").update(cambios).eq("id", pedidoId);
  if (error) throw new Error(error.message);

  revalidatePath("/panel");
  revalidatePath(`/panel/pedidos/${pedidoId}`);
}

/** Marca el formulario como enviado (se usa al copiar el mensaje de WhatsApp). */
export async function marcarFormularioEnviado(pedidoId: string) {
  const supabase = await crearClienteServidor();
  const { data: pedido } = await supabase
    .from("pedidos")
    .select("estado")
    .eq("id", pedidoId)
    .single();

  if (pedido?.estado === "nuevo") {
    await supabase.from("pedidos").update({ estado: "formulario_enviado" }).eq("id", pedidoId);
    revalidatePath("/panel");
    revalidatePath(`/panel/pedidos/${pedidoId}`);
  }
}

/** Registra un abono al pedido. */
export async function registrarPago(pedidoId: string, formData: FormData) {
  const supabase = await crearClienteServidor();
  const monto = Number(formData.get("monto") ?? 0);
  const metodo = String(formData.get("metodo") ?? "").trim() || null;
  const nota = String(formData.get("nota") ?? "").trim() || null;

  if (monto <= 0) throw new Error("El monto debe ser mayor que cero");

  const { error } = await supabase
    .from("pagos")
    .insert({ pedido_id: pedidoId, monto, metodo, nota });
  if (error) throw new Error(error.message);

  revalidatePath(`/panel/pedidos/${pedidoId}`);
}

/** Elimina un abono registrado por error. */
export async function eliminarPago(pagoId: string, pedidoId: string) {
  const supabase = await crearClienteServidor();
  await supabase.from("pagos").delete().eq("id", pagoId);
  revalidatePath(`/panel/pedidos/${pedidoId}`);
}

/** Guarda la URL de la invitación entregada y las notas internas. */
export async function guardarFicha(pedidoId: string, formData: FormData) {
  const supabase = await crearClienteServidor();
  const url = String(formData.get("url_entregada") ?? "").trim() || null;
  const notas = String(formData.get("notas") ?? "").trim() || null;

  const { error } = await supabase
    .from("pedidos")
    .update({ url_entregada: url, notas })
    .eq("id", pedidoId);
  if (error) throw new Error(error.message);

  revalidatePath(`/panel/pedidos/${pedidoId}`);
}

/** Cierra la sesión del panel. */
export async function cerrarSesion() {
  const supabase = await crearClienteServidor();
  await supabase.auth.signOut();
  redirect("/login");
}
