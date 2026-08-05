import { PLANES, formatoFecha } from "./planes";
import type { Plan } from "./tipos";
import { urlBase as resolverUrlBase } from "./url";

/**
 * NOTIFICACIONES POR EMAIL (Resend)
 * ==================================
 * Para activarlas:
 *  1. Crea una cuenta gratis en resend.com (3,000 emails/mes gratis).
 *  2. Copia tu API key en la variable de entorno RESEND_API_KEY.
 *  3. Pon el/los correos del equipo en NOTIFICACIONES_EMAIL (separados por coma).
 *
 * Sin esas variables, el sistema simplemente no envía nada (no falla).
 *
 * Remitente: por defecto usa onboarding@resend.dev, que funciona sin
 * configurar nada pero SOLO permite enviar al correo dueño de la cuenta
 * de Resend. Para enviar a todo el equipo con un remitente propio
 * (ej. studio@invifty.com), verifica tu dominio en Resend → Domains y
 * define NOTIFICACIONES_REMITENTE="Invifty Studio <studio@invifty.com>".
 */

/**
 * Escapa el texto que se inserta en el HTML del correo. Los datos vienen de
 * la ficha del cliente, así que un nombre como «Joyería Pérez & Hijos»
 * rompería el formato del email sin esto.
 */
export function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Configuración de envío, o null si el equipo no la ha activado. */
export function configuracionEnvio(): { apiKey: string; destinatarios: string[]; remitente: string } | null {
  const apiKey = process.env.RESEND_API_KEY;
  const destinatarios = (process.env.NOTIFICACIONES_EMAIL ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);

  if (!apiKey || destinatarios.length === 0) return null;

  return {
    apiKey,
    destinatarios,
    remitente: process.env.NOTIFICACIONES_REMITENTE ?? "Invifty Studio <onboarding@resend.dev>",
  };
}

/** Envuelve el contenido en la cabecera de marca. */
export function plantillaCorreo(contenido: string): string {
  return `
  <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; border: 1px solid #eee; border-radius: 12px; overflow: hidden;">
    <div style="background: #0D0D0F; padding: 24px; text-align: center;">
      <p style="color: #fff; font-size: 18px; letter-spacing: 4px; margin: 0;">INVIFTY</p>
      <p style="color: #D4AF37; font-size: 10px; letter-spacing: 3px; margin: 4px 0 0;">STUDIO</p>
    </div>
    <div style="padding: 28px;">${contenido}</div>
  </div>`.trim();
}

/**
 * Envía un correo a destinatarios concretos. Devuelve el error como texto
 * (o null si salió): la bandeja de salida (lib/avisos.ts) guarda ese texto
 * en la fila para poder responder "¿por qué no llegó?".
 */
export async function enviarCorreo(
  destinatarios: string[],
  asunto: string,
  html: string
): Promise<string | null> {
  const config = configuracionEnvio();
  if (!config) return "Envío sin configurar (RESEND_API_KEY / NOTIFICACIONES_EMAIL)";

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: config.remitente,
        to: destinatarios,
        subject: asunto,
        html,
      }),
    });
    if (!res.ok) {
      const detalle = `Resend ${res.status}: ${(await res.text()).slice(0, 300)}`;
      console.error("Notificación falló:", detalle);
      return detalle;
    }
    return null;
  } catch (e) {
    // Nunca rompemos el flujo por un fallo de notificación
    console.error("Notificación Resend error:", e);
    return e instanceof Error ? e.message : "Error de red";
  }
}

/** Envía a todo el equipo configurado. Devuelve true solo si salió. */
async function enviar(asunto: string, html: string): Promise<boolean> {
  const config = configuracionEnvio();
  if (!config) return false;
  return (await enviarCorreo(config.destinatarios, asunto, html)) === null;
}

/*
 * El aviso de "formulario completado" ya no se envía desde aquí: viaja por
 * la bandeja de salida (lib/avisos.ts), que reintenta si Resend falla.
 */

/* ============================================================
   AVISO DE VENCIMIENTOS (repaso diario)
   ============================================================ */

export interface PedidoPorVencer {
  pedidoId: string;
  nombreCliente: string;
  plan: Plan;
  fechaVencimiento: string;
  diasRestantes: number;
}

/**
 * Un solo correo con todo lo que está por vencer, en vez de uno por pedido.
 * Devuelve true solo si el correo salió: quien llama no debe dar por
 * avisado un pedido cuyo aviso nunca se envió.
 */
export async function notificarVencimientosProximos(
  pedidos: PedidoPorVencer[]
): Promise<boolean> {
  if (!pedidos.length) return false;

  const urlBase = resolverUrlBase();

  const filas = pedidos
    .map(
      (p) => `
      <tr>
        <td style="padding: 10px 0; border-top: 1px solid #eee;">
          <a href="${urlBase}/panel/pedidos/${p.pedidoId}" style="color:#111; font-weight:bold; text-decoration:none;">
            ${escaparHtml(p.nombreCliente)}
          </a>
          <span style="color:#999; font-size:12px;"> · Plan ${PLANES[p.plan].nombre}</span>
        </td>
        <td style="padding: 10px 0; border-top: 1px solid #eee; text-align:right; white-space:nowrap;">
          <strong style="color:${p.diasRestantes <= 7 ? "#C2410C" : "#B08D2A"};">
            ${p.diasRestantes === 0 ? "vence hoy" : `${p.diasRestantes} día${p.diasRestantes === 1 ? "" : "s"}`}
          </strong>
          <span style="color:#999; font-size:12px; display:block;">${formatoFecha(p.fechaVencimiento)}</span>
        </td>
      </tr>`
    )
    .join("");

  const html = plantillaCorreo(`
      <h1 style="font-size: 18px; color: #111; margin: 0 0 6px;">⏳ Invitaciones por vencer</h1>
      <p style="font-size: 14px; color: #555; margin: 0 0 16px;">
        ${pedidos.length === 1 ? "Una invitación está" : `${pedidos.length} invitaciones están`}
        cerca de su fecha de vencimiento. Es el mejor momento para ofrecer la renovación:
        desde la vista Vencimientos puedes copiar el mensaje ya escrito.
      </p>
      <table style="width: 100%; font-size: 14px; color: #111; border-collapse: collapse;">
        ${filas}
      </table>
      <a href="${urlBase}/panel/vencimientos"
         style="display: inline-block; margin-top: 24px; background: #D4AF37; color: #000; text-decoration: none; font-weight: bold; font-size: 13px; padding: 12px 24px; border-radius: 10px;">
        Ver vencimientos →
      </a>`);

  return enviar(
    `⏳ ${pedidos.length} invitación${pedidos.length === 1 ? "" : "es"} por vencer — Invifty Studio`,
    html
  );
}
