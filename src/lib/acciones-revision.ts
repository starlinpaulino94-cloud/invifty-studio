"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "./supabase/servidor";
import { exigirPermiso, registrarAccion, registrarCambioEstado } from "./auditoria";
import { fechaExpiracion, tokenOpaco } from "./revision";
import { transicionValida } from "./estados";
import { urlBase as resolverUrlBase } from "./url";
import type { EstadoPedido } from "./tipos";

/**
 * LAS ACCIONES DE REVISIÓN DEL EQUIPO
 * ====================================
 * El lado del panel del ciclo de aprobación. El del cliente vive en
 * /revision/<token> (rutas públicas con el cliente admin); estas cuatro
 * son del equipo y firman con su sesión:
 *
 *  - enviarARevision: congela la invitación en una VERSIÓN inmutable y
 *    crea el enlace. Cada envío revoca el enlace anterior: un solo
 *    enlace vivo por invitación, siempre apuntando a la última versión.
 *  - revocarRevision: mata un enlace que ya no debe andar por ahí.
 *  - desbloquearInvitacion: quita el candado que dejó una aprobación,
 *    a propósito y con firma. "Editar lo aprobado" nunca es un descuido.
 *  - actualizarComentario: marca el comentario del cliente como en
 *    proceso / resuelto / descartado.
 */

export interface RespuestaRevision {
  ok: boolean;
  error?: string;
  /** Enlace listo para mandar por WhatsApp al cliente. */
  url?: string;
}

export async function enviarARevision(
  invitacionId: string,
  motivo: string
): Promise<RespuestaRevision> {
  const supabase = await crearClienteServidor();
  const quien = await exigirPermiso(supabase, "editar_invitaciones");

  const { data: invitacion } = await supabase
    .from("invitaciones")
    .select("id, pedido_id, plantilla, datos, codigo_html, bloqueada_en, pedidos(estado)")
    .eq("id", invitacionId)
    .single();
  if (!invitacion) return { ok: false, error: "Invitación no encontrada" };

  if (invitacion.bloqueada_en) {
    return {
      ok: false,
      error: "La invitación está bloqueada por una aprobación. Desbloquéala antes de enviar otra revisión.",
    };
  }

  // Número de versión: la siguiente a la última que exista.
  const { data: ultima } = await supabase
    .from("versiones")
    .select("numero")
    .eq("invitacion_id", invitacionId)
    .order("numero", { ascending: false })
    .limit(1)
    .maybeSingle();
  const numero = (ultima?.numero ?? 0) + 1;

  const { data: version, error: errorVersion } = await supabase
    .from("versiones")
    .insert({
      invitacion_id: invitacionId,
      numero,
      plantilla: invitacion.plantilla,
      datos: invitacion.datos,
      codigo_html: invitacion.codigo_html,
      motivo: motivo.trim().slice(0, 300) || null,
      usuario_id: quien.id,
      usuario_email: quien.email,
    })
    .select("id")
    .single();
  if (errorVersion) {
    const falta = errorVersion.message.includes("versiones");
    return {
      ok: false,
      error: falta
        ? "Falta la migración 20260805210000_cliente-e-invitados.sql en Supabase."
        : errorVersion.message,
    };
  }

  // Un solo enlace vivo por invitación: el anterior se revoca aquí mismo.
  await supabase
    .from("revisiones")
    .update({ revocada_en: new Date().toISOString() })
    .eq("invitacion_id", invitacionId)
    .eq("estado", "abierta")
    .is("revocada_en", null);

  const token = tokenOpaco();
  const { error: errorRevision } = await supabase.from("revisiones").insert({
    invitacion_id: invitacionId,
    version_id: version.id,
    token,
    expira_en: fechaExpiracion(new Date()),
    usuario_id: quien.id,
    usuario_email: quien.email,
  });
  if (errorRevision) return { ok: false, error: errorRevision.message };

  await registrarAccion(supabase, quien, "revision:enviar", "invitacion", invitacionId, {
    version: numero,
  });

  // El pedido acompaña: si estaba en diseño, ahora está en revisión.
  const pedido = invitacion.pedidos as unknown as { estado: EstadoPedido } | null;
  if (pedido && transicionValida(pedido.estado, "revision_cliente")) {
    await supabase
      .from("pedidos")
      .update({ estado: "revision_cliente" })
      .eq("id", invitacion.pedido_id);
    await registrarCambioEstado(
      supabase, quien, "pedido", invitacion.pedido_id, pedido.estado, "revision_cliente",
      `versión ${numero} enviada a revisión`
    );
  }

  revalidatePath(`/panel/invitaciones/${invitacionId}`);
  return { ok: true, url: `${resolverUrlBase()}/revision/${token}` };
}

export async function revocarRevision(revisionId: string): Promise<RespuestaRevision> {
  const supabase = await crearClienteServidor();
  const quien = await exigirPermiso(supabase, "editar_invitaciones");

  const { data: revision } = await supabase
    .from("revisiones")
    .select("id, invitacion_id, revocada_en")
    .eq("id", revisionId)
    .single();
  if (!revision) return { ok: false, error: "Revisión no encontrada" };
  if (revision.revocada_en) return { ok: true };

  const { error } = await supabase
    .from("revisiones")
    .update({ revocada_en: new Date().toISOString() })
    .eq("id", revisionId);
  if (error) return { ok: false, error: error.message };

  await registrarAccion(supabase, quien, "revision:revocar", "invitacion", revision.invitacion_id);
  revalidatePath(`/panel/invitaciones/${revision.invitacion_id}`);
  return { ok: true };
}

export async function desbloquearInvitacion(
  invitacionId: string,
  motivo: string
): Promise<RespuestaRevision> {
  const supabase = await crearClienteServidor();
  const quien = await exigirPermiso(supabase, "editar_invitaciones");

  const limpio = motivo.trim().slice(0, 300);
  if (limpio.length < 5) {
    return { ok: false, error: "Escribe el motivo: quedará en la auditoría junto a tu firma." };
  }

  const { error } = await supabase
    .from("invitaciones")
    .update({ bloqueada_en: null })
    .eq("id", invitacionId);
  if (error) return { ok: false, error: error.message };

  await registrarAccion(supabase, quien, "invitacion:desbloquear", "invitacion", invitacionId, {
    motivo: limpio,
  });
  revalidatePath(`/panel/invitaciones/${invitacionId}`);
  return { ok: true };
}

const ESTADOS_COMENTARIO = ["abierto", "en_proceso", "resuelto", "descartado"] as const;

export async function actualizarComentario(
  comentarioId: string,
  estado: string
): Promise<RespuestaRevision> {
  const supabase = await crearClienteServidor();
  const quien = await exigirPermiso(supabase, "editar_invitaciones");

  if (!(ESTADOS_COMENTARIO as readonly string[]).includes(estado)) {
    return { ok: false, error: "Estado de comentario inválido" };
  }

  const { data: comentario } = await supabase
    .from("comentarios")
    .select("id, revisiones(invitacion_id)")
    .eq("id", comentarioId)
    .single();
  if (!comentario) return { ok: false, error: "Comentario no encontrado" };

  const { error } = await supabase
    .from("comentarios")
    .update({
      estado,
      resuelto_por: estado === "abierto" ? null : quien.email,
    })
    .eq("id", comentarioId);
  if (error) return { ok: false, error: error.message };

  const rev = comentario.revisiones as unknown as { invitacion_id: string } | null;
  if (rev) revalidatePath(`/panel/invitaciones/${rev.invitacion_id}`);
  return { ok: true };
}
