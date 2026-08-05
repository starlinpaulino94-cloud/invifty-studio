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
  | "mantenimiento";

const TODO: Permiso[] = [
  "gestionar_equipo", "crear_pedidos", "cambiar_estado", "registrar_pagos",
  "anular_pagos", "editar_invitaciones", "publicar", "convertir_leads",
  "marcar_demos", "mantenimiento",
];

export const PERMISOS: Record<RolEquipo, Permiso[]> = {
  propietario: TODO,
  admin: TODO,
  ventas: ["crear_pedidos", "cambiar_estado", "registrar_pagos", "convertir_leads"],
  operaciones: [
    "crear_pedidos", "cambiar_estado", "registrar_pagos",
    "editar_invitaciones", "publicar", "convertir_leads", "marcar_demos",
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
