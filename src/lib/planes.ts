import type { Plan, TipoEvento, EstadoPedido } from "./tipos";
import { fechaSinDiaSemana } from "./fechas";

/**
 * CONFIGURACIÓN COMERCIAL DE INVIFTY
 * Edita aquí precios de referencia, duraciones y límites por plan.
 */

export const PLANES: Record<Plan, { nombre: string; precioDOP: number }> = {
  esencial: { nombre: "Esencial", precioDOP: 1200 },
  popular: { nombre: "Popular", precioDOP: 2500 },
  premium: { nombre: "Premium", precioDOP: 4000 },
  luxury: { nombre: "Luxury", precioDOP: 6500 },
};

/**
 * VIGENCIA DE LA INVITACIÓN (meses desde la entrega)
 * ===================================================
 * ⚠️ DECISIÓN PENDIENTE — ESTE ES EL ÚNICO SITIO DONDE SE CAMBIA.
 *
 * Ahora mismo hay una contradicción abierta:
 *   · aquí está configurado    3 / 3 / 3 / 12 meses
 *   · la página pública anuncia 3 / 6 / 9 / 12 meses
 *
 * Manda lo que diga este archivo: desde que el repaso diario funciona
 * (ver lib/vencimientos.ts), el sistema apaga las invitaciones solo. Con
 * la configuración actual, un cliente Premium que compró creyendo que
 * tenía 9 meses se queda sin invitación a los 3.
 *
 * Al cambiar estos números:
 *   1. Alinea la página pública para que anuncie lo mismo.
 *   2. Los pedidos YA entregados llevan su fecha congelada; para
 *      aplicarles la política nueva ejecuta:
 *        node --experimental-strip-types --env-file=.env.local \
 *          scripts/recalcular-vencimientos.mts
 *      (primero sin argumentos para simular, luego con --aplicar).
 *      Ese script solo alarga, nunca acorta.
 */
export const VIGENCIA_MESES: Record<Plan, number> = {
  esencial: 3,
  popular: 3,
  premium: 3,
  luxury: 12,
};

/** Límite de fotos que puede subir el cliente en su formulario. Infinity = sin límite. */
export const LIMITE_FOTOS: Record<Plan, number> = {
  esencial: 0,
  popular: 15,
  premium: Infinity,
  luxury: Infinity,
};

export const EXTRAS: { id: string; nombre: string; precioDOP: number }[] = [
  { id: "bilingue", nombre: "Versión Bilingüe / Inglés", precioDOP: 900 },
  { id: "dominio_propio", nombre: "Dominio Web Propio", precioDOP: 1500 },
  { id: "galeria_post_evento", nombre: "Galería Post-Evento", precioDOP: 900 },
  { id: "urgente_24h", nombre: "Entrega Urgente 24h", precioDOP: 800 },
];

export const TIPOS_EVENTO: Record<TipoEvento, string> = {
  boda: "Boda",
  cumpleanos: "Cumpleaños",
  empresarial: "Empresarial",
  otro: "Otro",
};

export const ESTADOS: { id: EstadoPedido; nombre: string; color: string }[] = [
  { id: "nuevo", nombre: "Nuevo", color: "bg-slate-200 text-slate-700" },
  { id: "formulario_enviado", nombre: "Formulario enviado", color: "bg-sky-100 text-sky-700" },
  { id: "formulario_completado", nombre: "Formulario completado", color: "bg-violet-100 text-violet-700" },
  { id: "en_diseno", nombre: "En diseño", color: "bg-amber-100 text-amber-700" },
  { id: "revision_cliente", nombre: "Revisión del cliente", color: "bg-orange-100 text-orange-700" },
  { id: "entregada", nombre: "Entregada", color: "bg-emerald-100 text-emerald-700" },
  { id: "activa", nombre: "Activa", color: "bg-green-100 text-green-700" },
  { id: "vencida", nombre: "Vencida", color: "bg-red-100 text-red-600" },
];

export function nombreEstado(id: EstadoPedido): string {
  return ESTADOS.find((e) => e.id === id)?.nombre ?? id;
}

export function colorEstado(id: EstadoPedido): string {
  return ESTADOS.find((e) => e.id === id)?.color ?? "bg-slate-200 text-slate-700";
}

export function formatoDOP(monto: number): string {
  return `RD$ ${Number(monto).toLocaleString("es-DO", { minimumFractionDigits: 0 })}`;
}

export function formatoFecha(fecha: string | null | undefined): string {
  if (!fecha) return "—";
  const d = new Date(fecha.includes("T") ? fecha : fecha + "T12:00:00");
  return d.toLocaleDateString("es-DO", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Mensaje para ofrecerle al cliente la renovación antes de que su
 * invitación deje de estar en línea. Se copia desde la vista Vencimientos.
 */
export function mensajeWhatsAppRenovacion(
  nombreCliente: string,
  plan: Plan,
  fechaVencimiento: string,
  urlInvitacion: string | null
): string {
  const primerNombre = nombreCliente.split(" ")[0];
  return (
    `¡Hola ${primerNombre}! 💛 Te escribimos de Invifty.\n\n` +
    // fechaSinDiaSemana en vez de formatoFecha: este mensaje lo lee el
    // cliente, y "30 de junio de 2026" se lee mejor que "30 jun de 2026".
    `Tu invitación digital estará en línea hasta el *${fechaSinDiaSemana(fechaVencimiento)}*. ` +
    `Después de esa fecha el enlace deja de funcionar.\n\n` +
    (urlInvitacion ? `${urlInvitacion}\n\n` : "") +
    `Si quieres conservarla más tiempo —para que tus invitados sigan viendo las fotos ` +
    `y los recuerdos del evento— podemos renovarla. Cuéntanos y te pasamos las opciones. ` +
    `Tu plan actual es *${PLANES[plan].nombre}*. ¡Fue un placer ser parte de tu celebración! ✨`
  );
}

/** Mensaje amigable para enviar el link del formulario por WhatsApp. */
export function mensajeWhatsAppFormulario(nombreCliente: string, plan: Plan, urlFormulario: string): string {
  const primerNombre = nombreCliente.split(" ")[0];
  return (
    `¡Hola ${primerNombre}! 🎉 Gracias por confiar en Invifty para tu invitación digital.\n\n` +
    `Para comenzar a diseñarla, completa este formulario con los datos de tu celebración ` +
    `(puedes llenarlo desde tu celular y guardar tu progreso en cualquier momento):\n\n` +
    `✨ ${urlFormulario}\n\n` +
    `Tu plan *${PLANES[plan].nombre}* incluye todo lo que necesitas. ` +
    `Cuando termines, nuestro equipo comienza el diseño de inmediato. ¡Cualquier duda estamos aquí! 💛`
  );
}
