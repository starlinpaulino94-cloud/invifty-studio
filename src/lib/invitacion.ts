import { DatosInvitacion, Plan, TipoEvento } from "./tipos";
import { PALETAS, PALETA_POR_DEFECTO, esPaletaValida } from "@/config/diseno";
import { PLANTILLAS, plantillaMeta } from "@/config/plantillas";

/**
 * FASE 2 — Generación de la invitación desde las respuestas.
 * Convierte las respuestas crudas del formulario en el contenido inicial
 * de la invitación, eligiendo plantilla, paleta y tipografía coherentes
 * con lo que pidió el cliente. El equipo lo ajusta en el editor.
 */

/* ---------- Ayudantes de lectura ---------- */

function texto(r: Record<string, unknown>, id: string): string {
  const v = r[id];
  return typeof v === "string" ? v.trim() : "";
}

function lista(r: Record<string, unknown>, id: string): Record<string, string>[] {
  const v = r[id];
  return Array.isArray(v) ? (v as Record<string, string>[]) : [];
}

/**
 * Etiqueta legible de una respuesta de paleta que el sistema no puede aplicar
 * tal cual (ej. "Los colores de nuestra marca", o una paleta de una versión
 * anterior del formulario). Se usa para avisar al equipo en vez de descartarla.
 */
const PALETAS_SIN_EQUIVALENTE: Record<string, string> = {
  colores_marca: "Los colores de su marca (tomarlos del logo que subió)",
};

function etiquetaPaletaPedida(id: string): string {
  return PALETAS_SIN_EQUIVALENTE[id] ?? `"${id}"`;
}

/** Convierte texto a slug de URL: "Camila & Lucas" → "camila-y-lucas" */
export function slugificar(t: string): string {
  return (
    t
      .toLowerCase()
      .replace(/&/g, " y ")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "invitacion"
  );
}

/* ---------- Elección de plantilla ---------- */

/**
 * Sugiere la plantilla según el estilo que eligió el cliente en el
 * formulario y el tipo de evento. El equipo puede cambiarla luego.
 */
export function sugerirPlantilla(tipoEvento: TipoEvento, respuestas: Record<string, unknown>): string {
  const estilo = texto(respuestas, "estilo_diseno") || texto(respuestas, "tema_fiesta");

  const porEstilo: Record<string, string> = {
    // Bodas
    clasico_elegante: "editorial",
    romantico_floral: "acuarela",
    rustico: "boho",
    minimalista: "arco",
    tropical: "tropical",
    // Cumpleaños y 15 años
    elegante_gala: "deco",
    quince_princesa: "celestial",
    neon_fiesta: "cinema",
    vintage: "deco",
    // Otros eventos
    elegante: "editorial",
    tierno: "acuarela",
    festivo: "boho",
  };
  if (porEstilo[estilo]) return porEstilo[estilo];

  const porEvento: Record<TipoEvento, string> = {
    boda: "editorial",
    cumpleanos: "deco",
    empresarial: "moderna",
    otro: "botanica",
  };
  return porEvento[tipoEvento] ?? "editorial";
}

/** Plantillas disponibles agrupadas para el catálogo del panel. */
export function plantillasSugeridasPara(tipoEvento: TipoEvento): string[] {
  const mapa: Record<TipoEvento, string[]> = {
    boda: ["editorial", "arco", "botanica", "celestial", "acuarela", "tropical", "boho", "moderna", "cinema"],
    cumpleanos: ["deco", "celestial", "cinema", "boho", "moderna", "acuarela"],
    empresarial: ["moderna", "cinema", "editorial", "deco"],
    otro: ["botanica", "acuarela", "arco", "boho", "tropical", "celestial"],
  };
  return mapa[tipoEvento] ?? PLANTILLAS.map((p) => p.id);
}

/* ---------- Mensajes por defecto ---------- */

function mensajeFinalPorEvento(tipoEvento: TipoEvento): string {
  switch (tipoEvento) {
    case "boda":
      return "Nos hará muy felices contar contigo en este día";
    case "cumpleanos":
      return "¡Te esperamos para celebrar juntos!";
    case "empresarial":
      return "Será un honor contar con su presencia";
    default:
      return "¡Te esperamos!";
  }
}

/* ---------- Mapper principal ---------- */

