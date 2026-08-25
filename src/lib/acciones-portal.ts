"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "./supabase/servidor";
import { crearClienteAdmin } from "./supabase/admin";
import { registrarError } from "./registro";
import { tokenOpaco } from "./revision";
import {
  expiraActivacion,
  MAX_MIEMBROS,
  tienePermiso,
  type PermisoColaborador,
} from "./cuentas";
import { aplicarContenido, puedeEditarContenido, validarContenido } from "./edicion";
import type { DatosInvitacion } from "./tipos";

/**
 * ACCIONES DEL PROPIETARIO EN SU PORTAL
 * ======================================
 * Las primeras acciones que ejecuta un CLIENTE (no el equipo): invitar a
 * un colaborador, revocar la invitación y quitarlo. La validación va
 * toda aquí, en el servidor: se comprueba con su sesión que es
 * PROPIETARIO de una cuenta activa, y solo entonces el administrador
 * escribe. El RLS de lectura le enseña; estas acciones son su única
 * pluma.
 */

interface MiembroFirmado {
  usuarioId: string;
  email: string | null;
  cuentaId: string;
  clienteId: string;
  rol: string;
  permisos: Record<string, unknown> | null;
}

/** El firmante debe ser miembro de una cuenta activa. Lanza si no. */
async function miembroFirmado(): Promise<MiembroFirmado> {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sin sesión.");

  // "miembro ve su fila" + "cliente ve su cuenta": la propia consulta
  // ejercita el RLS. Una cuenta suspendida no aparece como activa.
  const { data: miembro } = await supabase
    .from("miembros_cuenta")
    .select("cuenta_id, rol, permisos, cuentas_cliente(cliente_id, estado)")
    .eq("usuario_id", user.id)
    .maybeSingle();

  const cuenta = miembro?.cuentas_cliente as
    | { cliente_id: string; estado: string }
    | null
    | undefined;
  if (!miembro || !cuenta) throw new Error("Esta cuenta no tiene portal.");
  if (cuenta.estado !== "activa") throw new Error("La cuenta no está activa.");

  return {
    usuarioId: user.id,
    email: user.email ?? null,
    cuentaId: miembro.cuenta_id,
    clienteId: cuenta.cliente_id,
    rol: miembro.rol,
    permisos: (miembro.permisos as Record<string, unknown> | null) ?? null,
  };
}

/** El firmante debe ser PROPIETARIO de una cuenta activa. Lanza si no. */
async function propietarioFirmado(): Promise<MiembroFirmado> {
  const miembro = await miembroFirmado();
  if (miembro.rol !== "propietario") {
    throw new Error("Solo el propietario de la cuenta puede gestionar el acceso.");
  }
  return miembro;
}

/** Deja rastro en auditoría con el CLIENTE como actor (no hay equipo aquí). */
async function auditarPortal(
  quien: MiembroFirmado,
  accion: string,
  detalles: Record<string, string | number | boolean | null> = {}
) {
  const admin = crearClienteAdmin();
  const { error } = await admin.from("auditoria").insert({
    accion,
    entidad: "cliente",
    entidad_id: quien.clienteId,
    usuario_id: quien.usuarioId,
    usuario_email: quien.email,
    detalles,
  });
  if (error) registrarError("auditoria", error, { accion });
}

/** Invita a un colaborador con permisos acotados. Devuelve el enlace. */
export async function invitarColaborador(
  email: string,
  permisos: Partial<Record<PermisoColaborador, boolean>>
) {
  const quien = await propietarioFirmado();

  const correo = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
    throw new Error("Hace falta un correo válido: será el usuario del colaborador.");
  }

  const admin = crearClienteAdmin();

  // Tope técnico anti-abuso (no comercial) y sin duplicados.
  const { data: miembros } = await admin
    .from("miembros_cuenta")
    .select("id, email")
    .eq("cuenta_id", quien.cuentaId);
  const { data: pendientes } = await admin
    .from("invitaciones_cuenta")
    .select("id, email, usado_en, revocada_en, expira_en")
    .eq("cuenta_id", quien.cuentaId)
    .is("usado_en", null)
    .is("revocada_en", null);

  if ((miembros?.length ?? 0) + (pendientes?.length ?? 0) >= MAX_MIEMBROS) {
    throw new Error("Esta cuenta llegó al máximo de miembros. Escríbenos si necesitas más.");
  }
  if (miembros?.some((m) => m.email?.toLowerCase() === correo)) {
    throw new Error("Ese correo ya tiene acceso a esta cuenta.");
  }
  if (pendientes?.some((i) => i.email.toLowerCase() === correo)) {
    throw new Error("Ese correo ya tiene una invitación pendiente: revócala para crear otra.");
  }

  const token = tokenOpaco();
  const { error } = await admin.from("invitaciones_cuenta").insert({
    cuenta_id: quien.cuentaId,
    email: correo,
    rol: "colaborador",
    permisos,
    token,
    expira_en: expiraActivacion(new Date()),
    creado_por: quien.usuarioId,
  });
  if (error) throw new Error(`No se pudo crear la invitación: ${error.message}`);

  await auditarPortal(quien, "cuenta:invitar_colaborador", { email: correo });
  revalidatePath("/portal/personas");
  return { token };
}

