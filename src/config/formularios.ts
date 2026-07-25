import { Plan, TipoEvento } from "@/lib/tipos";

/**
 * MOTOR DE FORMULARIOS DINÁMICOS DE INVIFTY
 * ==========================================
 * UN solo motor: aquí se define QUÉ se pregunta por tipo de evento
 * y desde qué plan se activa cada bloque (acumulativo).
 *
 * Para agregar una pregunta: añádela al bloque correspondiente.
 * Para crear un bloque nuevo: agrégalo a la lista del evento con su
 * `desdePlan` (si se omite, aparece en todos los planes).
 */

export type TipoPregunta =
  | "texto"      // una línea
  | "textarea"   // texto largo
  | "fecha"
  | "hora"
  | "seleccion"  // tarjetas visuales (con opción "Otro / Prefiero escribirlo yo")
  | "fotos"      // subida de imágenes (límite según plan)
  | "lista"      // constructor de elementos repetibles (hitos, enlaces, ponentes…)
  | "rsvp";      // configuración de confirmación de asistencia

export interface OpcionVisual {
  valor: string;
  etiqueta: string;
  emoji?: string;
  descripcion?: string;
  /** Muestras de color para paletas */
  colores?: string[];
}

export interface CampoLista {
  id: string;
  etiqueta: string;
  placeholder?: string;
  tipo?: "texto" | "hora";
}

export interface Pregunta {
  id: string;
  tipo: TipoPregunta;
  titulo: string;
  subtitulo?: string;
  placeholder?: string;
  requerida?: boolean;
  opciones?: OpcionVisual[];
  /** En "seleccion": permite elegir varias opciones */
  multiple?: boolean;
  /** Campos del constructor cuando tipo = "lista" */
  campos?: CampoLista[];
  /** Etiqueta del botón de agregar en "lista" */
  textoAgregar?: string;
  /** En "fotos": cuántos archivos como máximo (si se omite, aplica el límite del plan) */
  maxArchivos?: number;
  /** En "fotos": acepta también video */
  aceptaVideo?: boolean;
}

export interface Bloque {
  id: string;
  titulo: string;
  descripcion?: string;
  /** Plan mínimo que activa este bloque (acumulativo). Sin valor = todos los planes. */
  desdePlan?: Plan;
  preguntas: Pregunta[];
}

const ORDEN_PLANES: Plan[] = ["esencial", "popular", "premium", "luxury"];

export function planIncluye(planPedido: Plan, desdePlan?: Plan): boolean {
  if (!desdePlan) return true;
  return ORDEN_PLANES.indexOf(planPedido) >= ORDEN_PLANES.indexOf(desdePlan);
}

/** Arma el formulario final para un pedido: bloques activos según evento + plan. */
export function construirFormulario(tipoEvento: TipoEvento, plan: Plan): Bloque[] {
  const config = FORMULARIOS[tipoEvento] ?? FORMULARIOS.otro;
  return config.filter((b) => planIncluye(plan, b.desdePlan));
}

/** Lista plana de preguntas (para el asistente paso a paso y el panel). */
export function preguntasDelFormulario(tipoEvento: TipoEvento, plan: Plan): { bloque: Bloque; pregunta: Pregunta }[] {
  return construirFormulario(tipoEvento, plan).flatMap((bloque) =>
    bloque.preguntas.map((pregunta) => ({ bloque, pregunta }))
  );
}

// ============================================================
// OPCIONES REUTILIZABLES
// ============================================================

const PALETAS_COMUNES: OpcionVisual[] = [
  { valor: "dorado_negro", etiqueta: "Dorado & Negro", colores: ["#D4AF37", "#0F0F0F", "#FFFFFF"] },
  { valor: "blanco_verde", etiqueta: "Blanco & Verde Olivo", colores: ["#FAF8F5", "#6B7F5E", "#C9A96A"] },
  { valor: "rosa_dorado", etiqueta: "Rose Gold & Crema", colores: ["#E8B4B8", "#D4AF37", "#FFF7F0"] },
  { valor: "azul_plata", etiqueta: "Azul Noche & Plata", colores: ["#1B2A4A", "#C0C0C0", "#F5F5F5"] },
  { valor: "terracota", etiqueta: "Terracota & Beige", colores: ["#C1683C", "#E8D5C4", "#7A4A2B"] },
  { valor: "vino_nude", etiqueta: "Vino & Nude", colores: ["#722F37", "#E3C9B8", "#F8F1EC"] },
];

