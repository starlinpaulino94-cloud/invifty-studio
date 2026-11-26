/**
 * LA ADUANA DEL SVG — porque un SVG es código, no una imagen
 * ===========================================================
 * Un PNG es píxeles: lo peor que puede hacer es verse mal. Un SVG es un
 * documento XML que el navegador EJECUTA: admite <script>, atributos
 * `onload`, <foreignObject> con HTML dentro, referencias a dominios
 * ajenos y `javascript:` en un enlace. Pintar con dangerouslySetInnerHTML
 * un SVG que escribió un modelo —o cualquiera que logre colarse en el
 * camino— es abrir XSS en el celular de cada invitado de la boda.
 *
 * Así que aquí no se "limpia" el SVG del modelo: se RECONSTRUYE. Lo que
 * sale de esta función no es el texto que entró con lo malo borrado, es un
 * documento nuevo armado SOLO con las etiquetas, atributos y valores que
 * la lista blanca de abajo permite. Si algo no se entiende, no se arregla:
 * se rechaza con motivo. Un adorno que no se pinta es un adorno que falta;
 * un adorno que ejecuta código es una llamada de madrugada.
 *
 * Decisiones deliberadas, por si parecen excesivas:
 *  - NO se permite texto (ni <text>, ni <tspan>, ni nodos de texto). El
 *    monograma se DIBUJA en trazos, que además es lo que lo hace arte y no
 *    dos letras de una fuente. De paso, sin texto no hay nodo donde
 *    esconder nada.
 *  - NO se permite `&`. El SVG de un adorno no necesita entidades, y las
 *    entidades son el sitio clásico donde se esconde lo prohibido
 *    (`&#106;avascript:`).
 *  - NO se permite `style`, `class` ni `filter`: todo el color va en
 *    atributos de presentación, que sabemos validar uno por uno.
 *  - Toda referencia `url(#algo)` tiene que apuntar a un id definido
 *    DENTRO del mismo documento. Sin eso, un degradado puede señalar a un
 *    recurso de fuera.
 */

export const LIMITES_SVG = {
  /** Caracteres del SVG crudo. Un adorno honesto cabe de sobra. */
  caracteres: 24_000,
  /** Etiquetas totales. Un trazado complejo cabe; un bucle no. */
  nodos: 400,
  /** Niveles de anidamiento. */
  profundidad: 8,
  /** Lado máximo del viewBox. */
  lado: 2000,
  /** Caracteres del atributo `d` de un trazado. */
  trazado: 8_000,
} as const;

/** Etiquetas permitidas. Nada de script, foreignObject, image, use, text. */
const ETIQUETAS = new Set([
  "svg", "g", "defs", "clipPath",
  "path", "circle", "ellipse", "line", "polyline", "polygon", "rect",
  "linearGradient", "radialGradient", "stop",
]);

/** Etiquetas sin hijos. */
const SIN_HIJOS = new Set(["path", "circle", "ellipse", "line", "polyline", "polygon", "rect", "stop"]);

const COLOR = "color";
const NUMERO = "numero";
const LONGITUD = "longitud";
const TRANSFORMACION = "transformacion";

