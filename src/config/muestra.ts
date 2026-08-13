import { EFECTOS_POR_DEFECTO } from "@/lib/tipos";
import type { DatosInvitacion } from "@/lib/tipos";
import { plantillaMeta } from "./plantillas";

/**
 * Datos de ejemplo para el catálogo de plantillas del panel.
 * Permiten ver cómo luce cada diseño antes de elegirlo.
 */

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
 * Fotos de muestra acordes al EVENTO de cada plantilla: los novios y la
 * preboda donde la muestra es una boda, la quinceañera en los quince
 * (Art Déco), la gala en las corporativas (Moderna, Cinema) y el baby
 * shower en Acuarela. Son FOTOGRAFÍAS reales curadas por el propietario
 * (public/muestra/, optimizadas a 900×1200 WebP; procedencia y licencias
 * en docs/creditos-fotos-muestra.md). El evento de cada plantilla tiene
 * que coincidir con lo que cuentan sus `datosMuestra` de arriba — la
 * portada y el texto son una sola escena, y la PRIMERA foto es la
 * portada.
 */
type EventoMuestra = "boda" | "quince" | "empresa" | "baby";

const FOTOS_POR_EVENTO: Record<EventoMuestra, string[]> = {
  boda: [
    "boda-1-novios",
    "boda-2-preboda",
    "boda-3-anillos",
    "boda-4-brindis",
    "boda-5-ramo",
    "boda-6-sesion",
    "boda-7-ceremonia",
  ],
  quince: [
    "quince-1-quinceanera",
    "quince-2-vestido",
    "quince-3-corona",
    "quince-4-espejo",
    "quince-5-jardin",
    "quince-6-celebracion",
  ],
  empresa: [
    "empresa-1-gala",
    "empresa-2-conferencia",
    "empresa-3-networking",
    "empresa-4-vistas",
    "empresa-5-mesa",
    "empresa-6-escenario",
  ],
  baby: [
    "baby-1-ositos",
    "baby-2-mama",
    "baby-3-recien-nacido",
    "baby-4-mesa-dulce",
    "baby-5-globos",
    "baby-6-fiesta",
  ],
};

export function fotosMuestra(plantillaId: string) {
  const eventos: Record<string, EventoMuestra> = {
    deco: "quince",
    moderna: "empresa",
    cinema: "empresa",
    acuarela: "baby",
  };

  const evento = eventos[plantillaMeta(plantillaId).id] ?? "boda";
  return FOTOS_POR_EVENTO[evento].map((nombre) => ({
    nombre: `${nombre}.webp`,
    url: `/muestra/${nombre}.webp`,
  }));
}
