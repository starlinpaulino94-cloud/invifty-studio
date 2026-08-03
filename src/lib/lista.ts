import { normalizarNombre } from "./nombres";

/**
 * LA LISTA DE INVITADOS DEL ANFITRIÓN
 * ====================================
 * El anfitrión no pregunta "¿quién confirmó?". Pregunta "¿a quién le falta
 * confirmar?", porque a esos hay que perseguirlos por WhatsApp, y porque el
 * salón y el catering piden un número el mismo día.
 *
 * Eso el sistema no lo podía responder: solo guardaba a quien respondía. Un
 * invitado que nunca abre la invitación no deja rastro, así que "los que no
 * confirmaron" era, literalmente, un dato que no existía.
 *
 * Por eso el anfitrión puede cargar a quién invitó. Con esa lista delante,
 * cada confirmación se cruza por el nombre normalizado (ver lib/nombres.ts)
 * y aparecen los tres grupos que de verdad importan: los que vienen, los que
 * no vienen, y los que todavía no han dicho nada.
 *
 * La lista es OPCIONAL. Sin ella el panel sigue sirviendo: enseña quién ha
 * confirmado. Lo que no puede es inventarse a quién falta.
 */

export interface InvitadoDeLista {
  id: string;
  nombre: string;
  nombre_normalizado: string;
}

export interface ConfirmacionCruzada {
  nombre: string;
  nombre_normalizado: string;
  asiste: boolean;
  cantidad: number;
  nota: string | null;
  creado_en: string;
}

export interface Cruce {
  /** Invitados de la lista que dijeron que sí. */
  vienen: { nombre: string; cantidad: number; nota: string | null }[];
  /** Invitados de la lista que dijeron que no. */
  noVienen: { nombre: string; nota: string | null }[];
  /** Invitados de la lista que no han contestado. A estos hay que perseguir. */
  sinResponder: { nombre: string }[];
  /**
   * Confirmaciones de gente que NO estaba en la lista. No es un error: pasa
   * cuando alguien reenvía la invitación a un primo. Se enseñan aparte para
   * que el anfitrión decida si los admite, y para que el total no mienta.
   */
  inesperados: { nombre: string; asiste: boolean; cantidad: number; nota: string | null }[];
  /** Personas que vienen en total, contando acompañantes. */
  totalPersonas: number;
  /** Cuántos invitados de la lista faltan por contestar. */
  faltanPorResponder: number;
  /** true si el anfitrión todavía no ha cargado su lista. */
  sinLista: boolean;
}

/**
 * Cruza la lista del anfitrión con lo que han contestado los invitados.
 *
 * Gana siempre la confirmación más reciente de cada nombre: la tabla ya
 * guarda una sola fila por invitado (índice único), pero esta función no
 * depende de eso — si llegaran dos, se queda con la última.
 */
export function cruzarLista(
  invitados: InvitadoDeLista[],
  confirmaciones: ConfirmacionCruzada[]
): Cruce {
  const porNombre = new Map<string, ConfirmacionCruzada>();
  for (const c of confirmaciones) {
    const clave = c.nombre_normalizado || normalizarNombre(c.nombre);
    const previa = porNombre.get(clave);
    if (!previa || c.creado_en > previa.creado_en) porNombre.set(clave, c);
  }

  const cruce: Cruce = {
    vienen: [],
    noVienen: [],
    sinResponder: [],
    inesperados: [],
    totalPersonas: 0,
    faltanPorResponder: 0,
    sinLista: invitados.length === 0,
  };

  const yaCruzados = new Set<string>();

  for (const invitado of invitados) {
    const clave = invitado.nombre_normalizado || normalizarNombre(invitado.nombre);
    const respuesta = porNombre.get(clave);

    if (!respuesta) {
      cruce.sinResponder.push({ nombre: invitado.nombre });
      continue;
    }

    yaCruzados.add(clave);

    // Se enseña el nombre tal como lo escribió el anfitrión en su lista, no
    // como lo tecleó el invitado: es la lista que él reconoce.
    if (respuesta.asiste) {
      cruce.vienen.push({
        nombre: invitado.nombre,
        cantidad: respuesta.cantidad,
        nota: respuesta.nota,
      });
    } else {
      cruce.noVienen.push({ nombre: invitado.nombre, nota: respuesta.nota });
    }
  }

  for (const [clave, respuesta] of porNombre) {
    if (yaCruzados.has(clave)) continue;
    // Sin lista cargada, "inesperado" no significa nada: son simplemente
    // las confirmaciones, y van al grupo que les toca.
    if (cruce.sinLista) {
      if (respuesta.asiste) {
        cruce.vienen.push({
          nombre: respuesta.nombre,
          cantidad: respuesta.cantidad,
          nota: respuesta.nota,
        });
      } else {
        cruce.noVienen.push({ nombre: respuesta.nombre, nota: respuesta.nota });
      }
      continue;
    }
    cruce.inesperados.push({
      nombre: respuesta.nombre,
      asiste: respuesta.asiste,
      cantidad: respuesta.cantidad,
      nota: respuesta.nota,
    });
  }

  cruce.totalPersonas =
    cruce.vienen.reduce((s, v) => s + v.cantidad, 0) +
    cruce.inesperados.filter((i) => i.asiste).reduce((s, i) => s + i.cantidad, 0);

  cruce.faltanPorResponder = cruce.sinResponder.length;

  return cruce;
}

/**
 * Convierte lo que el anfitrión pega en la caja de texto en nombres.
 *
 * Se acepta un nombre por línea y también separados por coma, porque el
 * anfitrión va a pegar desde donde tenga la lista —una nota del teléfono, un
 * Excel, un mensaje— y no hay por qué obligarle a un formato.
 *
 * Quita repetidos (comparando ya normalizado) y respeta el orden en que los
 * escribió: es su lista, la reconoce por el orden.
 */
export function leerNombresPegados(texto: string, maximo = 1000): string[] {
  const vistos = new Set<string>();
  const nombres: string[] = [];

  for (const trozo of texto.split(/[\n,;]+/)) {
    const nombre = trozo.trim().replace(/\s+/g, " ");
    if (nombre.length < 2) continue;

    const clave = normalizarNombre(nombre);
    if (vistos.has(clave)) continue;

    vistos.add(clave);
    nombres.push(nombre.slice(0, 80));
    if (nombres.length >= maximo) break;
  }

  return nombres;
}