export function derivarDatosInvitacion(
  tipoEvento: TipoEvento,
  respuestas: Record<string, unknown>,
  telefonoCliente: string,
  fechaEventoPedido: string | null,
  _plan?: Plan
): { datos: DatosInvitacion; plantilla: string } {
  const r = respuestas;
  const plantilla = sugerirPlantilla(tipoEvento, r);
  const meta = plantillaMeta(plantilla);

  const rsvpRaw = (r["config_rsvp"] ?? {}) as { fecha_limite?: string; acompanantes?: string };

  // La paleta que pidió el cliente. Si el sistema no sabe aplicarla tal cual
  // (colores de marca, respuesta antigua), se usa la de la plantilla PERO se
  // deja constancia para el equipo: nunca se descarta en silencio.
  const paletaPedida = texto(r, "paleta_colores");
  const paletaAplicable = esPaletaValida(paletaPedida);

  const datos: DatosInvitacion = {
    titulo: "",
    subtitulo: "",
    frase: texto(r, "frase_portada"),
    fechaEvento: fechaEventoPedido ?? "",
    horaEvento: "",
    lugares: [],
    dressCode: texto(r, "dress_code"),
    paleta: paletaAplicable ? paletaPedida : meta.paletaSugerida,
    tipografia: meta.tipografiaSugerida,
    historia: "",
    cronograma: lista(r, "hitos_dia")
      .filter((h) => h.actividad)
      .map((h) => ({ hora: h.hora ?? "", actividad: h.actividad ?? "" })),
    regalos: lista(r, "mesa_regalos")
      .filter((g) => g.titulo || g.detalle)
      .map((g) => ({ titulo: g.titulo ?? "", detalle: g.detalle ?? "" })),
    padrinos: [],
    notas: [],
    mensajeFinal: mensajeFinalPorEvento(tipoEvento),
    hashtag: "",
    musicaUrl: "",
    rsvp: {
      whatsapp: telefonoCliente,
      fechaLimite: rsvpRaw.fecha_limite ?? "",
      acompanantes: rsvpRaw.acompanantes !== "no",
    },
    efectos: { sobre: true, textura: true, musica: false },
    secciones: {
      historia: false,
      galeria: true,
      cronograma: false,
      regalos: false,
      rsvp: true,
      padrinos: false,
      notas: false,
    },
  };

  switch (tipoEvento) {
    case "boda": {
      datos.titulo = texto(r, "nombres_novios") || "Nuestra Boda";
      datos.subtitulo = "Nos casamos";
      datos.fechaEvento = texto(r, "fecha_boda") || datos.fechaEvento;
      datos.horaEvento = texto(r, "hora_ceremonia");
      datos.historia = texto(r, "historia_pareja");
      const ceremonia = texto(r, "lugar_ceremonia");
      const recepcion = texto(r, "lugar_recepcion");
      if (ceremonia) datos.lugares.push({ nombre: "Ceremonia", detalle: ceremonia });
      if (recepcion && !/mismo lugar/i.test(recepcion)) {
        datos.lugares.push({ nombre: "Recepción", detalle: recepcion });
      }
      break;
    }

    case "cumpleanos": {
      const nombre = texto(r, "nombre_festejado") || "La Celebración";
      const edad = texto(r, "edad_festejado");
      datos.titulo = nombre;
      datos.subtitulo = edad ? `Mis ${edad} años` : "Mi cumpleaños";
      datos.fechaEvento = texto(r, "fecha_fiesta") || datos.fechaEvento;
      datos.horaEvento = texto(r, "hora_fiesta");
      const lugar = texto(r, "lugar_fiesta");
      if (lugar) datos.lugares.push({ nombre: "La Fiesta", detalle: lugar });
      break;
    }

    case "empresarial": {
      datos.titulo = texto(r, "nombre_evento") || "Evento Corporativo";
      datos.subtitulo = texto(r, "nombre_empresa") || "";
      datos.fechaEvento = texto(r, "fecha_evento_corp") || datos.fechaEvento;
      datos.horaEvento = texto(r, "hora_evento_corp");
      const lugar = texto(r, "lugar_evento_corp");
      if (lugar) datos.lugares.push({ nombre: "El Evento", detalle: lugar });

      // Los ponentes se convierten en la sección de personas destacadas
      datos.padrinos = lista(r, "lista_ponentes")
        .filter((p) => p.nombre)
        .map((p) => ({ rol: p.cargo ?? "Ponente", nombre: p.nombre ?? "" }));

      // Aviso automático si se usará control de acceso con QR
      if (texto(r, "usa_qr") === "si") {
        datos.notas!.push({
          titulo: "Acceso con código QR",
          texto: "Al confirmar recibirás un pase con código QR. Preséntalo en la entrada el día del evento.",
        });
      }
      break;
    }

    default: {
      datos.titulo = texto(r, "nombre_evento") || "Nuestra Celebración";
      datos.subtitulo = texto(r, "anfitriones") ? `Te invita ${texto(r, "anfitriones")}` : "Estás invitado";
      datos.fechaEvento = texto(r, "fecha_fiesta") || datos.fechaEvento;
      datos.horaEvento = texto(r, "hora_fiesta");
      const lugar = texto(r, "lugar_fiesta");
      if (lugar) datos.lugares.push({ nombre: "El Lugar", detalle: lugar });
    }
  }

  // Si la paleta pedida no se puede aplicar tal cual, el equipo se entera.
  if (paletaPedida && !paletaAplicable) {
    datos.notas!.push({
      titulo: "Paleta pedida por el cliente (interno)",
      texto:
        `El cliente eligió ${etiquetaPaletaPedida(paletaPedida)}. Se aplicó ` +
        `"${PALETAS[meta.paletaSugerida]?.nombre ?? meta.paletaSugerida}" como base: ` +
        `ajústala en el editor antes de publicar.`,
    });
  }

  // La canción indicada por el cliente queda anotada para que el equipo
  // suba el audio y pegue el enlace en el editor.
  const cancion = texto(r, "cancion_propia");
  if (cancion) {
    datos.notas!.push({ titulo: "Canción solicitada (interno)", texto: cancion });
  }

  // Activar secciones según lo que el cliente completó
  datos.secciones.historia = datos.historia.length > 0;
  datos.secciones.cronograma = datos.cronograma.length > 0;
  datos.secciones.regalos = datos.regalos.length > 0;
  datos.secciones.padrinos = (datos.padrinos?.length ?? 0) > 0;
  datos.secciones.notas = false; // el equipo decide qué avisos publicar

  return { datos, plantilla };
}

/** Paletas disponibles (reexportadas para el editor). */
export { PALETAS, PALETA_POR_DEFECTO, PLANTILLAS };
