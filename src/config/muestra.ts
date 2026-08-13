import { EFECTOS_POR_DEFECTO } from "@/lib/tipos";
import type { DatosInvitacion } from "@/lib/tipos";
import { escenasMuestra, type EscenaEvento } from "./escenas-muestra";
import { plantillaMeta } from "./plantillas";

/**
 * Datos de ejemplo para el catálogo de plantillas del panel.
 * Permiten ver cómo luce cada diseño antes de elegirlo.
 */

/** Fotografía ficticia (degradado suave) para que la portada no salga vacía. */
export function fotoMuestra(tono: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${tono}" stop-opacity="0.95"/>
        <stop offset="55%" stop-color="#8d8577" stop-opacity="0.75"/>
        <stop offset="100%" stop-color="#2b2823" stop-opacity="0.9"/>
      </linearGradient>
      <filter id="b"><feGaussianBlur stdDeviation="26"/></filter>
    </defs>
    <rect width="900" height="1200" fill="url(#g)"/>
    <g filter="url(#b)" opacity=".55">
      <circle cx="300" cy="380" r="190" fill="#ffffff" opacity=".35"/>
      <circle cx="640" cy="760" r="240" fill="#000000" opacity=".3"/>
      <circle cx="180" cy="980" r="150" fill="#ffffff" opacity=".2"/>
    </g>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function datosMuestra(plantillaId: string): DatosInvitacion {
  const meta = plantillaMeta(plantillaId);

  const base: DatosInvitacion = {
    titulo: "Camila & Lucas",
    subtitulo: "Nos casamos",
    frase: "Y así, sin darnos cuenta, nos elegimos para siempre",
    fechaEvento: proximaFecha(),
    horaEvento: "16:30",
    lugares: [
      { nombre: "Ceremonia", detalle: "Iglesia San Estanislao, Altos de Chavón, La Romana" },
      { nombre: "Recepción", detalle: "Anfiteatro Altos de Chavón, La Romana" },
    ],
    dressCode: "formal",
    paleta: meta.paletaSugerida,
    tipografia: meta.tipografiaSugerida,
    historia:
      "Nos conocimos una tarde de abril en Santo Domingo, cuando el destino nos sentó en la misma mesa de un café que ninguno de los dos solía visitar.\n\nSiete años y un sinfín de viajes después, Lucas preparó una cena en la terraza donde tuvimos nuestra primera conversación. Allí, con el mar de fondo, dijimos que sí para toda la vida.",
    cronograma: [
      { hora: "16:30", actividad: "Ceremonia religiosa" },
      { hora: "18:00", actividad: "Cóctel de bienvenida" },
      { hora: "20:00", actividad: "Cena y brindis" },
      { hora: "22:00", actividad: "Primer baile" },
      { hora: "23:00", actividad: "¡Hora loca!" },
    ],
    regalos: [
      { titulo: "Cuenta Banreservas", detalle: "9601234567 · Camila Rodríguez" },
      { titulo: "Lista de regalos", detalle: "https://www.amazon.com/wedding/registry" },
    ],
    padrinos: [
      { rol: "Padrinos de anillos", nombre: "Carmen & José Rodríguez" },
      { rol: "Madrina de honor", nombre: "Valeria Herrera" },
      { rol: "Padrino de honor", nombre: "Daniel Almanzar" },
    ],
    notas: [
      { titulo: "Parqueo", texto: "Valet parking disponible sin costo en la entrada principal." },
      { titulo: "Solo adultos", texto: "Con todo el cariño, hemos reservado esta celebración para adultos." },
    ],
    mensajeFinal: "Nos hará muy felices contar contigo en este día",
    hashtag: "#CamilaYLucas2026",
    musicaUrl: "",
    rsvp: { whatsapp: "18092693214", fechaLimite: proximaFecha(-30), acompanantes: true },
    efectos: { ...EFECTOS_POR_DEFECTO },
    secciones: {
      historia: true,
      galeria: true,
      cronograma: true,
      regalos: true,
      rsvp: true,
      padrinos: true,
      notas: true,
    },
  };

  // Ajustes de contenido para que cada plantilla se vea en su contexto
  switch (meta.id) {
    case "deco":
      return {
        ...base,
        titulo: "Valeria Sofía",
        subtitulo: "Mis 15 años",
        frase: "Una noche para recordar toda la vida",
        historia:
          "Hace quince años llegó a nuestras vidas para llenarlas de música y color. Hoy celebramos a la mujer en la que se está convirtiendo.",
        padrinos: [
          { rol: "Chambelán de honor", nombre: "Sebastián Peña" },
          { rol: "Damas de compañía", nombre: "Ana, Lucía y Paola" },
        ],
        hashtag: "#Valeria15",
        mensajeFinal: "¡Te espero para celebrar juntos!",
      };
    case "moderna":
      return {
        ...base,
        titulo: "Gala de Innovación",
        subtitulo: "Vitrexi Technologies",
        frase: "Una noche para celebrar lo que viene",
        historia: "",
        padrinos: [
          { rol: "CEO, Vitrexi", nombre: "Ing. María Gómez" },
          { rol: "Conferencista invitado", nombre: "Dr. Rafael Núñez" },
        ],
        lugares: [{ nombre: "El evento", detalle: "Hotel El Embajador, Salón Embassy, Santo Domingo" }],
        regalos: [],
        hashtag: "#Vitrexi2026",
        mensajeFinal: "Será un honor contar con su presencia",
        secciones: { ...base.secciones, historia: false, regalos: false },
      };
    case "acuarela":
      return {
        ...base,
        titulo: "Mateo",
        subtitulo: "¡Ya viene en camino!",
        frase: "Un pequeño milagro está por llegar",
        historia:
          "Después de tanto esperarte, contamos los días para tenerte en brazos. Queremos celebrar tu llegada con las personas que más te van a querer.",
        dressCode: "libre",
        lugares: [{ nombre: "El baby shower", detalle: "Terraza Casa de Campo, La Romana" }],
        padrinos: [{ rol: "Futuros papás", nombre: "Ana & Miguel" }],
        cronograma: [
          { hora: "15:00", actividad: "Recepción y merienda" },
          { hora: "16:00", actividad: "Juegos y dinámicas" },
          { hora: "17:30", actividad: "Apertura de regalos" },
        ],
        hashtag: "#BienvenidoMateo",
        mensajeFinal: "Gracias por acompañarnos en esta etapa tan especial",
      };
    case "cinema":
      return {
        ...base,
        titulo: "L'Élite",
        subtitulo: "Gran apertura",
        frase: "Una nueva era del lujo abre sus puertas en Piantini.",
        historia: "",
        dressCode: "formal",
        lugares: [{ nombre: "La boutique", detalle: "Torre Empresarial Piantini, Santo Domingo" }],
        regalos: [],
        padrinos: [{ rol: "Anfitriona", nombre: "Marié Belliard" }],
        hashtag: "#LEliteOpening",
        mensajeFinal: "Te esperamos en la inauguración",
        secciones: { ...base.secciones, historia: false, regalos: false },
      };
    case "boho":
      return {
        ...base,
        frase: "Bajo el sol, entre flores y buena música",
        dressCode: "libre",
        lugares: [{ nombre: "La celebración", detalle: "Finca Los Almendros, Jarabacoa" }],
        notas: [
          { titulo: "Al aire libre", texto: "La fiesta es en el jardín: te sugerimos calzado cómodo." },
          { titulo: "Transporte", texto: "Habrá bus de cortesía desde Santo Domingo a las 2:00 p. m." },
        ],
        hashtag: "#CamilaYLucasEnJarabacoa",
      };
    case "celestial":
      return {
        ...base,
        frase: "Escrito en las estrellas mucho antes de conocernos",
        historia:
          "Dicen que hay encuentros que ya estaban escritos. El nuestro ocurrió una noche de verano, mirando el mismo cielo bajo el que hoy nos daremos el sí.",
        cronograma: [
          { hora: "19:00", actividad: "Ceremonia bajo las estrellas" },
          { hora: "20:30", actividad: "Cóctel de bienvenida" },
          { hora: "22:00", actividad: "Cena y brindis" },
          { hora: "00:00", actividad: "Fiesta hasta el amanecer" },
        ],
        horaEvento: "19:00",
      };
    case "tropical":
      return {
        ...base,
        frase: "Con los pies en la arena y el corazón lleno",
        dressCode: "playa",
        lugares: [{ nombre: "La celebración", detalle: "Playa Bávaro, Punta Cana" }],
        notas: [
          { titulo: "Calzado", texto: "La ceremonia es en la arena: te recomendamos sandalias." },
          { titulo: "Hospedaje", texto: "Tarifa especial para invitados en el resort. Pregúntanos." },
        ],
      };
    default:
      return base;
  }
}

function proximaFecha(diasDesplazamiento = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + 96 + diasDesplazamiento);
  return d.toISOString().slice(0, 10);
}

