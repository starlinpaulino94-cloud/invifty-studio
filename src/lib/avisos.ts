import type { SupabaseClient } from "@supabase/supabase-js";
import { configuracionEnvio, enviarCorreo, escaparHtml, plantillaCorreo } from "./notificaciones";
import { registrarError } from "./registro";

/**
 * LA BANDEJA DE SALIDA (outbox de avisos)
 * ========================================
 * Antes, un aviso era un fetch a Resend en medio de la petición: si
 * fallaba, desaparecía sin dejar ni el intento. Ahora cada aviso es una
 * FILA en `avisos` — se encola primero, se intenta enviar después, y la
 * fila recuerda el resultado. De ahí salen tres garantías:
 *
 *  1. NADA SE ESFUMA. El fallo queda escrito (estado, intentos, error) y
 *     el repaso diario del cron lo reintenta hasta 5 veces.
 *  2. LA PETICIÓN NO ESPERA AL CORREO. Encolar es un insert; el envío va
 *     después y en paralelo (y si no llega a tiempo, lo barre el cron).
 *  3. SE PUEDE AUDITAR. "¿Le avisamos al equipo cuando el cliente
 *     aprobó?" es una consulta, no un acto de fe.
 *
 * Solo correos INTERNOS al equipo: el destinatario sale de
 * NOTIFICACIONES_EMAIL, nunca de datos del cliente o del invitado.
 */

export const MAX_INTENTOS = 5;

/** Un aviso fallado se reintenta hasta agotar los intentos. */
export function debeReintentar(intentos: number): boolean {
  return intentos < MAX_INTENTOS;
}

export type TipoAviso =
  | "formulario_completado"
  | "revision_aprobada"
  | "revision_cambios"
  | "comentario_nuevo";

export interface ContextoAviso {
  /** Nombre del cliente o del evento; se escapa aquí, no en quien llama. */
  nombre: string;
  /** Detalle corto adicional (plan, sección comentada…). Opcional. */
  detalle?: string;
  /** Ruta del panel a la que lleva el botón (ej. /panel/pedidos/<id>). */
  rutaPanel: string;
  /** Base pública (https://studio.invifty.com); va como parámetro para poder probarse. */
  urlBase: string;
}

/**
 * El asunto y el cuerpo de cada tipo de aviso. Pura: mismos datos, mismo
 * correo — así las pruebas pueden afirmar qué sale y qué NO sale (jamás
 * un teléfono ni una lista de invitados).
 */
export function construirAviso(
  tipo: TipoAviso,
  ctx: ContextoAviso
): { asunto: string; cuerpo_html: string } {
  const nombre = escaparHtml(ctx.nombre);
  const detalle = ctx.detalle ? escaparHtml(ctx.detalle) : "";
  const url = `${ctx.urlBase}${ctx.rutaPanel}`;

  const piezas: Record<TipoAviso, { asunto: string; titulo: string; texto: string; boton: string }> = {
    formulario_completado: {
      asunto: `📋 Formulario completado — ${ctx.nombre}`,
      titulo: "✅ Formulario completado",
      texto: `<strong>${nombre}</strong> terminó de llenar su formulario${detalle ? ` (${detalle})` : ""}. El pedido está listo para pasar a diseño.`,
      boton: "Ver pedido en el panel →",
    },
    revision_aprobada: {
      asunto: `🎉 ¡${ctx.nombre} aprobó su invitación!`,
      titulo: "🎉 Invitación aprobada",
      texto: `<strong>${nombre}</strong> aprobó su invitación${detalle ? ` (${detalle})` : ""}. Quedó bloqueada contra cambios accidentales: ya se puede publicar.`,
      boton: "Ver invitación →",
    },
    revision_cambios: {
      asunto: `✏️ ${ctx.nombre} pidió cambios en su invitación`,
      titulo: "✏️ Cambios solicitados",
      texto: `<strong>${nombre}</strong> revisó su invitación y pidió cambios${detalle ? `: “${detalle}”` : ""}. Sus comentarios están en el panel.`,
      boton: "Ver comentarios →",
    },
    comentario_nuevo: {
      asunto: `💬 Comentario nuevo de ${ctx.nombre}`,
      titulo: "💬 Comentario nuevo",
      texto: `<strong>${nombre}</strong> dejó un comentario en su revisión${detalle ? ` (sección ${detalle})` : ""}.`,
      boton: "Ver comentario →",
    },
  };

  const p = piezas[tipo];
  return {
    asunto: p.asunto,
    cuerpo_html: plantillaCorreo(`
      <h1 style="font-size: 18px; color: #111; margin: 0 0 6px;">${p.titulo}</h1>
      <p style="font-size: 14px; color: #555; margin: 0 0 20px; line-height: 1.6;">${p.texto}</p>
      <a href="${url}"
         style="display: inline-block; background: #D4AF37; color: #000; text-decoration: none; font-weight: bold; font-size: 13px; padding: 12px 24px; border-radius: 10px;">
        ${p.boton}
      </a>`),
  };
}

