import { estadoDeCapacidad, type ContratoCapacidades } from "./capacidades";
import { fechaSinDiaSemana } from "./fechas";

/**
 * RECORDATORIOS A LOS INVITADOS — la lógica pura
 * ===============================================
 * La capacidad que Premium vendía sin tener, cumplida al estilo del
 * negocio: el sistema GENERA los mensajes personalizados (cada hogar con
 * su nombre, su enlace y los días que faltan) y el ANFITRIÓN los reenvía
 * por WhatsApp en dos toques. Quien conoce a sus invitados es él; lo
 * pesado —redactar bien, poner el enlace correcto, no olvidar a nadie—
 * lo hace el sistema.
 *
 * El envío automatizado (WhatsApp Business API) puede venir después; no
 * hace falta para que la promesa vendida sea verdad.
 */

/** ¿Este contrato incluye recordatorios? Igual que la galería: los
 * contratos viejos que la pagaron como promesa también la tienen. */
export function tieneRecordatorios(contrato: ContratoCapacidades): boolean {
  const estado = estadoDeCapacidad(contrato, "recordatorios");
  return estado === "activa" || estado === "vendida_sin_implementar";
}

/** Días completos que faltan para la fecha (0 = es hoy; negativo = pasó). */
export function diasHasta(fecha: string, ahora: Date): number {
  const evento = new Date(fecha + "T00:00:00");
  const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  return Math.round((evento.getTime() - hoy.getTime()) / (24 * 60 * 60 * 1000));
}

export interface HogarParaRecordar {
  id: string;
  nombre: string;
  token: string;
}

/**
 * Los hogares que AÚN no confirman: los destinatarios naturales del
 * recordatorio. Un hogar con cualquier confirmación (sí o no) ya
 * respondió y no se le insiste.
 */
export function hogaresSinConfirmar<T extends { id: string }>(
  hogares: T[],
  hogaresQueRespondieron: Set<string>
): T[] {
  return hogares.filter((h) => !hogaresQueRespondieron.has(h.id));
}

/** La frase de urgencia según cuánto falta. */
function fraseDeDias(dias: number): string {
  if (dias <= 0) return "¡es HOY!";
  if (dias === 1) return "¡es MAÑANA!";
  if (dias <= 7) return `faltan solo ${dias} días`;
  return `faltan ${dias} días`;
}

/**
 * Recordatorio de CONFIRMACIÓN, personalizado por hogar: para los que no
 * han respondido, con su enlace personal (el RSVP ya sabe quiénes son).
 */
export function mensajeRecordatorioConfirmacion(ctx: {
  nombreHogar: string;
  titulo: string;
  fechaEvento: string | null;
  url: string;
  fechaLimite?: string | null;
  ahora: Date;
}): string {
  const dias = ctx.fechaEvento ? diasHasta(ctx.fechaEvento, ctx.ahora) : null;
  return (
    `¡Hola! 💛 Les escribimos por *${ctx.titulo}*` +
    (dias !== null && dias >= 0 ? ` — ${fraseDeDias(dias)}` : "") +
    `.\n\n` +
    `Aún no tenemos su confirmación y nos encantaría contar con ustedes. ` +
    `Confirmen aquí en un minuto:\n\n` +
    `✨ ${ctx.url}\n\n` +
    (ctx.fechaLimite
      ? `Por favor respondan antes del *${fechaSinDiaSemana(ctx.fechaLimite)}* para reservar sus lugares. `
      : "") +
    `¡Los esperamos!`
  );
}

/**
 * Recordatorio GENERAL del evento (para difusión, estados o grupos):
 * sin nombre de hogar, con el enlace público de la invitación.
 */
export function mensajeRecordatorioEvento(ctx: {
  titulo: string;
  fechaEvento: string | null;
  url: string;
  ahora: Date;
}): string {
  const dias = ctx.fechaEvento ? diasHasta(ctx.fechaEvento, ctx.ahora) : null;
  return (
    `🎉 *${ctx.titulo}*` +
    (dias !== null && dias >= 0 ? ` — ${fraseDeDias(dias)}` : "") +
    `\n\n` +
    (ctx.fechaEvento ? `📅 ${fechaSinDiaSemana(ctx.fechaEvento)}\n\n` : "") +
    `Toda la información del evento está aquí:\n\n` +
    `✨ ${ctx.url}\n\n` +
    `¡Nos vemos pronto!`
  );
}