const DRESS_CODES: OpcionVisual[] = [
  { valor: "formal", etiqueta: "Formal / Etiqueta", emoji: "🤵", descripcion: "Traje y vestido largo" },
  { valor: "semiformal", etiqueta: "Semiformal", emoji: "👗", descripcion: "Elegante sin etiqueta" },
  { valor: "playa", etiqueta: "Playa / Lino", emoji: "🏖️", descripcion: "Fresco y claro" },
  { valor: "tematico", etiqueta: "Temático", emoji: "🎭", descripcion: "Según el tema de la fiesta" },
];

const AMBIENTE_MUSICAL: OpcionVisual[] = [
  { valor: "instrumental_romantico", etiqueta: "Instrumental romántico", emoji: "🎻", descripcion: "Piano y cuerdas suaves" },
  { valor: "balada", etiqueta: "Balada", emoji: "🎤", descripcion: "Clásicos del amor" },
  { valor: "acustico", etiqueta: "Acústico", emoji: "🎸", descripcion: "Guitarra y voz, íntimo" },
  { valor: "cancion_propia", etiqueta: "Nuestra canción", emoji: "🎧", descripcion: "Indícanos cuál en el siguiente paso" },
];

// ============================================================
// BODA
// ============================================================

const BLOQUES_BODA: Bloque[] = [
  {
    id: "novios",
    titulo: "Los protagonistas",
    descripcion: "Empecemos por lo más importante: ustedes.",
    preguntas: [
      {
        id: "nombres_novios",
        tipo: "texto",
        titulo: "¿Cuáles son los nombres de los novios?",
        subtitulo: "Tal como quieren que aparezcan en la invitación.",
        placeholder: "Ej. Camila Rodríguez & Lucas Herrera",
        requerida: true,
      },
    ],
  },
  {
    id: "fecha_lugar",
    titulo: "Fecha y lugares",
    descripcion: "Los datos clave para que nadie se pierda tu gran día.",
    preguntas: [
      { id: "fecha_boda", tipo: "fecha", titulo: "¿Qué día es la boda?", requerida: true },
      { id: "hora_ceremonia", tipo: "hora", titulo: "¿A qué hora inicia la ceremonia?", requerida: true },
      {
        id: "lugar_ceremonia",
        tipo: "textarea",
        titulo: "¿Dónde será la ceremonia?",
        subtitulo: "Nombre del lugar y dirección. Con esto crearemos el mapa interactivo.",
        placeholder: "Ej. Iglesia San Estanislao, Altos de Chavón, La Romana",
        requerida: true,
      },
      {
        id: "lugar_recepcion",
        tipo: "textarea",
        titulo: "¿Y la recepción?",
        subtitulo: "Si es en el mismo lugar, escribe «mismo lugar».",
        placeholder: "Ej. Salón Los Almendros, Casa de Campo",
      },
    ],
  },
  {
    id: "estilo",
    titulo: "El estilo de tu invitación",
    descripcion: "Cuéntanos cómo la sueñan. Nuestro equipo se encarga del resto.",
    preguntas: [
      {
        id: "dress_code",
        tipo: "seleccion",
        titulo: "¿Cuál es el código de vestimenta?",
        opciones: DRESS_CODES,
        requerida: true,
      },
      {
        id: "estilo_diseno",
        tipo: "seleccion",
        titulo: "¿Qué estilo de diseño va con ustedes?",
        subtitulo: "Elige el que más se parezca a lo que imaginan.",
        opciones: [
          { valor: "clasico_elegante", etiqueta: "Clásico elegante", emoji: "🥂", descripcion: "Atemporal, sobrio y fino" },
          { valor: "minimalista", etiqueta: "Minimalista moderno", emoji: "◻️", descripcion: "Limpio, tipografía protagonista" },
          { valor: "romantico_floral", etiqueta: "Romántico floral", emoji: "🌸", descripcion: "Flores, suavidad y detalle" },
          { valor: "tropical", etiqueta: "Tropical", emoji: "🌴", descripcion: "Verde, caribeño y fresco" },
          { valor: "rustico", etiqueta: "Rústico", emoji: "🪵", descripcion: "Madera, campo y calidez" },
        ],
        requerida: true,
      },
      {
        id: "paleta_colores",
        tipo: "seleccion",
        titulo: "¿Qué paleta de colores prefieren?",
        opciones: PALETAS_COMUNES,
        requerida: true,
      },
      {
        id: "frase_portada",
        tipo: "seleccion",
        titulo: "La frase de portada",
        subtitulo: "Aparece al abrir la invitación. Elige una o escribe la suya.",
        opciones: [
          { valor: "El amor todo lo puede", etiqueta: "«El amor todo lo puede»", emoji: "💛" },
          { valor: "Dos corazones, un solo destino", etiqueta: "«Dos corazones, un solo destino»", emoji: "💍" },
          { valor: "El amor es paciente, el amor es bondadoso — 1 Corintios 13:4", etiqueta: "«El amor es paciente…» (1 Cor. 13:4)", emoji: "🕊️" },
          { valor: "Y ahora permanecen la fe, la esperanza y el amor — 1 Corintios 13:13", etiqueta: "«La fe, la esperanza y el amor» (1 Cor. 13:13)", emoji: "✝️" },
          { valor: "Nuestro para siempre comienza aquí", etiqueta: "«Nuestro para siempre comienza aquí»", emoji: "✨" },
        ],
      },
    ],
  },
  {
    id: "historia",
    titulo: "Su historia de amor",
    desdePlan: "popular",
    descripcion: "Este toque personal es lo que más enamora a los invitados.",
    preguntas: [
      {
        id: "historia_pareja",
        tipo: "textarea",
        titulo: "Cuéntennos su historia",
        subtitulo: "Como guía: ¿cómo se conocieron? ¿cuándo supieron que era la persona indicada? ¿cómo fue la propuesta? Escríbanlo con sus palabras, nosotros lo pulimos.",
        placeholder: "Nos conocimos en...",
      },
    ],
  },
  {
    id: "fotos",
    titulo: "Sus fotos",
    desdePlan: "popular",
    descripcion: "Las fotos le dan vida a la invitación.",
    preguntas: [
      {
        id: "fotos_evento",
        tipo: "fotos",
        titulo: "Suban sus fotos favoritas",
        subtitulo: "Recomendamos fotos en buena resolución, verticales u horizontales. La primera será la portada.",
      },
    ],
  },
  {
    id: "musica",
    titulo: "Ambiente musical",
    desdePlan: "popular",
    preguntas: [
      {
        id: "ambiente_musical",
        tipo: "seleccion",
        titulo: "¿Qué música debe sonar al abrir la invitación?",
        opciones: AMBIENTE_MUSICAL,
      },
      {
        id: "cancion_propia",
        tipo: "texto",
        titulo: "Si tienen una canción especial, ¿cuál es?",
        subtitulo: "Nombre y artista, o pega un link de YouTube/Spotify. Si no aplica, continúa.",
        placeholder: "Ej. Perfect — Ed Sheeran",
      },
    ],
  },
  {
    id: "rsvp",
    titulo: "Confirmación de asistencia",
    desdePlan: "popular",
    descripcion: "Configura cómo confirmarán tus invitados.",
    preguntas: [
      {
        id: "config_rsvp",
        tipo: "rsvp",
        titulo: "Configuremos tu RSVP",
        subtitulo: "Las confirmaciones te llegarán organizadas por WhatsApp.",
      },
    ],
  },
  {
    id: "cronograma",
    titulo: "Cronograma del día",
    desdePlan: "premium",
    descripcion: "El itinerario que verán tus invitados en la invitación.",
    preguntas: [
      {
        id: "hitos_dia",
        tipo: "lista",
        titulo: "Arma el cronograma de tu boda",
        subtitulo: "Ej.: 4:30 PM Ceremonia · 6:00 PM Cóctel · 8:00 PM Cena · 10:00 PM ¡Hora loca!",
        campos: [
          { id: "hora", etiqueta: "Hora", tipo: "hora" },
          { id: "actividad", etiqueta: "Actividad", placeholder: "Ej. Ceremonia religiosa" },
        ],
        textoAgregar: "Agregar momento",
      },
    ],
  },
  {
    id: "regalos",
    titulo: "Mesa de regalos",
    desdePlan: "premium",
    preguntas: [
      {
        id: "mesa_regalos",
        tipo: "lista",
        titulo: "¿Dónde pueden aportar o comprar regalos tus invitados?",
        subtitulo: "Cuentas bancarias, Zelle, PayPal o listas de regalos (Amazon, tiendas). Agrega las que quieras.",
        campos: [
          { id: "titulo", etiqueta: "Nombre", placeholder: "Ej. Cuenta Banreservas / Lista Amazon" },
          { id: "detalle", etiqueta: "Número de cuenta o link", placeholder: "Ej. 9600000000 a nombre de… / https://amazon.com/…" },
        ],
        textoAgregar: "Agregar opción de regalo",
      },
    ],
  },
  {
    id: "recordatorio",
    titulo: "Recordatorio para invitados",
    desdePlan: "premium",
    preguntas: [
      {
        id: "mensaje_recordatorio",
        tipo: "textarea",
        titulo: "¿Qué mensaje de recordatorio quieres enviar a tus invitados días antes?",
        subtitulo: "Lo enviaremos por WhatsApp a quienes confirmen. Si prefieres, deja el que te sugerimos.",
        placeholder: "¡Falta poco! Nos vemos este sábado en Altos de Chavón. Recuerda el dress code formal. 🥂",
      },
    ],
  },
  {
    id: "personalizacion",
    titulo: "Diseño 100% personalizado",
    desdePlan: "luxury",
    descripcion: "Tu plan Luxury incluye un diseñador dedicado. Cuéntale tu visión.",
    preguntas: [
      {
        id: "preferencias_diseno",
        tipo: "textarea",
        titulo: "Describe la invitación de tus sueños",
        subtitulo: "Referencias, invitaciones que hayas visto y amado, detalles imprescindibles. Puedes pegar links de Pinterest o Instagram.",
        placeholder: "Me encantaría que tuviera...",
      },
      {
        id: "video_fondo",
        tipo: "fotos",
        titulo: "Video de portada (opcional)",
        subtitulo: "Sube un video corto (o compártenos el link en el campo anterior). Se verá en bucle en la portada.",
        maxArchivos: 1,
        aceptaVideo: true,
      },
      {
        id: "dominio_deseado",
        tipo: "texto",
        titulo: "¿Qué dominio web te gustaría?",
        subtitulo: "Tu plan incluye dominio propio. Danos 2 o 3 ideas por si alguna no está disponible.",
        placeholder: "Ej. camilaylucas.com · bodacamilaylucas.com",
      },
    ],
  },
];

