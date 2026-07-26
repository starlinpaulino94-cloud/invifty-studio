/**
 * CATÁLOGO DE PLANTILLAS DE INVITACIÓN
 * =====================================
 * Cada plantilla tiene una personalidad visual propia (no es solo un cambio
 * de color): distinta portada, distinta decoración y distinto ritmo.
 *
 * Para añadir una plantilla nueva:
 *  1. Crea el componente en src/components/invitacion/plantillas/
 *  2. Regístrala aquí y en el Renderizador.
 */

export interface PlantillaMeta {
  id: string;
  nombre: string;
  descripcion: string;
  /** Para qué eventos luce mejor (solo orientativo en el editor) */
  ideal: string;
  /** Sugerencias por defecto al elegirla */
  paletaSugerida: string;
  tipografiaSugerida: string;
}

export const PLANTILLAS: PlantillaMeta[] = [
  {
    id: "editorial",
    nombre: "Editorial Luxe",
    descripcion:
      "Portada a pantalla completa con monograma, filigranas doradas y tipografía romana. La más ceremoniosa.",
    ideal: "Bodas de gala · Galas corporativas",
    paletaSugerida: "dorado_negro",
    tipografiaSugerida: "clasica_real",
  },
  {
    id: "botanica",
    nombre: "Botánica",
    descripcion:
      "Ramas y hojas dibujadas a mano enmarcando cada sección, con tarjeta de papel y caligrafía.",
    ideal: "Bodas al aire libre · Baby showers · Bautizos",
    paletaSugerida: "blanco_verde",
    tipografiaSugerida: "romantica",
  },
  {
    id: "moderna",
    nombre: "Moderna",
    descripcion:
      "Composición asimétrica, mucho aire, tipografía enorme y detalles mínimos. Muy actual.",
    ideal: "Bodas minimalistas · Lanzamientos · Cumpleaños de adulto",
    paletaSugerida: "blanco_negro",
    tipografiaSugerida: "moderna",
  },
  {
    id: "deco",
    nombre: "Art Déco",
    descripcion:
      "Geometría dorada de los años 20, marcos escalonados y abanicos. Glamour puro.",
    ideal: "15 años · Galas · Aniversarios",
    paletaSugerida: "esmeralda_oro",
    tipografiaSugerida: "deco",
  },
  {
    id: "tropical",
    nombre: "Tropical Caribe",
    descripcion:
      "Palmas, sol y textura de arena. Cálida y luminosa, pensada para el Caribe.",
    ideal: "Bodas de playa · Destino · Fiestas de verano",
    paletaSugerida: "coral_palma",
    tipografiaSugerida: "calida",
  },
  {
    id: "arco",
    nombre: "Arco",
    descripcion:
      "La fotografía recortada dentro de un arco perfilado, con el nombre sereno debajo. La forma más pedida hoy en papelería de bodas.",
    ideal: "Bodas modernas · Bautizos · Compromisos",
    paletaSugerida: "malva_perla",
    tipografiaSugerida: "delicada",
  },
  {
    id: "celestial",
    nombre: "Celestial",
    descripcion:
      "Cielo estrellado, luna creciente y monograma entre constelaciones. Mágica y envolvente.",
    ideal: "Bodas de noche · 15 años · Galas",
    paletaSugerida: "azul_rey_oro",
    tipografiaSugerida: "celeste",
  },
  {
    id: "acuarela",
    nombre: "Acuarela",
    descripcion:
      "Aguadas de color difuminadas y retrato en óvalo. Dulce, artesanal y muy cálida.",
    ideal: "Baby showers · Bautizos · Primeras comuniones",
    paletaSugerida: "durazno_crema",
    tipografiaSugerida: "romantica",
  },
  {
    id: "cinema",
    nombre: "Cinema",
    descripcion:
      "Fotografía a sangre con bandas de cine, título condensado enorme y ficha técnica a modo de créditos.",
    ideal: "Lanzamientos · Cumpleaños de adulto · Bodas de destino",
    paletaSugerida: "grafito_plata",
    tipografiaSugerida: "cinema",
  },
  {
    id: "jardin",
    nombre: "Jardín Encantado",
    descripcion:
      "Retrato en óvalo envuelto por guirnaldas y ramos que crecen desde las esquinas. El follaje es la estructura, no un adorno añadido.",
    ideal: "Bodas al aire libre · 15 años románticos · Baby showers",
    paletaSugerida: "blanco_verde",
    tipografiaSugerida: "romantica",
  },
  {
    id: "barroco",
    nombre: "Barroco",
    descripcion:
      "Monograma en cartucho ovalado, volutas de acanto en las cuatro esquinas y doble marco. Filigrana densa y simetría estricta.",
    ideal: "Galas · 15 años de etiqueta · Aniversarios",
    paletaSugerida: "dorado_negro",
    tipografiaSugerida: "editorial",
  },
  {
    id: "boho",
    nombre: "Boho Retro",
    descripcion:
      "Sol de rayos setenteros, arcos y ondas en tonos tierra. Desenfadada y con carácter.",
    ideal: "Bodas boho · Fiestas al aire libre · Despedidas",
    paletaSugerida: "mostaza_tierra",
    tipografiaSugerida: "boho",
  },
];

export const PLANTILLA_POR_DEFECTO = "editorial";

export function plantillaMeta(id?: string): PlantillaMeta {
  // 'clasica' era el id de la primera versión: se mapea a Editorial.
  const buscado = !id || id === "clasica" ? PLANTILLA_POR_DEFECTO : id;
  return PLANTILLAS.find((p) => p.id === buscado) ?? PLANTILLAS[0];
}
