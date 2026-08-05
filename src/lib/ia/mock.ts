import { semillaDeBrief } from "./brief";
import type {
  BriefCreativo, ConceptoCreativo, ProveedorCreativo, ResultadoGeneracion,
} from "./tipos";
import type { TipoEvento } from "../tipos";

/**
 * EL PROVEEDOR MOCK — el pipeline completo sin gastar un token
 * =============================================================
 * Propone tres conceptos de verdad usables, compuestos con el catálogo
 * real del sistema de diseño. Existe por tres razones:
 *
 *  1. El equipo usa el flujo HOY, sin clave de API ni coste.
 *  2. Las pruebas ejercitan todo el pipeline (brief → conceptos →
 *     validación → aplicar) sin red.
 *  3. Cuando se conecte el proveedor real, todo lo demás ya está rodado:
 *     solo cambia quién propone.
 *
 * Es determinista: mismo brief + mismo intento = mismos conceptos
 * (semilla FNV, sin Math.random). "Regenerar" sube el intento y rota las
 * combinaciones. Cada tanda trae tres ARQUETIPOS distintos a propósito —
 * seguro / distintivo / editorial — como pide el flujo creativo: que
 * elegir sea elegir.
 *
 * Lo que el mock NUNCA hace: inventar la historia de la pareja, tocar
 * fechas o lugares, o proponer algo fuera del catálogo.
 */

interface Arquetipo {
  nombre: string;
  idea: string;
  /** Combinaciones plantilla/paleta/tipografía coherentes con el arquetipo. */
  combos: { plantilla: string; paleta: string; tipografia: string }[];
  densidad: "sobrio" | "equilibrado" | "extravagante";
  riesgo?: string;
}

