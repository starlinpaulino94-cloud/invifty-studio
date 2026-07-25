import { PLANES, TIPOS_EVENTO, formatoFecha } from "./planes";
import { Plan, TipoEvento } from "./tipos";
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

interface DatosNotificacion {
  nombreCliente: string;
  telefonoCliente: string;
  tipoEvento: TipoEvento;
  plan: Plan;
  fechaEvento: string | null;
  pedidoId: string;
}

export async function notificarFormularioCompletado(datos: DatosNotificacion): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const destinatarios = (process.env.NOTIFICACIONES_EMAIL ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);

  if (!apiKey || destinatarios.length === 0) return;

  const remitente = process.env.NOTIFICACIONES_REMITENTE ?? "Invifty Studio <onboarding@resend.dev>";
  const urlBase = resolverUrlBase();
  const urlFicha = `${urlBase}/panel/pedidos/${datos.pedidoId}`;

  const evento = TIPOS_EVENTO[datos.tipoEvento];
  const plan = PLANES[datos.plan].nombre;

  const html = `
  <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; border: 1px solid #eee; border-radius: 12px; overflow: hidden;">
    <div style="background: #0D0D0F; padding: 24px; text-align: center;">
      <p style="color: #fff; font-size: 18px; letter-spacing: 4px; margin: 0;">INVIFTY</p>
      <p style="color: #D4AF37; font-size: 10px; letter-spacing: 3px; margin: 4px 0 0;">STUDIO</p>
    </div>
    <div style="padding: 28px;">
      <h1 style="font-size: 18px; color: #111; margin: 0 0 6px;">✅ Formulario completado</h1>
      <p style="font-size: 14px; color: #555; margin: 0 0 20px;">
        Un cliente terminó de llenar su formulario. El pedido está listo para pasar a diseño.
      </p>
      <table style="width: 100%; font-size: 14px; color: #111; border-collapse: collapse;">
        <tr><td style="padding: 6px 0; color: #999; width: 110px;">Cliente</td><td style="padding: 6px 0;"><strong>${datos.nombreCliente}</strong></td></tr>
        <tr><td style="padding: 6px 0; color: #999;">WhatsApp</td><td style="padding: 6px 0;">${datos.telefonoCliente}</td></tr>
        <tr><td style="padding: 6px 0; color: #999;">Evento</td><td style="padding: 6px 0;">${evento} · Plan ${plan}</td></tr>
        <tr><td style="padding: 6px 0; color: #999;">Fecha evento</td><td style="padding: 6px 0;">${datos.fechaEvento ? formatoFecha(datos.fechaEvento) : "Sin definir"}</td></tr>
      </table>
      <a href="${urlFicha}"
         style="display: inline-block; margin-top: 24px; background: #D4AF37; color: #000; text-decoration: none; font-weight: bold; font-size: 13px; padding: 12px 24px; border-radius: 10px;">
        Ver pedido en el panel →
      </a>
    </div>
  </div>`.trim();

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: remitente,
        to: destinatarios,
        subject: `📋 Formulario completado — ${datos.nombreCliente} (${evento}, Plan ${plan})`,
        html,
      }),
    });
    if (!res.ok) {
      console.error("Notificación Resend falló:", res.status, await res.text());
    }
  } catch (e) {
    // Nunca rompemos el flujo del cliente por un fallo de notificación
    console.error("Notificación Resend error:", e);
  }
}
