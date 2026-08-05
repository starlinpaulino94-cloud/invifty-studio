"use server";

import { normalizarTelefono } from "@/lib/telefono";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "./supabase/servidor";
import { calcularVencimiento } from "./vencimientos";
import { transicionValida } from "./estados";
import { montoValido } from "./pagos";
import { exigirPermiso, registrarAccion, registrarCambioEstado } from "./auditoria";
import type { EstadoPedido, Plan } from "./tipos";


/** Crea (o reutiliza) el cliente, crea el pedido y genera su formulario con token. */
export async function crearPedido(formData: FormData) {
  const supabase = await crearClienteServidor();
  const quien = await exigirPermiso(supabase, "crear_pedidos");

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

  await registrarAccion(supabase, quien, "pedido:crear", "pedido", pedido.id, {
    plan, precio, tipo_evento: tipoEvento,
  });

  revalidatePath("/panel");
  redirect(`/panel/pedidos/${pedido.id}?nuevo=1`);
}

/**
 * Cambia el estado del pedido. Valida la transición EN EL SERVIDOR (el
 * selector del panel ya solo ofrece las posibles, pero esconder botones no
 * es validación), deja el cambio en el historial inmutable, y al marcar
 * "entregada" calcula el vencimiento según el plan.
 */
export async function cambiarEstado(pedidoId: string, estado: EstadoPedido) {
  const supabase = await crearClienteServidor();
  const quien = await exigirPermiso(supabase, "cambiar_estado");

  const { data: pedido } = await supabase
    .from("pedidos")
    .select("estado, plan, fecha_entrega")
    .eq("id", pedidoId)
    .single();
  if (!pedido) throw new Error("Pedido no encontrado");

  const estadoActual = pedido.estado as EstadoPedido;
  if (estadoActual === estado) return;
  if (!transicionValida(estadoActual, estado)) {
    throw new Error(
      `Un pedido "${estadoActual}" no puede pasar directo a "${estado}". ` +
        "Si de verdad hace falta, ve paso por paso — así el historial cuenta lo que pasó."
    );
  }

  const cambios: Record<string, unknown> = { estado };

  if (estado === "entregada" && !pedido.fecha_entrega) {
    const hoy = new Date().toISOString().slice(0, 10);
    cambios.fecha_entrega = hoy;
    cambios.fecha_vencimiento = calcularVencimiento(hoy, pedido.plan as Plan);
  }

  const { error } = await supabase.from("pedidos").update(cambios).eq("id", pedidoId);
  if (error) throw new Error(error.message);

  await registrarCambioEstado(supabase, quien, "pedido", pedidoId, estadoActual, estado);

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
    const quien = await exigirPermiso(supabase, "cambiar_estado");
    await supabase.from("pedidos").update({ estado: "formulario_enviado" }).eq("id", pedidoId);
    await registrarCambioEstado(
      supabase, quien, "pedido", pedidoId, "nuevo", "formulario_enviado",
      "enlace del formulario copiado"
    );
    revalidatePath("/panel");
    revalidatePath(`/panel/pedidos/${pedidoId}`);
  }
}

/** Registra un abono al pedido. */
export async function registrarPago(pedidoId: string, formData: FormData) {
  const supabase = await crearClienteServidor();
  const quien = await exigirPermiso(supabase, "registrar_pagos");
  const monto = Number(formData.get("monto") ?? 0);
  const metodo = String(formData.get("metodo") ?? "").trim() || null;
  const nota = String(formData.get("nota") ?? "").trim() || null;

  if (!montoValido(monto)) throw new Error("El monto debe ser un número mayor que cero");

  const { data: pago, error } = await supabase
    .from("pagos")
    .insert({ pedido_id: pedidoId, monto, metodo, nota })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await registrarAccion(supabase, quien, "pago:registrar", "pago", pago.id, {
    pedido_id: pedidoId, monto, metodo,
  });

  revalidatePath(`/panel/pedidos/${pedidoId}`);
}

/**
 * Anula un abono anotado por error. ANULA, no borra: el pago queda tachado
 * con motivo y firma, y el balance lo ignora (lib/pagos.ts). Dinero borrado
 * sin rastro es exactamente lo que una auditoría no puede permitirse.
 */
export async function anularPago(pagoId: string, pedidoId: string, motivo: string) {
  const supabase = await crearClienteServidor();
  const quien = await exigirPermiso(supabase, "anular_pagos");

  const limpio = motivo.trim().slice(0, 300);
  if (limpio.length < 3) throw new Error("Di por qué se anula: el motivo queda en el registro.");

  const { error } = await supabase
    .from("pagos")
    .update({
      anulado_en: new Date().toISOString(),
      anulado_por: quien.id,
      motivo_anulacion: limpio,
    })
    .eq("id", pagoId)
    .is("anulado_en", null); // anular dos veces no reescribe la primera firma
  if (error) throw new Error(error.message);

  await registrarAccion(supabase, quien, "pago:anular", "pago", pagoId, {
    pedido_id: pedidoId, motivo: limpio,
  });

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
