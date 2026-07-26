import type { CambioVencimiento, PedidoRecalculo } from "./vencimientos";

/**
 * TAREAS DE MANTENIMIENTO DEL PANEL
 * ==================================
 * Dos trabajos que antes solo se podían lanzar desde la terminal con los
 * scripts de `scripts/`. Ahora también son botones en /panel/mantenimiento,
 * y esta es la lógica que comparten los dos caminos.
 *
 * Las dos tareas tienen el mismo problema de fondo: pueden tocar cientos de
 * pedidos o de fotos, y una función de servidor tiene un tiempo máximo. Aquí
 * viven las decisiones que hacen que eso quepa — agrupar escrituras, partir
 * el trabajo en tandas — separadas de la base de datos para poder probarlas.
 */

/* ============================================================
   RECÁLCULO DE VENCIMIENTOS
   ============================================================ */

export interface ActualizacionVencimiento {
  /** Fecha nueva de vencimiento, "YYYY-MM-DD". */
  fecha: string;
  /** Estaban vencidos: además de la fecha hay que devolverlos a "activa". */
  revive: boolean;
  ids: string[];
}

/**
 * Agrupa los cambios por lo que hay que escribir, no por pedido.
 *
 * Todos los pedidos entregados el mismo día con el mismo plan acaban con la
 * misma fecha, así que en la práctica cientos de cambios se resuelven en un
 * puñado de escrituras `.in("id", …)`. Uno por pedido excedía el tiempo
 * máximo de la función y dejaba el recálculo a medias.
 */
export function agruparActualizaciones<T extends PedidoRecalculo>(
  cambios: CambioVencimiento<T>[]
): ActualizacionVencimiento[] {
  const grupos = new Map<string, ActualizacionVencimiento>();

  for (const cambio of cambios) {
    const clave = `${cambio.despues}|${cambio.revive}`;
    const grupo = grupos.get(clave);
    if (grupo) grupo.ids.push(cambio.pedido.id);
    else grupos.set(clave, { fecha: cambio.despues, revive: cambio.revive, ids: [cambio.pedido.id] });
  }

  return [...grupos.values()];
}

/* ============================================================
   VERSIONES LIGERAS DE LAS FOTOS
   ============================================================ */

/**
 * Cuántas fotos se procesan por llamada. Cada una son tres viajes a Storage
 * (bajar el original, subir dos derivados) más la conversión, así que unas
 * pocas por tanda entran de sobra en el tiempo de cualquier plan de Vercel.
 * Es preferible a una tanda grande: si algo falla se pierde menos trabajo, y
 * la barra de progreso se mueve.
 */
export const FOTOS_POR_TANDA = 4;

/**
 * Margen de tiempo por llamada. Si al terminar una foto ya se pasó de aquí,
 * la tanda se cierra aunque queden huecos libres: mejor devolver el avance
 * que morir a mitad de una foto y que la llamada entera se pierda.
 */
export const MS_POR_TANDA = 20_000;

/** Lo que devuelve una llamada. */
export interface AvanceFotos {
  procesadas: number;
  fallidas: number;
  /**
   * Fotos que ya tenían sus versiones ligeras. Una tanda que corta a mitad de
   * un pedido deja el cursor donde estaba, así que la llamada siguiente
   * vuelve a ver esas fotos y las salta: por eso este número NO se acumula
   * entre tandas — sumarlo contaría la misma foto muchas veces.
   */
  saltadas: number;
  /** Nombres de las que no se pudieron procesar, para enseñarlos al equipo. */
  fallos: string[];
  /** Último pedido terminado; la siguiente tanda arranca después de este. */
  cursor: string | null;
  /** No queda ningún pedido por revisar. */
  terminado: boolean;
}

/** Lo que el panel va acumulando llamada tras llamada. */
export interface TotalFotos {
  procesadas: number;
  fallidas: number;
  fallos: string[];
  tandas: number;
}

export const TOTAL_VACIO: TotalFotos = { procesadas: 0, fallidas: 0, fallos: [], tandas: 0 };

export function sumarAvance(total: TotalFotos, tanda: AvanceFotos): TotalFotos {
  return {
    procesadas: total.procesadas + tanda.procesadas,
    fallidas: total.fallidas + tanda.fallidas,
    // Se guardan unos pocos: la lista es para que el equipo sepa qué mirar,
    // no un registro completo.
    fallos: [...total.fallos, ...tanda.fallos].slice(0, 20),
    tandas: total.tandas + 1,
  };
}

/**
 * Una tanda que no toca ninguna foto y deja el cursor donde estaba significa
 * que el trabajo se atascó. Sin esta comprobación el panel repetiría la misma
 * llamada para siempre.
 */
export function seAtasco(anterior: string | null, tanda: AvanceFotos): boolean {
  if (tanda.terminado) return false;
  const sinTocarNada = tanda.procesadas === 0 && tanda.saltadas === 0 && tanda.fallidas === 0;
  return sinTocarNada && tanda.cursor === anterior;
}
