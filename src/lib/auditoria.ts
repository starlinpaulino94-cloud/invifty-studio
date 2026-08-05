import type { SupabaseClient } from "@supabase/supabase-js";
import { registrarError } from "./registro";
import { puede, rolValido, type Permiso, type RolEquipo } from "./roles";

/**
 * AUDITORÍA, HISTORIAL Y PERMISOS — los ayudantes de servidor
 * ============================================================
 * Tres funciones que las acciones del panel llaman antes y después de
 * tocar algo sensible:
 *
 *  - exigirPermiso: ¿el rol de quien está firmado puede hacer esto? Se
 *    comprueba AQUÍ, en el servidor — esconder el botón no es autorización.
 *  - registrarAccion: deja el rastro en `auditoria` (inmutable).
 *  - registrarCambioEstado: deja el rastro en `historial_estados`.
 *
 * Los registros NO tumban la operación si fallan: un pago registrado vale
 * más que su fila de auditoría, así que el fallo se anota en el log del
 * servidor y la operación sigue. La inmutabilidad la garantiza la base
 * (trigger que rechaza update/delete), no la buena conducta del código.
 *
 * A la auditoría van datos TÉCNICOS: montos, estados, slugs. Nunca listas
 * de invitados ni notas personales.
 */

interface Firmante {
  id: string;
  email: string | null;
  rol: RolEquipo;
}

/** Usuario firmado + su rol. Lanza si no hay sesión. */
export async function firmante(supabase: SupabaseClient): Promise<Firmante> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sin sesión");

  const { data, error } = await supabase
    .from("equipo")
    .select("rol")
    .eq("usuario_id", user.id)
    .maybeSingle();

  // La columna `rol` llega con la migración de operaciones. Si aún no se
  // corrió, el sistema no puede quedarse mudo: se asume el reparto de
  // siempre (todo el equipo era admin) y se deja constancia en el log.
  let rol: RolEquipo = "admin";
  if (error) {
    registrarError("roles", error, { nota: "sin columna rol; se asume admin" });
  } else if (rolValido(data?.rol)) {
    rol = data.rol;
  }

  return { id: user.id, email: user.email ?? null, rol };
}

/** Comprueba el permiso en servidor y devuelve quién firma. Lanza si no puede. */
export async function exigirPermiso(
  supabase: SupabaseClient,
  permiso: Permiso
): Promise<Firmante> {
  const quien = await firmante(supabase);
  if (!puede(quien.rol, permiso)) {
    throw new Error(`Tu rol (${quien.rol}) no permite esta acción (${permiso}).`);
  }
  return quien;
}

export async function registrarAccion(
  supabase: SupabaseClient,
  quien: Firmante,
  accion: string,
  entidad: string,
  entidadId: string | null,
  detalles: Record<string, string | number | boolean | null> = {}
): Promise<void> {
  const { error } = await supabase.from("auditoria").insert({
    accion,
    entidad,
    entidad_id: entidadId,
    usuario_id: quien.id,
    usuario_email: quien.email,
    detalles,
  });
  if (error) registrarError("auditoria", error, { accion, entidad });
}

export async function registrarCambioEstado(
  supabase: SupabaseClient,
  quien: Firmante,
  entidad: "pedido" | "invitacion" | "lead",
  entidadId: string,
  estadoAnterior: string | null,
  estadoNuevo: string,
  motivo?: string
): Promise<void> {
  const { error } = await supabase.from("historial_estados").insert({
    entidad,
    entidad_id: entidadId,
    estado_anterior: estadoAnterior,
    estado_nuevo: estadoNuevo,
    motivo: motivo ?? null,
    usuario_id: quien.id,
    usuario_email: quien.email,
  });
  if (error) registrarError("historial", error, { entidad, estadoNuevo });
}