// ============================================================
// CUMPLEAÑOS
// ============================================================

const BLOQUES_CUMPLEANOS: Bloque[] = [
  {
    id: "festejado",
    titulo: "El festejado o festejada",
    preguntas: [
      {
        id: "nombre_festejado",
        tipo: "texto",
        titulo: "¿Quién celebra?",
        subtitulo: "Nombre tal como aparecerá en la invitación.",
        placeholder: "Ej. Valeria Sofía",
        requerida: true,
      },
      {
        id: "edad_festejado",
        tipo: "texto",
        titulo: "¿Cuántos años cumple?",
        placeholder: "Ej. 15",
        requerida: true,
      },
    ],
  },
  {
    id: "fecha_lugar",
    titulo: "Fecha y lugar",
    preguntas: [
      { id: "fecha_fiesta", tipo: "fecha", titulo: "¿Qué día es la celebración?", requerida: true },
      { id: "hora_fiesta", tipo: "hora", titulo: "¿A qué hora comienza?", requerida: true },
      {
        id: "lugar_fiesta",
        tipo: "textarea",
        titulo: "¿Dónde será la fiesta?",
        subtitulo: "Nombre del lugar y dirección para el mapa.",
        placeholder: "Ej. Salón de Eventos Hotel Jaragua, Santo Domingo",
        requerida: true,
      },
    ],
  },
  {
    id: "estilo",
    titulo: "Tema y estilo",
    preguntas: [
      {
        id: "tema_fiesta",
        tipo: "seleccion",
        titulo: "¿Cuál es el tema o estilo de la fiesta?",
        opciones: [
          { valor: "elegante_gala", etiqueta: "Elegante / Gala", emoji: "✨", descripcion: "Sofisticado y de etiqueta" },
          { valor: "quince_princesa", etiqueta: "Quince estilo princesa", emoji: "👑", descripcion: "Rosa, cristal y brillo" },
          { valor: "neon_fiesta", etiqueta: "Neón / Fiesta", emoji: "🪩", descripcion: "Colores vivos y baile" },
          { valor: "tropical", etiqueta: "Tropical / Piscina", emoji: "🌴", descripcion: "Al aire libre y fresco" },
          { valor: "vintage", etiqueta: "Vintage / Retro", emoji: "📻", descripcion: "De otra época, con encanto" },
        ],
        requerida: true,
      },
      {
        id: "paleta_colores",
        tipo: "seleccion",
        titulo: "¿Qué paleta de colores prefieres?",
        opciones: PALETAS_COMUNES,
        requerida: true,
      },
      {
        id: "dress_code",
        tipo: "seleccion",
        titulo: "¿Hay código de vestimenta?",
        opciones: [
          ...DRESS_CODES,
          { valor: "libre", etiqueta: "Vestimenta libre", emoji: "😎", descripcion: "Que vengan cómodos" },
        ],
      },
    ],
  },
  {
    id: "fotos",
    titulo: "Fotos",
    desdePlan: "popular",
    preguntas: [
      {
        id: "fotos_evento",
        tipo: "fotos",
        titulo: "Sube las fotos para la invitación",
        subtitulo: "La primera será la portada. Fotos recientes y en buena calidad lucen mejor.",
      },
    ],
  },
  {
    id: "musica",
    titulo: "Música",
    desdePlan: "popular",
    preguntas: [
      {
        id: "ambiente_musical",
        tipo: "seleccion",
        titulo: "¿Qué música debe sonar al abrir la invitación?",
        opciones: [
          { valor: "festiva", etiqueta: "Festiva / Alegre", emoji: "🎉", descripcion: "Que se sienta la fiesta" },
          { valor: "instrumental", etiqueta: "Instrumental elegante", emoji: "🎻", descripcion: "Suave y sofisticada" },
          { valor: "acustico", etiqueta: "Acústica", emoji: "🎸", descripcion: "Relajada y cálida" },
          { valor: "cancion_propia", etiqueta: "Canción favorita", emoji: "🎧", descripcion: "Indícanos cuál en el siguiente paso" },
        ],
      },
      {
        id: "cancion_propia",
        tipo: "texto",
        titulo: "¿Cuál es la canción favorita del festejado?",
        subtitulo: "Nombre y artista, o un link. Si no aplica, continúa.",
        placeholder: "Ej. La Vida es un Carnaval — Celia Cruz",
      },
    ],
  },
  {
    id: "rsvp",
    titulo: "Confirmación de asistencia",
    desdePlan: "popular",
    preguntas: [
      {
        id: "config_rsvp",
        tipo: "rsvp",
        titulo: "Configuremos las confirmaciones",
        subtitulo: "Sabrás con tiempo cuántos invitados esperar.",
      },
    ],
  },
  {
    id: "cronograma",
    titulo: "Programa de la fiesta",
    desdePlan: "premium",
    preguntas: [
      {
        id: "hitos_dia",
        tipo: "lista",
        titulo: "Arma el programa de la celebración",
        subtitulo: "Ej.: 7:00 PM Recepción · 8:00 PM Brindis · 9:00 PM Vals · 10:00 PM Fiesta",
        campos: [
          { id: "hora", etiqueta: "Hora", tipo: "hora" },
          { id: "actividad", etiqueta: "Actividad", placeholder: "Ej. Brindis y palabras" },
        ],
        textoAgregar: "Agregar momento",
      },
    ],
  },
  {
    id: "regalos",
    titulo: "Regalos",
    desdePlan: "premium",
    preguntas: [
      {
        id: "mesa_regalos",
        tipo: "lista",
        titulo: "¿Deseas incluir mesa de regalos o aportes?",
        subtitulo: "Cuentas, Zelle o listas de deseos. Si no aplica, continúa al siguiente paso.",
        campos: [
          { id: "titulo", etiqueta: "Nombre", placeholder: "Ej. Cuenta Popular / Lista de deseos" },
          { id: "detalle", etiqueta: "Cuenta o link", placeholder: "Ej. 0700000000 / https://…" },
        ],
        textoAgregar: "Agregar opción",
      },
    ],
  },
  {
    id: "personalizacion",
    titulo: "Diseño personalizado",
    desdePlan: "luxury",
    preguntas: [
      {
        id: "preferencias_diseno",
        tipo: "textarea",
        titulo: "Cuéntale tu visión al diseñador",
        subtitulo: "Referencias, colores exactos, detalles que no pueden faltar. Puedes pegar links.",
        placeholder: "Quiero que se sienta...",
      },
      {
        id: "video_fondo",
        tipo: "fotos",
        titulo: "Video de portada (opcional)",
        maxArchivos: 1,
        aceptaVideo: true,
      },
      {
        id: "dominio_deseado",
        tipo: "texto",
        titulo: "¿Qué dominio web te gustaría?",
        placeholder: "Ej. mis15valeria.com",
      },
    ],
  },
];