/** Tres arquetipos por tipo de evento, con combos del catálogo real. */
const ARQUETIPOS: Record<TipoEvento, [Arquetipo, Arquetipo, Arquetipo]> = {
  boda: [
    {
      nombre: "Gala clásica",
      idea: "Lo ceremonioso de siempre, hecho con oficio: serif romana, dorados medidos y aire solemne. Fácil de aprobar y difícil de envejecer.",
      combos: [
        { plantilla: "editorial", paleta: "dorado_negro", tipografia: "clasica_real" },
        { plantilla: "barroco", paleta: "marfil_oro", tipografia: "editorial" },
        { plantilla: "arco", paleta: "champan_perla", tipografia: "clasica_real" },
      ],
      densidad: "equilibrado",
    },
    {
      nombre: "Jardín romántico",
      idea: "Verdes profundos y flores discretas: la boda contada como un paseo de noche por un jardín. Cálida sin ser cursi.",
      combos: [
        { plantilla: "jardin", paleta: "bosque_crema", tipografia: "romantica" },
        { plantilla: "botanica", paleta: "blanco_verde", tipografia: "delicada" },
        { plantilla: "acuarela", paleta: "rosa_dorado", tipografia: "romantica" },
      ],
      densidad: "extravagante",
      riesgo: "Pide fotos con naturaleza; con fotos de estudio pierde parte del encanto.",
    },
    {
      nombre: "Editorial moderna",
      idea: "Composición de revista: mucho aire, tipografía protagonista y las fotos mandando. Para parejas que quieren menos adorno y más presencia.",
      combos: [
        { plantilla: "moderna", paleta: "blanco_negro", tipografia: "moderna" },
        { plantilla: "cinema", paleta: "grafito_plata", tipografia: "cinema" },
        { plantilla: "editorial", paleta: "onix_oro_rosa", tipografia: "editorial" },
      ],
      densidad: "sobrio",
      riesgo: "El minimalismo delata las fotos flojas: funciona mejor con buena fotografía.",
    },
  ],
  cumpleanos: [
    {
      nombre: "Celebración luminosa",
      idea: "Colores cálidos y ritmo alegre sin perder elegancia: una fiesta que se ve fiesta desde la portada.",
      combos: [
        { plantilla: "tropical", paleta: "coral_palma", tipografia: "calida" },
        { plantilla: "acuarela", paleta: "durazno_crema", tipografia: "delicada" },
        { plantilla: "boho", paleta: "terracota", tipografia: "boho" },
      ],
      densidad: "equilibrado",
    },
    {
      nombre: "Noche celestial",
      idea: "Azules de noche y destellos: pensada para quinceañeras y cumpleaños que quieren su momento de cielo.",
      combos: [
        { plantilla: "celestial", paleta: "azul_plata", tipografia: "celeste" },
        { plantilla: "celestial", paleta: "lavanda_perla", tipografia: "delicada" },
        { plantilla: "deco", paleta: "azul_rey_oro", tipografia: "deco" },
      ],
      densidad: "extravagante",
    },
    {
      nombre: "Fiesta de autor",
      idea: "Estética de cartel de cine: tipografía fuerte y paleta contenida. Para quien quiere una invitación que no parezca de plantilla.",
      combos: [
        { plantilla: "cinema", paleta: "cobre_noche", tipografia: "cinema" },
        { plantilla: "moderna", paleta: "vino_nude", tipografia: "moderna" },
        { plantilla: "deco", paleta: "dorado_negro", tipografia: "deco" },
      ],
      densidad: "sobrio",
    },
  ],
  empresarial: [
    {
      nombre: "Corporativa impecable",
      idea: "Sobria, legible y directa: la información primero, con un acento de color que respeta la marca.",
      combos: [
        { plantilla: "moderna", paleta: "grafito_plata", tipografia: "moderna" },
        { plantilla: "editorial", paleta: "blanco_negro", tipografia: "editorial" },
        { plantilla: "moderna", paleta: "azul_plata", tipografia: "moderna" },
      ],
      densidad: "sobrio",
    },
    {
      nombre: "Gala de empresa",
      idea: "Para el aniversario o la premiación: el tono formal de una boda de gala puesto al servicio de la marca.",
      combos: [
        { plantilla: "deco", paleta: "dorado_negro", tipografia: "deco" },
        { plantilla: "editorial", paleta: "champan_perla", tipografia: "clasica_real" },
        { plantilla: "cinema", paleta: "cobre_noche", tipografia: "cinema" },
      ],
      densidad: "equilibrado",
    },
    {
      nombre: "Lanzamiento fresco",
      idea: "Más color y menos corbata: para eventos de producto o equipos jóvenes que no quieren verse acartonados.",
      combos: [
        { plantilla: "tropical", paleta: "turquesa_arena", tipografia: "calida" },
        { plantilla: "arco", paleta: "menta_blanco", tipografia: "delicada" },
        { plantilla: "boho", paleta: "mostaza_tierra", tipografia: "boho" },
      ],
      densidad: "equilibrado",
      riesgo: "Confírmalo contra el manual de marca del cliente antes de enseñarlo.",
    },
  ],
  otro: [
    {
      nombre: "Elegante versátil",
      idea: "La apuesta segura para cualquier celebración: clásica, cálida y sin estridencias.",
      combos: [
        { plantilla: "editorial", paleta: "marfil_oro", tipografia: "editorial" },
        { plantilla: "arco", paleta: "champan_perla", tipografia: "clasica_real" },
        { plantilla: "acuarela", paleta: "celeste_nube", tipografia: "delicada" },
      ],
      densidad: "equilibrado",
    },
    {
      nombre: "Natural y cercana",
      idea: "Tonos de tierra y ornamento suave: una celebración que se siente hecha a mano.",
      combos: [
        { plantilla: "boho", paleta: "terracota", tipografia: "boho" },
        { plantilla: "botanica", paleta: "bosque_crema", tipografia: "romantica" },
        { plantilla: "jardin", paleta: "blanco_verde", tipografia: "delicada" },
      ],
      densidad: "equilibrado",
    },
    {
      nombre: "Moderna con carácter",
      idea: "Tipografía al frente y paleta contenida: para eventos que quieren distinguirse sin decorarse.",
      combos: [
        { plantilla: "moderna", paleta: "blanco_negro", tipografia: "moderna" },
        { plantilla: "cinema", paleta: "grafito_plata", tipografia: "cinema" },
        { plantilla: "deco", paleta: "lila_dorado", tipografia: "deco" },
      ],
      densidad: "sobrio",
    },
  ],
};

