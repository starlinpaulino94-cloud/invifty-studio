import type { Plan, TipoEvento, EstadoPedido } from "./tipos";
import { fechaSinDiaSemana } from "./fechas";

/**
 * CATÁLOGO COMERCIAL DE INVIFTY — LA fuente de verdad
 * ====================================================
 * Edita AQUÍ precios, vigencias, límites y qué incluye cada plan. Todo lo
 * demás se deriva: el panel, los formularios, la API pública que consulta
 * la web (api/public/catalog) y los mensajes de WhatsApp leen de esto.
 * Cambiar un precio en dos sitios ya no es posible porque no HAY dos sitios.
 *
 * CADA CAPACIDAD DICE LA VERDAD sobre su estado:
 *  - "activa":  el sistema la cumple solo. Sale a la web.
 *  - "manual":  se vende y el equipo la cumple a mano (ej. bilingüe).
 *    También sale a la web: es real, aunque no esté automatizada.
 *  - "vendida_sin_implementar": la web la anuncia pero el sistema NO la
 *    tiene. NO sale por la API pública — así la brecha entre lo vendido y
 *    lo real se ve aquí, en una línea, en vez de descubrirla un cliente.
 *  - "no_disponible": apagada. No sale.
 */

export type EstadoCapacidad = "activa" | "manual" | "vendida_sin_implementar" | "no_disponible";

export interface Capacidad {
  id: string;
  nombre: string;
  estado: EstadoCapacidad;
}

export interface FichaPlan {
  nombre: string;
  descripcion: string;
  precioDOP: number;
  /**
   * VIGENCIA (meses desde la entrega). ESTE ES EL ÚNICO SITIO DONDE SE
   * CAMBIA: el repaso diario (lib/vencimientos.ts) apaga las invitaciones
   * solo. Política vigente: la misma que anuncia la página pública,
   * 3/6/9/12. Si vuelve a cambiar: (1) alinea la página pública, y (2) los
   * pedidos YA entregados llevan su fecha congelada — para aplicarles la
   * política nueva ejecuta scripts/recalcular-vencimientos.mts (primero sin
   * argumentos para simular, luego con --aplicar); solo alarga, nunca acorta.
   */
  vigenciaMeses: number;
  /** Fotos que puede subir el cliente. Infinity = sin límite. */
  limiteFotos: number;
  /**
   * Revisiones incluidas. null = DECISIÓN COMERCIAL PENDIENTE: nadie la ha
   * tomado y no la inventamos. Mientras sea null, no se anuncia.
   */
  revisiones: number | null;
  capacidades: Capacidad[];
}

/** Cámbiala al editar el catálogo: es la versión que ve la web (ETag). */
export const CATALOGO_ACTUALIZADO = "2026-08-26";

const cap = (id: string, nombre: string, estado: EstadoCapacidad = "activa"): Capacidad =>
  ({ id, nombre, estado });

const BASE: Capacidad[] = [
  cap("invitacion_interactiva", "Invitación digital interactiva"),
  cap("cuenta_regresiva", "Cuenta regresiva al evento"),
  cap("ubicacion_maps", "Ubicación con Google Maps y Waze"),
  cap("dress_code", "Código de vestimenta"),
  cap("calendario", "Botón «guardar la fecha» (Google y Apple)"),
  cap("vista_whatsapp", "Vista previa al compartir por WhatsApp"),
];

const CON_RSVP: Capacidad[] = [
  cap("rsvp", "Confirmación de asistencia en línea"),
  cap("panel_confirmaciones", "Panel del anfitrión: quién viene y quién falta"),
  cap("musica", "Música de fondo"),
  cap("historia", "Sección de historia de la pareja o del evento"),
];

export const CATALOGO: Record<Plan, FichaPlan> = {
  esencial: {
    nombre: "Esencial",
    descripcion: "Toda la información del evento en un enlace elegante.",
    precioDOP: 1200,
    vigenciaMeses: 3,
    limiteFotos: 0,
    revisiones: null,
    capacidades: BASE,
  },
  popular: {
    nombre: "Popular",
    descripcion: "La invitación completa, con confirmaciones y fotos.",
    precioDOP: 2500,
    vigenciaMeses: 6,
    limiteFotos: 15,
    revisiones: null,
    capacidades: [...BASE, ...CON_RSVP, cap("galeria_15", "Galería de hasta 15 fotos")],
  },
  premium: {
    nombre: "Premium",
    descripcion: "Sin límites de fotos, con itinerario y mesa de regalos.",
    precioDOP: 4000,
    vigenciaMeses: 9,
    limiteFotos: Infinity,
    revisiones: null,
    capacidades: [
      ...BASE,
      ...CON_RSVP,
      cap("galeria_ilimitada", "Galería sin límite de fotos"),
      cap("cronograma", "Itinerario del evento"),
      cap("regalos", "Mesa de regalos y cuentas"),
      // La web los anuncia; el sistema todavía no los tiene. NO salen por
      // la API pública hasta que existan o se decida quitarlos de la venta.
      cap("qr_individual", "Código QR individual por invitado", "vendida_sin_implementar"),
      cap("recordatorios", "Recordatorios a los invitados", "vendida_sin_implementar"),
    ],
  },
  luxury: {
    nombre: "Luxury",
    descripcion: "Diseño a medida, video de portada y dominio propio.",
    precioDOP: 6500,
    vigenciaMeses: 12,
    limiteFotos: Infinity,
    revisiones: null,
    capacidades: [
      ...BASE,
      ...CON_RSVP,
      cap("galeria_ilimitada", "Galería sin límite de fotos"),
      cap("cronograma", "Itinerario del evento"),
      cap("regalos", "Mesa de regalos y cuentas"),
      cap("video_portada", "Video en bucle de portada"),
      cap("dominio_propio", "Dominio web propio"),
      cap("diseno_personalizado", "Diseño personalizado a medida", "manual"),
      // Desde 2026-08-26 el sistema la tiene de verdad: /galeria/<slug>.
      cap("galeria_post_evento", "Galería colaborativa del evento"),
    ],
  },
};

/* ---------- Derivados: la forma que el resto del código ya conocía ---------- */

const porPlan = <T,>(f: (ficha: FichaPlan) => T): Record<Plan, T> =>
  Object.fromEntries(
    Object.entries(CATALOGO).map(([id, ficha]) => [id, f(ficha)])
  ) as Record<Plan, T>;

export const PLANES: Record<Plan, { nombre: string; precioDOP: number }> = porPlan(
  (p) => ({ nombre: p.nombre, precioDOP: p.precioDOP })
);

export const VIGENCIA_MESES: Record<Plan, number> = porPlan((p) => p.vigenciaMeses);

export const LIMITE_FOTOS: Record<Plan, number> = porPlan((p) => p.limiteFotos);

export const EXTRAS: { id: string; nombre: string; precioDOP: number; estado: EstadoCapacidad }[] = [
  { id: "bilingue", nombre: "Versión Bilingüe / Inglés", precioDOP: 900, estado: "manual" },
  { id: "dominio_propio", nombre: "Dominio Web Propio", precioDOP: 1500, estado: "activa" },
  { id: "galeria_post_evento", nombre: "Galería Post-Evento", precioDOP: 900, estado: "activa" },
  { id: "urgente_24h", nombre: "Entrega Urgente 24h", precioDOP: 800, estado: "manual" },
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
  { id: "cancelado", nombre: "Cancelado", color: "bg-gray-200 text-gray-500" },
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