export interface ReferenciaAviso {
  tipo: "pedido" | "invitacion" | "revision";
  id: string;
}

/**
 * Encola un aviso para todo el equipo (una fila por destinatario) e
 * intenta enviarlo YA, sin bloquear a quien llama. Si el intento no
 * llega, la fila queda pendiente y el repaso diario la barre.
 *
 * Sin NOTIFICACIONES_EMAIL configurado no se encola nada: una cola que
 * crece sin nadie que la reciba solo acumula basura.
 */
export async function encolarAvisoEquipo(
  admin: SupabaseClient,
  tipo: TipoAviso,
  ctx: ContextoAviso,
  referencia: ReferenciaAviso
): Promise<void> {
  const config = configuracionEnvio();
  if (!config) return;

  const { asunto, cuerpo_html } = construirAviso(tipo, ctx);
  const filas = config.destinatarios.map((destinatario) => ({
    tipo,
    canal: "email",
    destinatario,
    referencia_tipo: referencia.tipo,
    referencia_id: referencia.id,
    asunto,
    cuerpo_html,
  }));

  const { error } = await admin.from("avisos").insert(filas);
  if (error) {
    // Tabla aún sin migrar o fallo real: se anota y la operación sigue.
    registrarError("avisos", error, { tipo, codigo: error.code, paso: "encolar" });
    return;
  }

  // Intento inmediato, sin await de quien llama arriba: la petición del
  // cliente no debe esperar a Resend.
  procesarAvisosPendientes(admin, filas.length).catch((e) =>
    registrarError("avisos", e, { tipo, paso: "intento inmediato" })
  );
}

/**
 * Barre la bandeja: toma pendientes con intentos disponibles y los envía
 * uno a uno, anotando el resultado. La llama el cron diario (garantía) y
 * el intento inmediato tras encolar (rapidez). Reprocesar no duplica: un
 * aviso enviado deja de estar pendiente.
 */
export async function procesarAvisosPendientes(
  admin: SupabaseClient,
  maximo = 25
): Promise<{ enviados: number; fallidos: number }> {
  const { data, error } = await admin
    .from("avisos")
    .select("id, destinatario, asunto, cuerpo_html, intentos")
    .eq("estado", "pendiente")
    .lte("programado_en", new Date().toISOString())
    .order("programado_en")
    .limit(maximo);

  if (error) {
    registrarError("avisos", error, { codigo: error.code, paso: "listar" });
    return { enviados: 0, fallidos: 0 };
  }

  let enviados = 0;
  let fallidos = 0;

  for (const aviso of data ?? []) {
    const fallo = await enviarCorreo([aviso.destinatario], aviso.asunto, aviso.cuerpo_html);
    const intentos = aviso.intentos + 1;

    if (!fallo) {
      enviados++;
      await admin
        .from("avisos")
        .update({ estado: "enviado", intentos, error: null, enviado_en: new Date().toISOString() })
        .eq("id", aviso.id);
    } else {
      // Sigue pendiente mientras queden intentos; después, fallido y visible.
      const agotado = !debeReintentar(intentos);
      if (agotado) fallidos++;
      await admin
        .from("avisos")
        .update({ estado: agotado ? "fallido" : "pendiente", intentos, error: fallo })
        .eq("id", aviso.id);
    }
  }

  return { enviados, fallidos };
}