/**
 * Fotos de muestra acordes al EVENTO de cada plantilla y tintadas con su
 * paleta: los novios y la preboda donde la muestra es una boda, la
 * corona y el vestido en los quince (Art Déco), el skyline en las
 * corporativas (Moderna, Cinema) y el cochecito en el baby shower
 * (Acuarela). El arte vive en config/escenas-muestra.ts; el evento de
 * cada plantilla tiene que coincidir con lo que cuentan sus
 * `datosMuestra` de arriba — la portada y el texto son una sola escena.
 */
export function fotosMuestra(plantillaId: string) {
  const tonos: Record<string, string> = {
    editorial: "#c9b184",
    botanica: "#9fae8e",
    moderna: "#b9b9b9",
    deco: "#b99a5e",
    tropical: "#f0a97f",
    arco: "#c6a7ae",
    celestial: "#8fa4c8",
    acuarela: "#f2b795",
    cinema: "#a8a8ac",
    boho: "#d6a765",
    jardin: "#a8bd97",
    barroco: "#c2a558",
  };
  const eventos: Record<string, EscenaEvento> = {
    deco: "quince",
    moderna: "empresarial",
    cinema: "empresarial",
    acuarela: "baby",
  };

  const id = plantillaMeta(plantillaId).id;
  return escenasMuestra(eventos[id] ?? "boda", tonos[id] ?? "#c9b184");
}