/** Validadores por tipo de valor. Cada atributo declara el suyo. */
const TIPOS: Record<string, (v: string) => boolean> = {
  [NUMERO]: (v) => /^-?(?:\d+|\d*\.\d+)$/.test(v) && Math.abs(Number(v)) <= 100_000,
  [LONGITUD]: (v) => /^-?(?:\d+|\d*\.\d+)%?$/.test(v),
  [COLOR]: esColor,
  [TRANSFORMACION]: esTransformacion,
  trazado: (v) => v.length <= LIMITES_SVG.trazado && /^[MmLlHhVvCcSsQqTtAaZz0-9eE.,+\-\s]+$/.test(v),
  puntos: (v) => v.length <= LIMITES_SVG.trazado && /^[0-9eE.,+\-\s]+$/.test(v),
  caja: esViewBox,
  identificador: (v) => /^[a-zA-Z][a-zA-Z0-9_-]{0,40}$/.test(v),
  referencia: (v) => /^url\(#[a-zA-Z][a-zA-Z0-9_-]{0,40}\)$/.test(v),
  espacioXml: (v) => v === "http://www.w3.org/2000/svg",
  unidades: (v) => v === "objectBoundingBox" || v === "userSpaceOnUse",
  proporcion: (v) => /^(none|x(Min|Mid|Max)Y(Min|Mid|Max)(\s+(meet|slice))?)$/.test(v),
  punta: (v) => v === "butt" || v === "round" || v === "square",
  union: (v) => v === "miter" || v === "round" || v === "bevel",
  regla: (v) => v === "nonzero" || v === "evenodd",
  guiones: (v) => v === "none" || /^[0-9.,\s]+$/.test(v),
};

/** Atributos válidos en cualquier etiqueta que los acepte. */
const GLOBALES: Record<string, string> = {
  id: "identificador",
  transform: TRANSFORMACION,
  opacity: LONGITUD,
  fill: COLOR,
  "fill-opacity": LONGITUD,
  "fill-rule": "regla",
  stroke: COLOR,
  "stroke-width": LONGITUD,
  "stroke-opacity": LONGITUD,
  "stroke-linecap": "punta",
  "stroke-linejoin": "union",
  "stroke-dasharray": "guiones",
  "stroke-miterlimit": NUMERO,
  "clip-path": "referencia",
  "clip-rule": "regla",
};

/** Atributos propios de cada etiqueta, además de los globales. */
const PROPIOS: Record<string, Record<string, string>> = {
  svg: { viewBox: "caja", xmlns: "espacioXml", preserveAspectRatio: "proporcion" },
  path: { d: "trazado" },
  circle: { cx: NUMERO, cy: NUMERO, r: NUMERO },
  ellipse: { cx: NUMERO, cy: NUMERO, rx: NUMERO, ry: NUMERO },
  line: { x1: NUMERO, y1: NUMERO, x2: NUMERO, y2: NUMERO },
  polyline: { points: "puntos" },
  polygon: { points: "puntos" },
  rect: { x: NUMERO, y: NUMERO, width: LONGITUD, height: LONGITUD, rx: NUMERO, ry: NUMERO },
  linearGradient: {
    x1: LONGITUD, y1: LONGITUD, x2: LONGITUD, y2: LONGITUD,
    gradientUnits: "unidades", gradientTransform: TRANSFORMACION,
  },
  radialGradient: {
    cx: LONGITUD, cy: LONGITUD, r: LONGITUD, fx: LONGITUD, fy: LONGITUD,
    gradientUnits: "unidades", gradientTransform: TRANSFORMACION,
  },
  stop: { offset: LONGITUD, "stop-color": COLOR, "stop-opacity": LONGITUD },
  clipPath: { clipPathUnits: "unidades" },
  g: {},
  defs: {},
};

function esColor(v: string): boolean {
  if (v === "none" || v === "currentColor" || v === "transparent") return true;
  if (/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v)) return true;
  return TIPOS.referencia(v);
}

function esViewBox(v: string): boolean {
  const partes = v.trim().split(/[\s,]+/);
  if (partes.length !== 4) return false;
  if (!partes.every((p) => /^-?(?:\d+|\d*\.\d+)$/.test(p))) return false;
  const [, , ancho, alto] = partes.map(Number);
  return ancho > 0 && alto > 0 && ancho <= LIMITES_SVG.lado && alto <= LIMITES_SVG.lado;
}

/**
 * Transformaciones: solo las funciones geométricas, con números dentro.
 * Nada de `url()`, nada de nombres inventados.
 */
function esTransformacion(v: string): boolean {
  let resto = v.trim();
  if (!resto || resto.length > 400) return false;
  const una = /^(?:translate|scale|rotate|matrix|skewX|skewY)\(\s*-?(?:\d+|\d*\.\d+)(?:\s*[,\s]\s*-?(?:\d+|\d*\.\d+))*\s*\)/;
  while (resto) {
    const encaja = resto.match(una);
    if (!encaja) return false;
    resto = resto.slice(encaja[0].length).trim();
  }
  return true;
}

/**
 * Atributos que se ACEPTAN y se TIRAN. El tamaño lo manda la hoja de
 * estilos de la invitación, no el adorno: un `width="800"` colado haría
 * que un ornamento de esquina saliera del tamaño de la pantalla. Se
 * aceptan para no rechazar un SVG entero por un atributo inofensivo que
 * cualquier generador pone por costumbre.
 */
const IGNORADOS: Record<string, Set<string>> = {
  svg: new Set(["width", "height", "version", "xmlns:xlink", "xml:space", "baseProfile"]),
};

interface Etiqueta {
  nombre: string;
  atributos: Array<[string, string]>;
  esCierre: boolean;
  esAuto: boolean;
}

