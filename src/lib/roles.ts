/**
 * ROLES DEL EQUIPO Y SUS PERMISOS
 * ================================
 * Hasta ahora ser del equipo era todo o nada: quien entraba al panel podía
 * borrar pagos y publicar invitaciones. Con el equipo creciendo, eso es un
 * accidente esperando turno.
 *
 * La matriz es código a propósito — cambiarla es un commit revisable, no
 * una fila que alguien tocó. El rol de cada quien vive en `equipo.rol`, y
 * las acciones sensibles lo comprueban EN EL SERVIDOR con exigirPermiso
 * (lib/sesion.ts): esconder un botón no es autorización.
 *
 * La RLS sigue siendo la muralla exterior: sin estar en la lista blanca no
 * se lee una fila, tenga el rol que tenga. Esto reparte lo de dentro.
 */

export const ROLES = [
  "propietario",
  "admin",
  "ventas",
  "operaciones",
  "disenador",
  "lectura",
] as const;
export type RolEquipo = (typeof ROLES)[number];

export type Permiso =
  | "gestionar_equipo"
  | "crear_pedidos"
  | "cambiar_estado"
  | "registrar_pagos"
  | "anular_pagos"
  | "editar_invitaciones"
  | "publicar"
  | "convertir_leads"
  | "marcar_demos"
  | "mantenimiento"
  // Crear, reenviar, suspender y reactivar cuentas del PORTAL de clientes.
  | "gestionar_cuentas"
  // Editar la ficha del cliente y del pedido (corregir datos capturados).
  | "editar_fichas"
  // Borrar pedidos y clientes PARA SIEMPRE. No está en TODO a propósito:
  // borrar es irreversible y lo firma solo el propietario del negocio.
  | "eliminar_datos";

const TODO: Permiso[] = [
  "gestionar_equipo", "crear_pedidos", "cambiar_estado", "registrar_pagos",
  "anular_pagos", "editar_invitaciones", "publicar", "convertir_leads",
  "marcar_demos", "mantenimiento", "gestionar_cuentas", "editar_fichas",
];

export const PERMISOS: Record<RolEquipo, Permiso[]> = {
  propietario: [...TODO, "eliminar_datos"],
  admin: TODO,
  ventas: ["crear_pedidos", "cambiar_estado", "registrar_pagos", "convertir_leads", "editar_fichas"],
  operaciones: [
    "crear_pedidos", "cambiar_estado", "registrar_pagos",
    "editar_invitaciones", "publicar", "convertir_leads", "marcar_demos", "editar_fichas",
  ],
  disenador: ["editar_invitaciones"],
  lectura: [],
};

export function puede(rol: RolEquipo, permiso: Permiso): boolean {
  return (PERMISOS[rol] ?? []).includes(permiso);
}

export function rolValido(rol: unknown): rol is RolEquipo {
  return typeof rol === "string" && (ROLES as readonly string[]).includes(rol);
}