// ============================================================
// EMPRESARIAL
// ============================================================

const BLOQUES_EMPRESARIAL: Bloque[] = [
  {
    id: "empresa",
    titulo: "La empresa y el evento",
    preguntas: [
      {
        id: "nombre_empresa",
        tipo: "texto",
        titulo: "¿Cuál es el nombre de la empresa u organización?",
        placeholder: "Ej. Vitrexi Technologies",
        requerida: true,
      },
      {
        id: "nombre_evento",
        tipo: "texto",
        titulo: "¿Cómo se llama el evento?",
        placeholder: "Ej. Gala Anual de Innovación 2026",
        requerida: true,
      },
      {
        id: "tipo_evento_corp",
        tipo: "seleccion",
        titulo: "¿Qué tipo de evento es?",
        opciones: [
          { valor: "conferencia", etiqueta: "Conferencia", emoji: "🎤", descripcion: "Charlas y ponentes" },
          { valor: "gala", etiqueta: "Gala / Cena", emoji: "🥂", descripcion: "Celebración de etiqueta" },
          { valor: "aniversario", etiqueta: "Aniversario", emoji: "🎊", descripcion: "Celebración corporativa" },
          { valor: "lanzamiento", etiqueta: "Lanzamiento", emoji: "🚀", descripcion: "Producto, marca o local" },
        ],
        requerida: true,
      },
    ],
  },
  {
    id: "fecha_lugar",
    titulo: "Fecha y lugar",
    preguntas: [
      { id: "fecha_evento_corp", tipo: "fecha", titulo: "¿Qué día es el evento?", requerida: true },
      { id: "hora_evento_corp", tipo: "hora", titulo: "¿A qué hora inicia?", requerida: true },
      {
        id: "lugar_evento_corp",
        tipo: "textarea",
        titulo: "¿Dónde se realizará?",
        subtitulo: "Nombre del lugar, salón y dirección. Incluye indicaciones de parqueo si las hay.",
        placeholder: "Ej. Hotel El Embajador, Salón Embassy — Av. Sarasota #65. Parqueo con valet incluido.",
        requerida: true,
      },
    ],
  },
  {
    id: "marca",
    titulo: "Identidad de marca",
    preguntas: [
      {
        id: "logo_empresa",
        tipo: "fotos",
        titulo: "Sube el logo de la empresa",
        subtitulo: "Preferiblemente en PNG con fondo transparente o en alta resolución.",
        maxArchivos: 2,
      },
      {
        id: "paleta_colores",
        tipo: "seleccion",
        titulo: "¿Qué paleta usamos?",
        subtitulo: "Podemos seguir la identidad de tu marca o proponer una elegante.",
        opciones: [
          { valor: "colores_marca", etiqueta: "Los colores de nuestra marca", emoji: "🏢", descripcion: "Los tomamos del logo" },
          ...PALETAS_COMUNES.slice(0, 4),
        ],
      },
    ],
  },
  {
    id: "agenda",
    titulo: "Agenda del evento",
    preguntas: [
      {
        id: "hitos_dia",
        tipo: "lista",
        titulo: "Construye la agenda del evento",
        subtitulo: "Ej.: 6:30 PM Registro · 7:00 PM Apertura · 8:00 PM Cena · 9:00 PM Premiaciones",
        campos: [
          { id: "hora", etiqueta: "Hora", tipo: "hora" },
          { id: "actividad", etiqueta: "Actividad", placeholder: "Ej. Registro y bienvenida" },
        ],
        textoAgregar: "Agregar punto de agenda",
      },
    ],
  },
  {
    id: "registro",
    titulo: "Registro de asistentes",
    preguntas: [
      {
        id: "datos_registro",
        tipo: "seleccion",
        titulo: "¿Qué datos necesitan de cada asistente al confirmar?",
        subtitulo: "Marca todos los que apliquen.",
        multiple: true,
        opciones: [
          { valor: "nombre", etiqueta: "Nombre completo", emoji: "👤" },
          { valor: "empresa", etiqueta: "Empresa", emoji: "🏢" },
          { valor: "cargo", etiqueta: "Cargo", emoji: "💼" },
          { valor: "email", etiqueta: "Correo electrónico", emoji: "📧" },
          { valor: "telefono", etiqueta: "Teléfono", emoji: "📱" },
        ],
      },
    ],
  },
  {
    id: "ponentes",
    titulo: "Ponentes o invitados especiales",
    desdePlan: "popular",
    preguntas: [
      {
        id: "lista_ponentes",
        tipo: "lista",
        titulo: "¿Quiénes son los ponentes o invitados de honor?",
        subtitulo: "Si tienes sus fotos, súbelas en el siguiente paso.",
        campos: [
          { id: "nombre", etiqueta: "Nombre", placeholder: "Ej. Ing. María Gómez" },
          { id: "cargo", etiqueta: "Cargo o rol", placeholder: "Ej. CEO, Vitrexi Technologies" },
        ],
        textoAgregar: "Agregar ponente",
      },
      {
        id: "fotos_ponentes",
        tipo: "fotos",
        titulo: "Fotos de los ponentes (opcional)",
        subtitulo: "Preferiblemente retratos profesionales, en el mismo orden de la lista.",
      },
    ],
  },
  {
    id: "acceso_qr",
    titulo: "Control de acceso",
    desdePlan: "premium",
    preguntas: [
      {
        id: "usa_qr",
        tipo: "seleccion",
        titulo: "¿Usaremos pases con código QR en la puerta?",
        subtitulo: "Cada asistente confirmado recibe un pase QR único para escanear al entrar.",
        opciones: [
          { valor: "si", etiqueta: "Sí, con QR", emoji: "📲", descripcion: "Control de acceso en puerta" },
          { valor: "no", etiqueta: "No es necesario", emoji: "🚪", descripcion: "Entrada libre con confirmación" },
        ],
      },
    ],
  },
  {
    id: "recordatorio",
    titulo: "Recordatorios",
    desdePlan: "premium",
    preguntas: [
      {
        id: "mensaje_recordatorio",
        tipo: "textarea",
        titulo: "¿Qué recordatorio enviamos a los asistentes días antes?",
        placeholder: "Les esperamos este jueves a las 7:00 PM en el Hotel El Embajador. Dress code: formal.",
      },
    ],
  },
  {
    id: "personalizacion",
    titulo: "Personalización total",
    desdePlan: "luxury",
    preguntas: [
      {
        id: "preferencias_diseno",
        tipo: "textarea",
        titulo: "Indicaciones para el diseñador dedicado",
        subtitulo: "Lineamientos de marca, referencias, requisitos de comunicación corporativa.",
      },
      {
        id: "video_fondo",
        tipo: "fotos",
        titulo: "Video institucional de portada (opcional)",
        maxArchivos: 1,
        aceptaVideo: true,
      },
      {
        id: "dominio_deseado",
        tipo: "texto",
        titulo: "¿Dominio web deseado para el evento?",
        placeholder: "Ej. galavitrexi2026.com",
      },
    ],
  },
];