/** Copy corto por tipo de evento. Poético y genérico a propósito: cero hechos. */
const COPY: Record<TipoEvento, { subtitulo: string; frase: string; mensajeFinal: string }[]> = {
  boda: [
    {
      subtitulo: "¡Nos casamos!",
      frase: "Y así, sin darnos cuenta, nos elegimos para siempre.",
      mensajeFinal: "Gracias por ser parte de nuestra historia.",
    },
    {
      subtitulo: "Vamos a celebrar el amor",
      frase: "Dos caminos que se encuentran y deciden no separarse más.",
      mensajeFinal: "Tu compañía es el mejor regalo.",
    },
    {
      subtitulo: "El comienzo de todo",
      frase: "Lo mejor que nos ha pasado merece celebrarse contigo.",
      mensajeFinal: "Nos vemos en el día más feliz de nuestras vidas.",
    },
  ],
  cumpleanos: [
    {
      subtitulo: "¡Estás invitado a celebrar!",
      frase: "Una vuelta más al sol merece buena música y mejor compañía.",
      mensajeFinal: "Gracias por celebrar conmigo.",
    },
    {
      subtitulo: "Una noche para brillar",
      frase: "Hay fechas que se cumplen y fechas que se celebran en grande.",
      mensajeFinal: "Te espero para hacer de esta noche un recuerdo.",
    },
    {
      subtitulo: "Que empiece la fiesta",
      frase: "Los años se cuentan mejor entre amigos.",
      mensajeFinal: "Tu presencia es el mejor regalo.",
    },
  ],
  empresarial: [
    {
      subtitulo: "Tenemos el gusto de invitarle",
      frase: "Un encuentro para compartir lo que viene.",
      mensajeFinal: "Le esperamos.",
    },
    {
      subtitulo: "Celebremos juntos este logro",
      frase: "Lo construido en equipo se celebra en equipo.",
      mensajeFinal: "Gracias por ser parte de este camino.",
    },
    {
      subtitulo: "Está cordialmente invitado",
      frase: "Una noche para reconocer el trabajo y brindar por lo que sigue.",
      mensajeFinal: "Será un honor contar con su presencia.",
    },
  ],
  otro: [
    {
      subtitulo: "Te invitamos a celebrar",
      frase: "Hay momentos que piden compartirse.",
      mensajeFinal: "Gracias por acompañarnos.",
    },
    {
      subtitulo: "Una fecha para recordar",
      frase: "Lo importante no es el día: es con quién se celebra.",
      mensajeFinal: "Te esperamos con alegría.",
    },
    {
      subtitulo: "Acompáñanos en este día",
      frase: "Las mejores historias se escriben con la gente que uno quiere.",
      mensajeFinal: "Nos vemos para celebrar juntos.",
    },
  ],
};

export const proveedorMock: ProveedorCreativo = {
  async generarConceptos(brief: BriefCreativo, intento: number): Promise<ResultadoGeneracion> {
    const inicio = Date.now();
    const semilla = semillaDeBrief(brief, intento);
    const arquetipos = ARQUETIPOS[brief.tipoEvento] ?? ARQUETIPOS.otro;
    const copys = COPY[brief.tipoEvento] ?? COPY.otro;

    const conceptos: ConceptoCreativo[] = arquetipos.map((arquetipo, i) => {
      // Cada arquetipo rota su combo con la semilla y el intento: regenerar
      // propone combinaciones nuevas sin salirse del carácter del arquetipo.
      const combo = arquetipo.combos[(semilla + i) % arquetipo.combos.length];
      const copy = copys[(semilla + i) % copys.length];
      const concepto: ConceptoCreativo = {
        nombre: arquetipo.nombre,
        idea: arquetipo.idea,
        plantilla: combo.plantilla,
        paleta: combo.paleta,
        tipografia: combo.tipografia,
        densidad: arquetipo.densidad,
        copy: { ...copy },
      };
      if (arquetipo.riesgo) concepto.riesgo = arquetipo.riesgo;
      return concepto;
    });

    return {
      conceptos,
      proveedor: "mock",
      modelo: "mock-determinista",
      promptVersion: "mock-1.0",
      tokensEntrada: 0,
      tokensSalida: 0,
      costoEstimadoUsd: 0,
      latenciaMs: Date.now() - inicio,
    };
  },
};
