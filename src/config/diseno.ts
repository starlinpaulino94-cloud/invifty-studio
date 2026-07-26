/**
 * SISTEMA DE DISEÑO DE INVITACIONES INVIFTY
 * ==========================================
 * Aquí viven las piezas que hacen que cada invitación se sienta única:
 * paletas de color, parejas tipográficas y ornamentos.
 *
 * La combinación plantilla × paleta × tipografía da cientos de resultados
 * distintos sin tocar código.
 */

/* ============================================================
   PALETAS
   ============================================================ */

export interface Paleta {
  nombre: string;
  /** Fondo principal de la invitación */
  fondo: string;
  /** Fondo secundario (tarjetas, bloques) */
  tarjeta: string;
  /** Color de acento: filigranas, títulos destacados, botones */
  acento: string;
  /** Variante clara del acento, para degradados y brillos */
  acentoClaro: string;
  /** Texto principal */
  texto: string;
  /** Texto secundario / apoyos */
  textoSuave: string;
  /** true si el fondo es oscuro (ajusta sombras y overlays) */
  oscura: boolean;
}

export const PALETAS: Record<string, Paleta> = {
  dorado_negro: {
    nombre: "Oro & Ónix",
    fondo: "#0B0B0C", tarjeta: "#151517", acento: "#D4AF37", acentoClaro: "#F2D06B",
    texto: "#F6F3EC", textoSuave: "#A9A296", oscura: true,
  },
  marfil_oro: {
    nombre: "Marfil & Oro",
    fondo: "#FBF8F2", tarjeta: "#FFFFFF", acento: "#B79049", acentoClaro: "#D9BC80",
    texto: "#2E2A24", textoSuave: "#867E70", oscura: false,
  },
  blanco_verde: {
    nombre: "Jardín Olivo",
    fondo: "#F7F6F1", tarjeta: "#FFFFFF", acento: "#6B7F5E", acentoClaro: "#9AAE8C",
    texto: "#282C24", textoSuave: "#7C8175", oscura: false,
  },
  esmeralda_oro: {
    nombre: "Esmeralda & Oro",
    fondo: "#0C2A23", tarjeta: "#123A30", acento: "#CFA75E", acentoClaro: "#E8CE93",
    texto: "#F1F6F2", textoSuave: "#9DB5AA", oscura: true,
  },
  rosa_dorado: {
    nombre: "Rosa & Champán",
    fondo: "#FFF8F4", tarjeta: "#FFFFFF", acento: "#C08A87", acentoClaro: "#E4BBB4",
    texto: "#3B2E2C", textoSuave: "#9C8783", oscura: false,
  },
  borgona_rosa: {
    nombre: "Borgoña & Rosa Seco",
    fondo: "#2A1418", tarjeta: "#3A1C21", acento: "#DDA9A0", acentoClaro: "#F0CFC8",
    texto: "#FAF0EE", textoSuave: "#C3A29E", oscura: true,
  },
  azul_plata: {
    nombre: "Azul Noche & Plata",
    fondo: "#0E1830", tarjeta: "#16223F", acento: "#B9CBE0", acentoClaro: "#DCE7F2",
    texto: "#EFF3F8", textoSuave: "#94A6BC", oscura: true,
  },
  celeste_nube: {
    nombre: "Cielo & Nube",
    fondo: "#F4F9FC", tarjeta: "#FFFFFF", acento: "#7FA8C4", acentoClaro: "#B4CFE1",
    texto: "#26333D", textoSuave: "#7C8C97", oscura: false,
  },
  terracota: {
    nombre: "Terracota & Arena",
    fondo: "#F7EFE6", tarjeta: "#FFFCF8", acento: "#BE6B42", acentoClaro: "#DDA07C",
    texto: "#42301F", textoSuave: "#96826D", oscura: false,
  },
  coral_palma: {
    nombre: "Coral & Palma",
    fondo: "#FFF6F0", tarjeta: "#FFFFFF", acento: "#E07856", acentoClaro: "#F2A98D",
    texto: "#2C3B33", textoSuave: "#7E8B82", oscura: false,
  },
  lavanda_perla: {
    nombre: "Lavanda & Perla",
    fondo: "#F8F5FB", tarjeta: "#FFFFFF", acento: "#9282B4", acentoClaro: "#C0B3D6",
    texto: "#312B3B", textoSuave: "#8A8296", oscura: false,
  },
  blanco_negro: {
    nombre: "Blanco & Tinta",
    fondo: "#FAFAFA", tarjeta: "#FFFFFF", acento: "#1A1A1A", acentoClaro: "#5A5A5A",
    texto: "#111111", textoSuave: "#767676", oscura: false,
  },
  champan_perla: {
    nombre: "Champán & Perla",
    fondo: "#FBF7F1", tarjeta: "#FFFFFF", acento: "#C2A878", acentoClaro: "#DFCCA6",
    texto: "#33302B", textoSuave: "#8B8377", oscura: false,
  },
  onix_oro_rosa: {
    nombre: "Ónix & Oro Rosa",
    fondo: "#131113", tarjeta: "#1E1A1E", acento: "#E0A899", acentoClaro: "#F2CDC2",
    texto: "#F7F2F0", textoSuave: "#AFA19C", oscura: true,
  },
  bosque_crema: {
    nombre: "Bosque & Crema",
    fondo: "#16281F", tarjeta: "#1E3428", acento: "#D8CBB0", acentoClaro: "#EDE4D2",
    texto: "#F2F5EF", textoSuave: "#9DAF9F", oscura: true,
  },
  mostaza_tierra: {
    nombre: "Mostaza & Tierra",
    fondo: "#FBF4E4", tarjeta: "#FFFDF7", acento: "#C08A2E", acentoClaro: "#E0B565",
    texto: "#3D3222", textoSuave: "#91836A", oscura: false,
  },
  malva_perla: {
    nombre: "Malva & Perla",
    fondo: "#F7F3F4", tarjeta: "#FFFFFF", acento: "#A47C87", acentoClaro: "#C9AAB2",
    texto: "#33292C", textoSuave: "#8D8085", oscura: false,
  },
  turquesa_arena: {
    nombre: "Turquesa & Arena",
    fondo: "#F2F8F7", tarjeta: "#FFFFFF", acento: "#2E9C97", acentoClaro: "#7FC9C4",
    texto: "#21332F", textoSuave: "#7A8C89", oscura: false,
  },
  cobre_noche: {
    nombre: "Cobre & Noche",
    fondo: "#14100E", tarjeta: "#1F1815", acento: "#C97B4A", acentoClaro: "#E6A87B",
    texto: "#F5EFE9", textoSuave: "#A9998D", oscura: true,
  },
  azul_rey_oro: {
    nombre: "Azul Rey & Oro",
    fondo: "#0A1B3D", tarjeta: "#122751", acento: "#D9B45B", acentoClaro: "#F0D796",
    texto: "#F1F4FA", textoSuave: "#93A3C0", oscura: true,
  },
  durazno_crema: {
    nombre: "Durazno & Crema",
    fondo: "#FFF6F1", tarjeta: "#FFFFFF", acento: "#E39A72", acentoClaro: "#F5C4A8",
    texto: "#3B2C24", textoSuave: "#9B8477", oscura: false,
  },
  grafito_plata: {
    nombre: "Grafito & Plata",
    fondo: "#1A1A1C", tarjeta: "#252528", acento: "#C3C7CC", acentoClaro: "#E4E7EA",
    texto: "#F2F3F4", textoSuave: "#9A9DA3", oscura: true,
  },
  menta_blanco: {
    nombre: "Menta & Blanco",
    fondo: "#F3FAF6", tarjeta: "#FFFFFF", acento: "#5FA98A", acentoClaro: "#9CCDB6",
    texto: "#22332B", textoSuave: "#7E8F86", oscura: false,
  },
  lila_dorado: {
    nombre: "Lila & Dorado",
    fondo: "#F7F4FA", tarjeta: "#FFFFFF", acento: "#B08FBF", acentoClaro: "#D3BFDD",
    texto: "#322A38", textoSuave: "#8B8291", oscura: false,
  },
  vino_nude: {
    nombre: "Vino & Nude",
    fondo: "#FBF4F0", tarjeta: "#FFFFFF", acento: "#7B2D3B", acentoClaro: "#B5707C",
    texto: "#362227", textoSuave: "#92787D", oscura: false,
  },
};