// ============================================================
// OTRO TIPO DE EVENTO (genérico)
// ============================================================

const BLOQUES_OTRO: Bloque[] = [
  {
    id: "evento",
    titulo: "Tu celebración",
    preguntas: [
      {
        id: "nombre_evento",
        tipo: "texto",
        titulo: "¿Qué estamos celebrando?",
        subtitulo: "Ej.: Baby shower de Mateo, Bautizo de Sofía, Despedida de soltera…",
        placeholder: "Ej. Baby Shower de Mateo",
        requerida: true,
      },
      {
        id: "anfitriones",
        tipo: "texto",
        titulo: "¿Quiénes invitan?",
        placeholder: "Ej. Familia Pérez Rodríguez",
      },
    ],
  },
  {
    id: "fecha_lugar",
    titulo: "Fecha y lugar",
    preguntas: [
      { id: "fecha_fiesta", tipo: "fecha", titulo: "¿Qué día es?", requerida: true },
      { id: "hora_fiesta", tipo: "hora", titulo: "¿A qué hora?", requerida: true },
      {
        id: "lugar_fiesta",
        tipo: "textarea",
        titulo: "¿Dónde será?",
        subtitulo: "Nombre del lugar y dirección para el mapa.",
        requerida: true,
      },
    ],
  },
  {
    id: "estilo",
    titulo: "Estilo",
    preguntas: [
      {
        id: "estilo_diseno",
        tipo: "seleccion",
        titulo: "¿Qué estilo imaginas para la invitación?",
        opciones: [
          { valor: "elegante", etiqueta: "Elegante", emoji: "✨" },
          { valor: "tierno", etiqueta: "Tierno / Delicado", emoji: "🕊️" },
          { valor: "festivo", etiqueta: "Festivo / Colorido", emoji: "🎉" },
          { valor: "minimalista", etiqueta: "Minimalista", emoji: "◻️" },
        ],
      },
      {
        id: "paleta_colores",
        tipo: "seleccion",
        titulo: "¿Paleta de colores?",
        opciones: PALETAS_COMUNES,
      },
      {
        id: "dress_code",
        tipo: "seleccion",
        titulo: "¿Código de vestimenta?",
        opciones: [
          ...DRESS_CODES,
          { valor: "libre", etiqueta: "Vestimenta libre", emoji: "😎" },
        ],
      },
    ],
  },
  {
    id: "fotos",
    titulo: "Fotos",
    desdePlan: "popular",
    preguntas: [
      {
        id: "fotos_evento",
        tipo: "fotos",
        titulo: "Sube las fotos para la invitación",
      },
    ],
  },
  {
    id: "rsvp",
    titulo: "Confirmación de asistencia",
    desdePlan: "popular",
    preguntas: [
      {
        id: "config_rsvp",
        tipo: "rsvp",
        titulo: "Configuremos las confirmaciones",
      },
    ],
  },
  {
    id: "cronograma",
    titulo: "Programa",
    desdePlan: "premium",
    preguntas: [
      {
        id: "hitos_dia",
        tipo: "lista",
        titulo: "Programa de la actividad",
        campos: [
          { id: "hora", etiqueta: "Hora", tipo: "hora" },
          { id: "actividad", etiqueta: "Actividad" },
        ],
        textoAgregar: "Agregar momento",
      },
    ],
  },
  {
    id: "personalizacion",
    titulo: "Personalización",
    desdePlan: "luxury",
    preguntas: [
      {
        id: "preferencias_diseno",
        tipo: "textarea",
        titulo: "Cuéntanos tu visión para el diseño personalizado",
      },
      {
        id: "dominio_deseado",
        tipo: "texto",
        titulo: "¿Dominio web deseado?",
      },
    ],
  },
];

export const FORMULARIOS: Record<TipoEvento, Bloque[]> = {
  boda: BLOQUES_BODA,
  cumpleanos: BLOQUES_CUMPLEANOS,
  empresarial: BLOQUES_EMPRESARIAL,
  otro: BLOQUES_OTRO,
};