export type ResultadoSvg =
  | { ok: true; svg: string; colores: string[]; nodos: number }
  | { ok: false; motivo: string };

function falla(motivo: string): ResultadoSvg {
  return { ok: false, motivo };
}

/**
 * Convierte el SVG que entra en uno NUEVO con solo lo permitido, o
 * explica por qué no se puede. `coloresPermitidos` (hex en minúsculas)
 * exige además que el adorno use la paleta de ESA invitación: así
 * "trazado para su paleta" es una propiedad comprobada, no una esperanza.
 */
export function sanearSvg(
  crudo: string,
  opciones: { coloresPermitidos?: string[] } = {}
): ResultadoSvg {
  const texto = (crudo ?? "").trim();
  if (!texto) return falla("Vino vacío.");
  if (texto.length > LIMITES_SVG.caracteres) {
    return falla(`Pasa de ${LIMITES_SVG.caracteres} caracteres (${texto.length}).`);
  }
  // Caracteres de control: nunca hacen falta y rompen cualquier análisis.
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(texto)) {
    return falla("Trae caracteres de control.");
  }
  if (texto.includes("&")) return falla("Las entidades (&) no se permiten.");
  if (texto.includes("<!") || texto.includes("<?")) {
    return falla("Trae DOCTYPE, comentario o instrucción de proceso.");
  }

  const permitidos = (opciones.coloresPermitidos ?? []).map((c) => c.toLowerCase());
  const idsDefinidos = new Set<string>();
  const idsReferidos: string[] = [];
  const colores = new Set<string>();
  const pila: string[] = [];
  const salida: string[] = [];
  let nodos = 0;
  let i = 0;

  while (i < texto.length) {
    const siguiente = texto.indexOf("<", i);
    if (siguiente === -1) {
      if (texto.slice(i).trim() !== "") return falla("Texto suelto fuera de las etiquetas.");
      break;
    }
    if (texto.slice(i, siguiente).trim() !== "") {
      // Sin nodos de texto: el arte son trazos, y un nodo de texto es un
      // escondite. El monograma se dibuja, no se escribe.
      return falla("Contiene texto; el arte tiene que ser solo trazos.");
    }

    const leido = leerEtiqueta(texto, siguiente);
    if (!leido) return falla("Hay una etiqueta mal formada.");
    const { etiqueta, fin } = leido;
    i = fin;

    if (!ETIQUETAS.has(etiqueta.nombre)) {
      return falla(`Etiqueta no permitida: <${etiqueta.nombre}>.`);
    }

    if (etiqueta.esCierre) {
      if (pila.pop() !== etiqueta.nombre) return falla("Las etiquetas no cierran en orden.");
      salida.push(`</${etiqueta.nombre}>`);
      continue;
    }

    if (++nodos > LIMITES_SVG.nodos) return falla(`Pasa de ${LIMITES_SVG.nodos} nodos.`);
    if (nodos === 1 && etiqueta.nombre !== "svg") return falla("La raíz tiene que ser <svg>.");
    if (nodos > 1 && etiqueta.nombre === "svg") return falla("No se permite un <svg> dentro de otro.");
    if (pila.length && SIN_HIJOS.has(pila[pila.length - 1])) {
      return falla(`<${pila[pila.length - 1]}> no puede tener hijos.`);
    }

    const validos: string[] = [];
    for (const [nombre, valor] of etiqueta.atributos) {
      if (IGNORADOS[etiqueta.nombre]?.has(nombre)) continue;
      const tipo = PROPIOS[etiqueta.nombre]?.[nombre] ?? GLOBALES[nombre];
      if (!tipo) return falla(`Atributo no permitido en <${etiqueta.nombre}>: ${nombre}.`);
      if (!TIPOS[tipo](valor)) return falla(`Valor inválido en ${nombre}="${valor}".`);

      if (nombre === "id") {
        if (idsDefinidos.has(valor)) return falla(`El id "${valor}" está repetido.`);
        idsDefinidos.add(valor);
      }
      const referencia = valor.match(/^url\(#([a-zA-Z][a-zA-Z0-9_-]*)\)$/);
      if (referencia) idsReferidos.push(referencia[1]);
      if (tipo === COLOR && valor.startsWith("#")) colores.add(normalizarHex(valor));

      validos.push(`${nombre}="${valor}"`);
    }

    if (etiqueta.nombre === "svg" && !etiqueta.atributos.some(([n]) => n === "viewBox")) {
      return falla("Al <svg> le falta el viewBox.");
    }

    const abierta = `<${[etiqueta.nombre, ...validos].join(" ")}`;
    if (etiqueta.esAuto || SIN_HIJOS.has(etiqueta.nombre)) {
      salida.push(`${abierta}/>`);
      if (!etiqueta.esAuto) {
        // <path>…</path> es legal en XML pero aquí no tiene sentido: se
        // normaliza a auto-cerrada y se exige su cierre inmediato.
        const cierre = texto.slice(i).match(/^\s*<\/([a-zA-Z]+)>/);
        if (!cierre || cierre[1] !== etiqueta.nombre) {
          return falla(`<${etiqueta.nombre}> tiene que cerrarse sin hijos.`);
        }
        i += cierre[0].length;
      }
      continue;
    }

    pila.push(etiqueta.nombre);
    if (pila.length > LIMITES_SVG.profundidad) {
      return falla(`Pasa de ${LIMITES_SVG.profundidad} niveles de anidamiento.`);
    }
    salida.push(`${abierta}>`);
  }

  if (pila.length) return falla("Quedaron etiquetas sin cerrar.");
  if (!nodos) return falla("No trae ni una etiqueta.");

  const huerfano = idsReferidos.find((id) => !idsDefinidos.has(id));
  if (huerfano) return falla(`La referencia url(#${huerfano}) no apunta a nada de dentro.`);

  if (permitidos.length) {
    const intruso = [...colores].find((c) => !permitidos.includes(c));
    if (intruso) return falla(`Usa el color ${intruso}, que no está en la paleta.`);
  }

  return { ok: true, svg: salida.join(""), colores: [...colores], nodos };
}

/** `#ABC` y `#aabbcc` son el mismo color; se comparan iguales. */
function normalizarHex(hex: string): string {
  const v = hex.toLowerCase();
  if (v.length !== 4) return v;
  return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
}

/** Lee UNA etiqueta desde `desde`. Devuelve null si está mal formada. */
function leerEtiqueta(texto: string, desde: number): { etiqueta: Etiqueta; fin: number } | null {
  const apertura = texto.slice(desde).match(/^<(\/?)([a-zA-Z][a-zA-Z0-9]*)/);
  if (!apertura) return null;

  const esCierre = apertura[1] === "/";
  const nombre = apertura[2];
  let i = desde + apertura[0].length;
  const atributos: Array<[string, string]> = [];

  for (;;) {
    while (i < texto.length && /\s/.test(texto[i])) i++;
    if (i >= texto.length) return null;

    if (texto.startsWith("/>", i)) {
      if (esCierre) return null;
      return { etiqueta: { nombre, atributos, esCierre, esAuto: true }, fin: i + 2 };
    }
    if (texto[i] === ">") {
      return { etiqueta: { nombre, atributos, esCierre, esAuto: false }, fin: i + 1 };
    }
    if (esCierre) return null; // una etiqueta de cierre no lleva atributos

    const attr = texto.slice(i).match(/^([a-zA-Z][a-zA-Z0-9:_-]*)\s*=\s*(["'])/);
    if (!attr) return null;
    const comilla = attr[2];
    const inicioValor = i + attr[0].length;
    const finValor = texto.indexOf(comilla, inicioValor);
    if (finValor === -1) return null;
    const valor = texto.slice(inicioValor, finValor);
    // Un valor con `<` o `>` dentro es la forma clásica de romper un
    // analizador ingenuo: aquí se rechaza la etiqueta entera.
    if (valor.includes("<") || valor.includes(">")) return null;
    atributos.push([attr[1], valor.trim()]);
    i = finValor + 1;
  }
}

/**
 * Pone un prefijo a cada id (y a cada referencia) del SVG ya saneado.
 * Dos adornos en la misma página pueden traer los dos un degradado
 * llamado "oro": sin prefijo, el segundo pisa al primero y el adorno sale
 * con el color del vecino.
 */
export function prefijarIds(svg: string, prefijo: string): string {
  const limpio = prefijo.replace(/[^a-zA-Z0-9-]/g, "");
  if (!limpio) return svg;
  return svg
    .replace(/\bid="([a-zA-Z][a-zA-Z0-9_-]*)"/g, (_, id) => `id="${limpio}-${id}"`)
    .replace(/url\(#([a-zA-Z][a-zA-Z0-9_-]*)\)/g, (_, id) => `url(#${limpio}-${id})`);
}
