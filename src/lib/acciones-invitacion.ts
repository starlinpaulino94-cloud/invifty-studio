"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "./supabase/servidor";
import { derivarDatosInvitacion, slugificar } from "./invitacion";
import { calcularVencimiento } from "./vencimientos";
import type { DatosInvitacion, Plan, TipoEvento } from "./tipos";
import { urlBase as resolverUrlBase } from "./url";

/**
 * FASE 2 — Acciones del generador de invitaciones (solo panel).
 */

/** Genera la invitación en borrador desde las respuestas del formulario. */
export async function generarInvitacion(pedidoId: string) {
  const supabase = await crearClienteServidor();

  // Si ya existe, ir directo al editor
  const { data: existente } = await supabase
    .from("invitaciones")
    .select("id")
    .eq("pedido_id", pedidoId)
    .maybeSingle();
  if (existente) redirect(`/panel/invitaciones/${existente.id}`);

  const { data: pedido } = await supabase
    .from("pedidos")
    .select("*, clientes(*), formularios(*)")
    .eq("id", pedidoId)
    .single();
  if (!pedido) throw new Error("Pedido no encontrado");

  const respuestas = (pedido.formularios?.[0]?.respuestas ?? {}) as Record<string, unknown>;
  const { datos, plantilla } = derivarDatosInvitacion(
    pedido.tipo_evento as TipoEvento,
    respuestas,
    pedido.clientes?.telefono ?? "",
    pedido.fecha_evento,
    pedido.plan as Plan
  );

  // Slug único a partir del título
  const base = slugificar(datos.titulo);
  let slug = base;
  for (let intento = 2; intento < 50; intento++) {
    const { data: choque } = await supabase
      .from("invitaciones")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!choque) break;
    slug = `${base}-${intento}`;
  }

  const { data: nueva, error } = await supabase
    .from("invitaciones")
    .insert({ pedido_id: pedidoId, slug, datos, plantilla })
    .select("id")
    .single();
  if (error) throw new Error(`No se pudo generar la invitación: ${error.message}`);

  revalidatePath(`/panel/pedidos/${pedidoId}`);
  redirect(`/panel/invitaciones/${nueva.id}`);
}

/** Guarda los cambios del editor. */
export async function guardarInvitacion(
  invitacionId: string,
  datos: DatosInvitacion,
  slug: string,
  plantilla: string,
  /** HTML de la invitación cuando se hizo fuera del sistema. */
  codigoHtml?: string | null
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await crearClienteServidor();

  const slugLimpio = slugificar(slug);
  const { error } = await supabase
    .from("invitaciones")
    .update({ datos, slug: slugLimpio, plantilla, codigo_html: codigoHtml ?? null })
    .eq("id", invitacionId);

  if (error) {
    const mensaje = error.message.includes("duplicate")
      ? "Ese slug ya está en uso por otra invitación."
      : error.message;
    return { ok: false, error: mensaje };
  }

  revalidatePath(`/panel/invitaciones/${invitacionId}`);
  return { ok: true };
}

/**
 * Publica la invitación: la hace visible al público, guarda la URL en el
 * pedido y lo marca como entregado (calculando el vencimiento del plan).
 */
export async function publicarInvitacion(invitacionId: string) {
  const supabase = await crearClienteServidor();

  const { data: invitacion } = await supabase
    .from("invitaciones")
    .select("*, pedidos(*)")
    .eq("id", invitacionId)
    .single();
  if (!invitacion) throw new Error("Invitación no encontrada");

  await supabase
    .from("invitaciones")
    .update({ estado: "publicada", publicada_en: new Date().toISOString() })
    .eq("id", invitacionId);

  // Actualizar el pedido: URL entregada + estado entregada + vencimiento
  const pedido = invitacion.pedidos;
  const urlBase = resolverUrlBase();
  const cambios: Record<string, unknown> = {
    url_entregada: `${urlBase}/i/${invitacion.slug}`,
  };

  if (!["entregada", "activa", "vencida"].includes(pedido.estado)) {
    cambios.estado = "entregada";
    if (!pedido.fecha_entrega) {
      const hoy = new Date().toISOString().slice(0, 10);
      cambios.fecha_entrega = hoy;
      cambios.fecha_vencimiento = calcularVencimiento(hoy, pedido.plan as Plan);
    }
  }

  await supabase.from("pedidos").update(cambios).eq("id", pedido.id);

  revalidatePath(`/panel/invitaciones/${invitacionId}`);
  revalidatePath(`/panel/pedidos/${pedido.id}`);
  revalidatePath("/panel");
}

/** Regresa la invitación a borrador (deja de ser visible al público). */
export async function despublicarInvitacion(invitacionId: string) {
  const supabase = await crearClienteServidor();
  await supabase
    .from("invitaciones")
    .update({ estado: "borrador" })
    .eq("id", invitacionId);
  revalidatePath(`/panel/invitaciones/${invitacionId}`);
}
