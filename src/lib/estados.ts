import type { EstadoPedido } from "./tipos";

/**
 * EL CICLO DE VIDA DE UN PEDIDO
 * ==============================
 * Los estados existían como strings sueltos y cualquier estado podía
 * saltar a cualquier otro: un pedido "vencido" podía amanecer "nuevo" por
 * un clic mal dado, y nadie se enteraba. Aquí viven las transiciones que
 * el negocio de verdad tiene — ni una más, que estados de sobra es como el
 * sistema se vuelve mentiroso.
 *
 * La regla se valida EN EL SERVIDOR (lib/acciones.ts): el selector del
 * panel también la usa para enseñar solo lo posible, pero esconder botones
 * no es validación.
 *
 * Se permiten los retrocesos de un paso porque son reales: "en diseño"
 * vuelve a "formulario completado" cuando faltan datos, "entregada" vuelve
 * a "revisión" cuando el cliente pide un cambio. Lo que no se permite son
 * los saltos sin sentido operativo.
 */
export const TRANSICIONES: Record<EstadoPedido, EstadoPedido[]> = {
  nuevo: ["formulario_enviado", "en_diseno", "cancelado"],
  formulario_enviado: ["formulario_completado", "nuevo", "en_diseno", "cancelado"],
  formulario_completado: ["en_diseno", "formulario_enviado", "cancelado"],
  en_diseno: ["revision_cliente", "formulario_completado", "cancelado"],
  revision_cliente: ["entregada", "en_diseno", "cancelado"],
  entregada: ["activa", "revision_cliente", "vencida", "cancelado"],
  activa: ["vencida", "entregada", "cancelado"],
  // De vencida se vuelve: la renovación es un flujo real que ya se vende.
  vencida: ["activa", "cancelado"],
  // Reabrir un cancelado empieza de nuevo, no a mitad de camino.
  cancelado: ["nuevo"],
};

export function transicionValida(de: EstadoPedido, a: EstadoPedido): boolean {
  if (de === a) return true; // repetir el estado no es un cambio, no falla
  return (TRANSICIONES[de] ?? []).includes(a);
}

/** Los estados a los que se puede pasar desde `de` (para pintar el selector). */
export function transicionesDesde(de: EstadoPedido): EstadoPedido[] {
  return TRANSICIONES[de] ?? [];
}