/** Revoca una invitación pendiente (el enlace deja de servir al instante). */
export async function revocarInvitacionColaborador(invitacionId: string) {
  const quien = await propietarioFirmado();

  const admin = crearClienteAdmin();
  const { data: invitacion } = await admin
    .from("invitaciones_cuenta")
    .select("id, cuenta_id, usado_en")
    .eq("id", invitacionId)
    .maybeSingle();

  // La pertenencia se comprueba contra la cuenta del FIRMANTE, no contra
  // lo que diga el navegador.
  if (!invitacion || invitacion.cuenta_id !== quien.cuentaId) {
    throw new Error("Esa invitación no existe.");
  }
  if (invitacion.usado_en) throw new Error("Esa invitación ya se usó: quita al miembro.");

  const { error } = await admin
    .from("invitaciones_cuenta")
    .update({ revocada_en: new Date().toISOString() })
    .eq("id", invitacionId);
  if (error) throw new Error(`No se pudo revocar: ${error.message}`);

  await auditarPortal(quien, "cuenta:revocar_invitacion", { invitacion: invitacionId });
  revalidatePath("/portal/personas");
}

/**
 * Guarda los TEXTOS de la invitación que el cliente puede editar (lista
 * blanca de lib/edicion.ts — el diseño no está en ella y por tanto no
 * entra por aquí ni a propósito). Exige:
 *  - miembro de cuenta activa con el permiso editar_invitacion
 *    (el propietario lo tiene siempre);
 *  - que la invitación sea SUYA — se lee con su sesión, RLS mediante;
 *  - el candado: una invitación aprobada no se toca. El update lo exige
 *    OTRA vez (`is bloqueada_en null`), así una aprobación que llegue
 *    entre la lectura y la escritura también lo frena.
 */
export async function guardarContenidoInvitacion(
  invitacionId: string,
  crudo: Record<string, string>
) {
  const quien = await miembroFirmado();
  if (!tienePermiso(quien, "editar_invitacion")) {
    throw new Error("Tu acceso no incluye editar la invitación: pídeselo al propietario.");
  }

  // La pertenencia la decide el RLS: esta lectura va con la sesión del
  // cliente y solo devuelve la invitación si es de su cuenta.
  const supabase = await crearClienteServidor();
  const { data: invitacion } = await supabase
    .from("invitaciones")
    .select("id, datos, bloqueada_en")
    .eq("id", invitacionId)
    .maybeSingle();
  if (!invitacion) throw new Error("Esa invitación no existe.");

  const candado = puedeEditarContenido(invitacion);
  if (!candado.ok) throw new Error(candado.motivo);

  const { cambios, errores } = validarContenido(crudo);
  if (errores.length) throw new Error(errores.join(" "));
  if (!Object.keys(cambios).length) return { guardado: false };

  const datos = aplicarContenido(invitacion.datos as DatosInvitacion, cambios);

  const admin = crearClienteAdmin();
  const { data: filas, error } = await admin
    .from("invitaciones")
    .update({ datos })
    .eq("id", invitacionId)
    .is("bloqueada_en", null)
    .select("id");
  if (error) throw new Error(`No se pudo guardar: ${error.message}`);
  if (!filas?.length) {
    throw new Error("Tu invitación se aprobó hace un momento y quedó protegida: escríbenos si falta un cambio.");
  }

  // A la auditoría van los CAMPOS tocados, no sus textos (son personales).
  await auditarPortal(quien, "invitacion:contenido_cliente", {
    invitacion: invitacionId,
    campos: Object.keys(cambios).join(", "),
  });
  revalidatePath("/portal");
  return { guardado: true };
}

/** Quita a un colaborador. Al propietario no lo quita nadie desde aquí. */
export async function quitarColaborador(miembroId: string) {
  const quien = await propietarioFirmado();

  const admin = crearClienteAdmin();
  const { data: miembro } = await admin
    .from("miembros_cuenta")
    .select("id, cuenta_id, rol, email")
    .eq("id", miembroId)
    .maybeSingle();

  if (!miembro || miembro.cuenta_id !== quien.cuentaId) {
    throw new Error("Ese miembro no existe.");
  }
  if (miembro.rol !== "colaborador") {
    throw new Error("El propietario no se puede quitar: para eso está el equipo de Invifty.");
  }

  const { error } = await admin.from("miembros_cuenta").delete().eq("id", miembroId);
  if (error) throw new Error(`No se pudo quitar: ${error.message}`);

  await auditarPortal(quien, "cuenta:quitar_colaborador", { email: miembro.email ?? null });
  revalidatePath("/portal/personas");
}