export const PALETA_POR_DEFECTO = "dorado_negro";

export function paleta(id?: string): Paleta {
  return PALETAS[id ?? ""] ?? PALETAS[PALETA_POR_DEFECTO];
}

/** true si el id corresponde a una paleta que el sistema sabe aplicar. */
export function esPaletaValida(id?: string): boolean {
  return !!id && id in PALETAS;
}

/**
 * Los tres colores que representan la paleta en una muestra visual.
 * Se derivan de la paleta real: así lo que el cliente ve al elegir es
 * exactamente lo que recibe en su invitación.
 */
export function muestraDePaleta(id: string): string[] {
  const p = paleta(id);
  return [p.acento, p.acentoClaro, p.fondo];
}

/* ============================================================
   TIPOGRAFÍAS (parejas curadas)
   ============================================================ */

export interface Tipografia {
  nombre: string;
  descripcion: string;
  /** Títulos y nombres */
  display: string;
  /** Texto corrido e interfaz */
  cuerpo: string;
  /** Caligrafía para acentos románticos */
  script: string;
  /** Familias a cargar de Google Fonts */
  familias: string[];
}

export const TIPOGRAFIAS: Record<string, Tipografia> = {
  clasica_real: {
    nombre: "Clásica Real",
    descripcion: "Mayúsculas romanas y serif fina. Atemporal y ceremoniosa.",
    display: "'Cinzel', Georgia, serif",
    cuerpo: "'Cormorant Garamond', Georgia, serif",
    script: "'Great Vibes', cursive",
    familias: [
      "Cinzel:wght@400;500;600;700",
      "Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,400",
      "Great+Vibes",
    ],
  },
  romantica: {
    nombre: "Romántica",
    descripcion: "Serif editorial con caligrafía delicada. Perfecta para bodas.",
    display: "'Playfair Display', Georgia, serif",
    cuerpo: "'Lato', system-ui, sans-serif",
    script: "'Parisienne', cursive",
    familias: [
      "Playfair+Display:ital,wght@0,400;0,600;0,700;1,400",
      "Lato:wght@300;400;700",
      "Parisienne",
    ],
  },
  moderna: {
    nombre: "Moderna",
    descripcion: "Líneas limpias y espaciado amplio. Minimalismo contemporáneo.",
    display: "'Italiana', Georgia, serif",
    cuerpo: "'Jost', system-ui, sans-serif",
    script: "'Sacramento', cursive",
    familias: ["Italiana", "Jost:wght@200;300;400;500;600", "Sacramento"],
  },
  editorial: {
    nombre: "Editorial",
    descripcion: "Alto contraste tipo revista de moda. Sofisticada y audaz.",
    display: "'Bodoni Moda', Georgia, serif",
    cuerpo: "'Montserrat', system-ui, sans-serif",
    script: "'Pinyon Script', cursive",
    familias: [
      "Bodoni+Moda:ital,opsz,wght@0,6..96,400;0,6..96,600;1,6..96,400",
      "Montserrat:wght@200;300;400;500;600",
      "Pinyon+Script",
    ],
  },
  calida: {
    nombre: "Cálida",
    descripcion: "Serif humanista y trazo suelto. Cercana y acogedora.",
    display: "'Marcellus', Georgia, serif",
    cuerpo: "'Karla', system-ui, sans-serif",
    script: "'Alex Brush', cursive",
    familias: ["Marcellus", "Karla:wght@300;400;500;600", "Alex+Brush"],
  },
  deco: {
    nombre: "Déco",
    descripcion: "Geometría de los años 20. Glamour de gala.",
    display: "'Poiret One', Georgia, serif",
    cuerpo: "'Josefin Sans', system-ui, sans-serif",
    script: "'Monsieur La Doulaise', cursive",
    familias: ["Poiret+One", "Josefin+Sans:wght@200;300;400;500;600", "Monsieur+La+Doulaise"],
  },
  celeste: {
    nombre: "Celeste",
    descripcion: "Serif etérea y ligera, con caligrafía fina. Ideal para noches estrelladas.",
    display: "'Cormorant Garamond', Georgia, serif",
    cuerpo: "'Raleway', system-ui, sans-serif",
    script: "'Petit Formal Script', cursive",
    familias: [
      "Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300",
      "Raleway:wght@200;300;400;500;600",
      "Petit+Formal+Script",
    ],
  },
  boho: {
    nombre: "Boho",
    descripcion: "Serif con carácter setentero y trazo espontáneo. Cálida y libre.",
    display: "'Yeseva One', Georgia, serif",
    cuerpo: "'Nunito Sans', system-ui, sans-serif",
    script: "'Caveat', cursive",
    familias: ["Yeseva+One", "Nunito+Sans:wght@300;400;600;700", "Caveat:wght@400;600"],
  },
  cinema: {
    nombre: "Cinema",
    descripcion: "Condensada y rotunda, como un cartel de cine. Impacto inmediato.",
    display: "'Anton', Impact, sans-serif",
    cuerpo: "'Inter', system-ui, sans-serif",
    script: "'Style Script', cursive",
    familias: ["Anton", "Inter:wght@200;300;400;500;600", "Style+Script"],
  },
  delicada: {
    nombre: "Delicada",
    descripcion: "Sans elegante de trazo fino con remate caligráfico. Serena y limpia.",
    display: "'Tenor Sans', system-ui, sans-serif",
    cuerpo: "'Mulish', system-ui, sans-serif",
    script: "'Petit Formal Script', cursive",
    familias: ["Tenor+Sans", "Mulish:wght@200;300;400;500;600", "Petit+Formal+Script"],
  },
};

