import { CATALOGO } from "./planes";
import { normalizarTelefono, telefonoValido } from "./telefono";
import type { Plan } from "./tipos";

/**
 * VALIDACIÓN DE LEADS — la aduana de POST /api/public/leads
 * ==========================================================
 * Es la ruta pública más golpeable del sistema: recibe texto de cualquiera,
 * sin sesión ni token. Todo lo que entra pasa por aquí, en una función pura
 * que se prueba con lupa, y la ruta solo hace de cartero.
 *
 * Filosofía: mejor rechazar de más que guardar basura. Un lead con teléfono
 * inválido no sirve para nada — no se le puede escribir — así que dejarlo
 * pasar solo ensucia el panel del equipo.
 */

export const ESTADOS_LEAD = ["nuevo", "contactado", "calificado", "convertido", "perdido"] as const;
export type EstadoLead = (typeof ESTADOS_LEAD)[number];

const MAX_NOMBRE = 100;
const MAX_MENSAJE = 1000;
const MAX_FUENTE = 60;
const MAX_UTM = 120;

export interface LeadValidado {
  nombre: string;
  telefono: string;
  tipo_evento: string;
  fecha_evento: string | null;
  plan_id: Plan | null;
  demo_slug: string | null;
  mensaje: string | null;
  idioma: "es" | "en";
  fuente: string;
  utm: Record<string, string>;
  consentimiento: boolean;
  clave_idempotencia: string;
}

export type ResultadoLead =
  | { ok: true; lead: LeadValidado }
  | { ok: false; error: string };

const texto = (v: unknown, max: number): string =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

export function validarLead(body: unknown): ResultadoLead {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Datos inválidos" };
  }
  const b = body as Record<string, unknown>;

  const nombre = texto(b.nombre, MAX_NOMBRE);
  if (nombre.length < 2) return { ok: false, error: "Escribe el nombre completo." };

  const telefono = normalizarTelefono(texto(b.telefono, 30));
  if (!telefonoValido(telefono)) {
    return { ok: false, error: "El teléfono no parece válido. Revísalo, es como te contactaremos." };
  }

  const tipoEvento = texto(b.tipo_evento, 40).toLowerCase();
  if (!tipoEvento) return { ok: false, error: "Falta el tipo de evento." };

  // Fecha opcional, pero si viene tiene que ser una fecha de verdad.
  let fechaEvento: string | null = null;
  if (b.fecha_evento !== undefined && b.fecha_evento !== null && b.fecha_evento !== "") {
    const f = texto(b.fecha_evento, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f) || Number.isNaN(Date.parse(f))) {
      return { ok: false, error: "La fecha del evento no es válida." };
    }
    fechaEvento = f;
  }

  // Plan opcional, pero si viene tiene que existir en el catálogo: un plan
  // inventado es un bot o una web desactualizada, y ambos deben notarse.
  let planId: Plan | null = null;
  if (b.plan_id !== undefined && b.plan_id !== null && b.plan_id !== "") {
    const pedido = texto(b.plan_id, 30);
    if (!(pedido in CATALOGO)) return { ok: false, error: "Ese plan no existe." };
    planId = pedido as Plan;
  }

  const idioma = b.idioma === "en" ? "en" : "es";

  const fuente = texto(b.fuente, MAX_FUENTE) || "web";

  // Sin consentimiento no hay lead: es un dato personal que alguien nos
  // confía para que le escribamos, no un formulario decorativo.
  if (b.consentimiento !== true) {
    return { ok: false, error: "Falta aceptar el aviso de contacto." };
  }

  // La clave la genera la web (un UUID por envío). Es lo que convierte el
  // doble clic en un solo lead. Sin forma válida, se rechaza.
  const clave = texto(b.clave_idempotencia, 64);
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(clave)) {
    return { ok: false, error: "Falta la clave de envío." };
  }

  // UTM: solo las cinco llaves conocidas, como texto corto. Lo demás se
  // descarta sin drama — es atribución, no contenido.
  const utm: Record<string, string> = {};
  if (b.utm && typeof b.utm === "object" && !Array.isArray(b.utm)) {
    for (const llave of ["source", "medium", "campaign", "content", "term"]) {
      const valor = texto((b.utm as Record<string, unknown>)[llave], MAX_UTM);
      if (valor) utm[llave] = valor;
    }
  }

  return {
    ok: true,
    lead: {
      nombre,
      telefono,
      tipo_evento: tipoEvento,
      fecha_evento: fechaEvento,
      plan_id: planId,
      demo_slug: texto(b.demo_slug, 80) || null,
      mensaje: texto(b.mensaje, MAX_MENSAJE) || null,
      idioma,
      fuente,
      utm,
      consentimiento: true,
      clave_idempotencia: clave,
    },
  };
}
