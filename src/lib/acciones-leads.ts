"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "./supabase/servidor";
import { exigirPermiso, registrarAccion, registrarCambioEstado } from "./auditoria";
import { ESTADOS_LEAD, type EstadoLead } from "./leads";
import type { Lead, Plan } from "./tipos";

/**
 * ACCIONES DEL PANEL SOBRE LEADS Y DEMOS
 * =======================================
 * Corren con la sesión del equipo (crearClienteServidor): la RLS es quien
 * manda — sin estar en la lista blanca `equipo`, ninguna de estas hace
 * nada. Mismo trato que lib/acciones.ts.
 */

export async function cambiarEstadoLead(leadId: string, estado: EstadoLead) {
  if (!ESTADOS_LEAD.includes(estado)) throw new Error("Estado inválido");
  const supabase = await crearClienteServidor();
  const quien = await exigirPermiso(supabase, "convertir_leads");
  const { data: previo } = await supabase.from("leads").select("estado").eq("id", leadId).single();
  const { error } = await supabase.from("leads").update({ estado }).eq("id", leadId);
  if (error) throw new Error("No se pudo cambiar el estado");
  await registrarCambioEstado(supabase, quien, "lead", leadId, previo?.estado ?? null, estado);
  revalidatePath("/panel/leads");
}

/**
 * Lead → Cliente. Crea el cliente (o lo reutiliza si ese teléfono ya es
 * cliente: el teléfono llega normalizado igual que en el alta de pedidos,
 * ver lib/telefono.ts) y deja el rastro en el lead: quién convirtió,
 * cuándo y en qué cliente acabó.
 *
 * A PROPÓSITO no crea el pedido: convertir es reconocer al interesado
 * como cliente; el pedido se crea desde "Crear pedido" cuando haya
 * acuerdo de plan y precio. Así ningún pedido nace sin decisión del
 * equipo.
 */
export async function convertirLead(leadId: string) {
  const supabase = await crearClienteServidor();
  const quien = await exigirPermiso(supabase, "convertir_leads");

  const { data: lead } = await supabase.from("leads").select("*").eq("id", leadId).single();
  if (!lead) throw new Error("Lead no encontrado");
  const encontrado = lead as Lead;
  if (encontrado.estado === "convertido") return;

  // ¿Ya es cliente? El teléfono normalizado es la identidad.
  const { data: existente } = await supabase
    .from("clientes")
    .select("id")
    .eq("telefono", encontrado.telefono)
    .maybeSingle();

  let clienteId = existente?.id as string | undefined;

  if (!clienteId) {
    const { data: nuevo, error } = await supabase
      .from("clientes")
      .insert({
        nombre: encontrado.nombre,
        telefono: encontrado.telefono,
        como_nos_conocio: encontrado.fuente,
      })
      .select("id")
      .single();
    if (error || !nuevo) throw new Error("No se pudo crear el cliente");
    clienteId = nuevo.id;
  }

  const { error } = await supabase
    .from("leads")
    .update({
      estado: "convertido",
      cliente_id: clienteId,
      convertido_en: new Date().toISOString(),
      convertido_por: quien.id,
    })
    .eq("id", leadId);
  if (error) throw new Error("No se pudo marcar la conversión");

  await registrarCambioEstado(supabase, quien, "lead", leadId, encontrado.estado, "convertido");
  await registrarAccion(supabase, quien, "lead:convertir", "lead", leadId, {
    cliente_id: clienteId ?? null,
  });

  revalidatePath("/panel/leads");
  revalidatePath("/panel/clientes");
}

/* ---------- Demos públicas ---------- */

export async function marcarDemo(
  invitacionId: string,
  opciones: { tipo_evento: string; plan_minimo: Plan; destacada: boolean }
) {
  const supabase = await crearClienteServidor();
  const quien = await exigirPermiso(supabase, "marcar_demos");
  const { error } = await supabase.from("demos").upsert(
    {
      invitacion_id: invitacionId,
      tipo_evento: opciones.tipo_evento,
      plan_minimo: opciones.plan_minimo,
      destacada: opciones.destacada,
      activa: true,
    },
    { onConflict: "invitacion_id" }
  );
  if (error) throw new Error("No se pudo marcar la demo");
  await registrarAccion(supabase, quien, "demo:marcar", "invitacion", invitacionId, {
    destacada: opciones.destacada, plan_minimo: opciones.plan_minimo,
  });
  revalidatePath("/panel/demos");
}

export async function quitarDemo(invitacionId: string) {
  const supabase = await crearClienteServidor();
  const quien = await exigirPermiso(supabase, "marcar_demos");
  const { error } = await supabase.from("demos").delete().eq("invitacion_id", invitacionId);
  if (error) throw new Error("No se pudo quitar la demo");
  await registrarAccion(supabase, quien, "demo:quitar", "invitacion", invitacionId);
  revalidatePath("/panel/demos");
}