export const TIPOGRAFIA_POR_DEFECTO = "clasica_real";

export function tipografia(id?: string): Tipografia {
  return TIPOGRAFIAS[id ?? ""] ?? TIPOGRAFIAS[TIPOGRAFIA_POR_DEFECTO];
}

/** URL de Google Fonts con solo las familias que la invitación necesita. */
export function urlFuentes(idTipografia?: string): string {
  const t = tipografia(idTipografia);
  const familias = t.familias.map((f) => `family=${f}`).join("&");
  return `https://fonts.googleapis.com/css2?${familias}&display=swap`;
}

/* ============================================================
   VARIABLES CSS
   ============================================================ */

export function variablesDeDiseno(idPaleta?: string, idTipografia?: string): React.CSSProperties {
  const p = paleta(idPaleta);
  const t = tipografia(idTipografia);
  return {
    "--inv-fondo": p.fondo,
    "--inv-tarjeta": p.tarjeta,
    "--inv-acento": p.acento,
    "--inv-acento-claro": p.acentoClaro,
    "--inv-texto": p.texto,
    "--inv-texto-suave": p.textoSuave,
    "--inv-display": t.display,
    "--inv-cuerpo": t.cuerpo,
    "--inv-script": t.script,
    // Borde sutil derivado del acento
    "--inv-linea": `color-mix(in srgb, ${p.acento} 30%, transparent)`,
  } as React.CSSProperties;
}
