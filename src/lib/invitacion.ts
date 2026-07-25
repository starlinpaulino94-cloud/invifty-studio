import { DatosInvitacion, TipoEvento } from "./tipos";

/**
 * FASE 2 — Generación de la invitación desde las respuestas.
 * Este módulo convierte las respuestas crudas del formulario en el
 * contenido inicial de la invitación (que el equipo luego ajusta en
 * el editor antes de publicar).
 */

/** Paletas visuales de la plantilla. El id coincide con las opciones del formulario. */
export const PALETAS_INVITACION: Record<
  string,
  { nombre: string; fondo: string; tarjeta: string; acento: string; texto: string; textoSuave: string }
> = {
  dorado_negro: {
    nombre: "Dorado & Negro",
    fondo: "#0F0F0F", tarjeta: "#171717", acento: "#D4AF37", texto: "#F5F2EA", textoSuave: "#B7B0A0",
  },
  blanco_verde: {
    nombre: "Blanco & Verde Olivo",
    fondo: "#FAF8F5", tarjeta: "#FFFFFF", acento: "#6B7F5E", texto: "#2A2A25", textoSuave: "#7C7C72",
  },
  rosa_dorado: {
    nombre: "Rose Gold & Crema",
    fondo: "#FFF7F0", tarjeta: "#FFFFFF", acento: "#C98A90", texto: "#3A2E2E", textoSuave: "#9C8A8A",
  },
  azul_plata: {
    nombre: "Azul Noche & Plata",
    fondo: "#101A30", tarjeta: "#182444", acento: "#AFC3D6", texto: "#EFF3F8", textoSuave: "#93A3B8",
  },
  terracota: {
    nombre: "Terracota & Beige",
    fondo: "#F6EDE3", tarjeta: "#FFFDF9", acento: "#C1683C", texto: "#4A3526", textoSuave: "#94806E",
  },
  vino_nude: {
    nombre: "Vino & Nude",
    fondo: "#F8F1EC", tarjeta: "#FFFFFF", acento: "#722F37", texto: "#3B2A2C", textoSuave: "#8E7A7C",
  },
};

export const PALETA_POR_DEFECTO = "dorado_negro";

function texto(r: Record<string, unknown>, id: string): string {
  const v = r[id];
  return typeof v === "string" ? v.trim() : "";
}

function lista(r: Record<string, unknown>, id: string): Record<string, string>[] {
  const v = r[id];
  return Array.isArray(v) ? (v as Record<string, string>[]) : [];
}

function paletaValida(id: string): string {
  return PALETAS_INVITACION[id] ? id : PALETA_POR_DEFECTO;
}

/** Convierte texto a slug de URL: "Camila & Lucas" → "camila-y-lucas" */
export function slugificar(t: string): string {
  return t
    .toLowerCase()
    .replace(/&/g, " y ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "invitacion";
}

/**
 * Construye el contenido inicial de la invitación desde las respuestas
 * del formulario, según el tipo de evento.
 */
export function derivarDatosInvitacion(
  tipoEvento: TipoEvento,
  respuestas: Record<string, unknown>,
  telefonoCliente: string,
  fechaEventoPedido: string | null
): DatosInvitacion {
  const r = respuestas;

  // Valores del RSVP configurado en el formulario
  const rsvpRaw = (r["config_rsvp"] ?? {}) as { fecha_limite?: string; acompanantes?: string };

  const base: DatosInvitacion = {
    titulo: "",
    subtitulo: "",
    frase: texto(r, "frase_portada"),
    fechaEvento: fechaEventoPedido ?? "",
    horaEvento: "",
    lugares: [],
    dressCode: texto(r, "dress_code"),
    paleta: paletaValida(texto(r, "paleta_colores")),
    historia: "",
    cronograma: lista(r, "hitos_dia")
      .filter((h) => h.actividad)
      .map((h) => ({ hora: h.hora ?? "", actividad: h.actividad ?? "" })),
    regalos: lista(r, "mesa_regalos")
      .filter((g) => g.titulo || g.detalle)
      .map((g) => ({ titulo: g.titulo ?? "", detalle: g.detalle ?? "" })),
    rsvp: {
      whatsapp: telefonoCliente,
      fechaLimite: rsvpRaw.fecha_limite ?? "",
      acompanantes: rsvpRaw.acompanantes !== "no",
    },
    secciones: { historia: false, galeria: true, cronograma: false, regalos: false, rsvp: true },
  };

  switch (tipoEvento) {
    case "boda": {
      base.titulo = texto(r, "nombres_novios") || "Nuestra Boda";
      base.subtitulo = "¡Nos casamos!";
      base.fechaEvento = texto(r, "fecha_boda") || base.fechaEvento;
      base.horaEvento = texto(r, "hora_ceremonia");
      base.historia = texto(r, "historia_pareja");
      const ceremonia = texto(r, "lugar_ceremonia");
      const recepcion = texto(r, "lugar_recepcion");
      if (ceremonia) base.lugares.push({ nombre: "Ceremonia", detalle: ceremonia });
      if (recepcion && !/mismo lugar/i.test(recepcion)) {
        base.lugares.push({ nombre: "Recepción", detalle: recepcion });
      }
      break;
    }
    case "cumpleanos": {
      const nombre = texto(r, "nombre_festejado") || "La Celebración";
      const edad = texto(r, "edad_festejado");
      base.titulo = edad ? `${nombre} — ${edad} Años` : nombre;
      base.subtitulo = "¡Estás invitado a celebrar!";
      base.fechaEvento = texto(r, "fecha_fiesta") || base.fechaEvento;
      base.horaEvento = texto(r, "hora_fiesta");
      const lugar = texto(r, "lugar_fiesta");
      if (lugar) base.lugares.push({ nombre: "La Fiesta", detalle: lugar });
      break;
    }
    case "empresarial": {
      base.titulo = texto(r, "nombre_evento") || "Evento Corporativo";
      base.subtitulo = texto(r, "nombre_empresa") || "";
      base.fechaEvento = texto(r, "fecha_evento_corp") || base.fechaEvento;
      base.horaEvento = texto(r, "hora_evento_corp");
      const lugar = texto(r, "lugar_evento_corp");
      if (lugar) base.lugares.push({ nombre: "El Evento", detalle: lugar });
      break;
    }
    default: {
      base.titulo = texto(r, "nombre_evento") || "Nuestra Celebración";
      base.subtitulo = texto(r, "anfitriones") ? `Te invitan: ${texto(r, "anfitriones")}` : "¡Estás invitado!";
      base.fechaEvento = texto(r, "fecha_fiesta") || base.fechaEvento;
      base.horaEvento = texto(r, "hora_fiesta");
      const lugar = texto(r, "lugar_fiesta");
      if (lugar) base.lugares.push({ nombre: "El Lugar", detalle: lugar });
    }
  }

  // Activar secciones según lo que el cliente completó
  base.secciones.historia = base.historia.length > 0;
  base.secciones.cronograma = base.cronograma.length > 0;
  base.secciones.regalos = base.regalos.length > 0;

  return base;
}
