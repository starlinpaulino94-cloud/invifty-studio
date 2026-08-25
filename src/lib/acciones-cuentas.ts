"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "./supabase/servidor";
import { crearClienteAdmin } from "./supabase/admin";
import { exigirPermiso, registrarAccion } from "./auditoria";
import { registrarError } from "./registro";
import { tokenOpaco } from "./revision";
import { encolarAvisoEquipo } from "./avisos";
import { urlBase } from "./url";
import {
  activacionVigente,
  expiraActivacion,
  expiraRecuperacion,
  invitacionVigente,
  passwordValida,
  recuperacionVigente,
  sanearPermisos,
} from "./cuentas";

/**
 * ACCIONES DE LAS CUENTAS DEL PORTAL
 * ===================================
 * El equipo crea el acceso (no hay registro público), el cliente lo
 * activa con SU contraseña. Las cuatro primeras acciones exigen el
 * permiso `gestionar_cuentas` EN EL SERVIDOR; `activarCuenta` es la
 * única pública y su credencial es el token de un solo uso.
 *
 * La suspensión cierra por DOS puertas a la vez: la cuenta pasa a
 * 'suspendida' (mi_cliente_id() devuelve null y el RLS cierra todo) y el
 * usuario de auth queda baneado (ni siquiera puede firmar). Reactivar
 * abre las dos. Nada se borra jamás por suspender.
 */

/** La salida del portal: como cerrarSesion, pero vuelve a la puerta del cliente. */
export async function cerrarSesionPortal() {
  const supabase = await crearClienteServidor();
  await supabase.auth.signOut();
  redirect("/portal/entrar");
}

/** Crea el acceso al portal de un cliente y devuelve el enlace de activación. */
export async function crearAccesoPortal(clienteId: string, email: string) {
  const supabase = await crearClienteServidor();
  const quien = await exigirPermiso(supabase, "gestionar_cuentas");

  const correo = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
    throw new Error("Hace falta un correo válido: será el usuario del portal.");
  }

  const { data: existente } = await supabase
    .from("cuentas_cliente")
    .select("id, estado")
    .eq("cliente_id", clienteId)
    .maybeSingle();
  if (existente) {
    throw new Error(
      existente.estado === "pendiente"
        ? "Este cliente ya tiene un acceso pendiente: reenvía la activación."
        : "Este cliente ya tiene cuenta en el portal."
    );
  }

  const token = tokenOpaco();
  const { error } = await supabase.from("cuentas_cliente").insert({
    cliente_id: clienteId,
    email: correo,
    estado: "pendiente",
    token_activacion: token,
    activacion_expira: expiraActivacion(new Date()),
    creado_por_email: quien.email,
  });
  if (error) throw new Error(`No se pudo crear el acceso: ${error.message}`);

  await registrarAccion(supabase, quien, "cuenta:crear", "cliente", clienteId, { email: correo });
  revalidatePath("/panel");
  return { token };
}

/** Genera un token de activación nuevo (y mata el anterior). */
export async function reenviarActivacion(clienteId: string) {
  const supabase = await crearClienteServidor();
  const quien = await exigirPermiso(supabase, "gestionar_cuentas");

  const { data: cuenta } = await supabase
    .from("cuentas_cliente")
    .select("id, estado")
    .eq("cliente_id", clienteId)
    .maybeSingle();
  if (!cuenta) throw new Error("Este cliente no tiene acceso al portal todavía.");
  if (cuenta.estado !== "pendiente") {
    throw new Error("La cuenta ya está activada: no hay nada que reenviar.");
  }

  const token = tokenOpaco();
  const { error } = await supabase
    .from("cuentas_cliente")
    .update({ token_activacion: token, activacion_expira: expiraActivacion(new Date()) })
    .eq("id", cuenta.id);
  if (error) throw new Error(`No se pudo renovar la activación: ${error.message}`);

  await registrarAccion(supabase, quien, "cuenta:reenviar_activacion", "cliente", clienteId);
  revalidatePath("/panel");
  return { token };
}

/**
 * Suspende la cuenta: cierra el portal (RLS) y bloquea el login (auth).
 * No borra absolutamente nada — reactivar lo devuelve todo tal cual.
 */
export async function suspenderCuenta(clienteId: string) {
  const supabase = await crearClienteServidor();
  const quien = await exigirPermiso(supabase, "gestionar_cuentas");

  const { data: cuenta } = await supabase
    .from("cuentas_cliente")
    .select("id, usuario_id, estado")
    .eq("cliente_id", clienteId)
    .maybeSingle();
  if (!cuenta) throw new Error("Este cliente no tiene cuenta en el portal.");

  const { error } = await supabase
    .from("cuentas_cliente")
    .update({ estado: "suspendida" })
    .eq("id", cuenta.id);
  if (error) throw new Error(`No se pudo suspender: ${error.message}`);

  // Segunda puerta: el usuario de auth no puede ni firmar. Si esto falla,
  // el RLS ya cerró el portal igual — se anota y no se revienta.
  if (cuenta.usuario_id) {
    const admin = crearClienteAdmin();
    const { error: errorBan } = await admin.auth.admin.updateUserById(cuenta.usuario_id, {
      ban_duration: "876000h", // ~100 años: "hasta que se reactive"
    });
    if (errorBan) registrarError("cuentas", errorBan, { nota: "suspendida en RLS, ban falló" });
  }

  await registrarAccion(supabase, quien, "cuenta:suspender", "cliente", clienteId);
  revalidatePath("/panel");
}

/** Reabre una cuenta suspendida: RLS y login vuelven a funcionar. */
export async function reactivarCuenta(clienteId: string) {
  const supabase = await crearClienteServidor();
  const quien = await exigirPermiso(supabase, "gestionar_cuentas");

  const { data: cuenta } = await supabase
    .from("cuentas_cliente")
    .select("id, usuario_id, estado")
    .eq("cliente_id", clienteId)
    .maybeSingle();
  if (!cuenta) throw new Error("Este cliente no tiene cuenta en el portal.");
  if (cuenta.estado !== "suspendida") throw new Error("La cuenta no está suspendida.");

  const { error } = await supabase
    .from("cuentas_cliente")
    .update({ estado: "activa" })
    .eq("id", cuenta.id);
  if (error) throw new Error(`No se pudo reactivar: ${error.message}`);

  if (cuenta.usuario_id) {
    const admin = crearClienteAdmin();
    const { error: errorBan } = await admin.auth.admin.updateUserById(cuenta.usuario_id, {
      ban_duration: "none",
    });
    if (errorBan) registrarError("cuentas", errorBan, { nota: "reactivada en RLS, desban falló" });
  }

  await registrarAccion(supabase, quien, "cuenta:reactivar", "cliente", clienteId);
  revalidatePath("/panel");
}

/**
 * LA ACCIÓN PÚBLICA: el cliente activa su cuenta con el token del enlace
 * y elige su contraseña. El token es la credencial (de un solo uso, con
 * fecha); no hay sesión todavía. Al terminar, la página firma al cliente
 * con signInWithPassword y lo manda al portal.
 */
export async function activarCuenta(token: string, password: string) {
  if (!token || !/^[a-f0-9]{32}$/i.test(token)) throw new Error("Enlace de activación no válido.");
  if (!passwordValida(password)) {
    throw new Error("La contraseña debe tener al menos 8 caracteres.");
  }

  // Sin sesión no hay RLS que ayude: el administrador busca el token.
  const admin = crearClienteAdmin();
  const { data: cuenta, error } = await admin
    .from("cuentas_cliente")
    .select("id, cliente_id, email, estado, token_activacion, activacion_expira")
    .eq("token_activacion", token)
    .maybeSingle();
  if (error) throw new Error("No pudimos comprobar tu enlace. Inténtalo de nuevo.");
  if (!cuenta || !activacionVigente(cuenta, new Date())) {
    throw new Error(
      "Este enlace de activación ya no sirve (venció o ya se usó). Escríbenos y te mandamos uno nuevo."
    );
  }

  // El usuario se crea aquí, en el servidor, ya confirmado: nunca hubo
  // registro público ni correo de confirmación que se pueda perder.
  const { data: creado, error: errorUsuario } = await admin.auth.admin.createUser({
    email: cuenta.email,
    password,
    email_confirm: true,
  });
  if (errorUsuario || !creado?.user) {
    registrarError("cuentas", errorUsuario ?? new Error("sin usuario"), { nota: "createUser falló" });
    throw new Error(
      /already|registered|exists/i.test(errorUsuario?.message ?? "")
        ? "Ese correo ya tiene un usuario. Escríbenos para resolverlo."
        : "No pudimos crear tu usuario. Inténtalo de nuevo en un momento."
    );
  }

  // Miembro propietario + cuenta activa + token quemado (un solo uso).
  // El email va en la fila para que el propietario vea quién tiene
  // acceso; si la columna aún no está migrada, el miembro entra sin él.
  let { error: errorMiembro } = await admin.from("miembros_cuenta").insert({
    cuenta_id: cuenta.id,
    usuario_id: creado.user.id,
    rol: "propietario",
    email: cuenta.email,
  });
  if (errorMiembro && /column|email|schema/i.test(errorMiembro.message)) {
    registrarError("cuentas", errorMiembro, {
      nota: "falta la migración 20260825090000; miembro sin email",
    });
    ({ error: errorMiembro } = await admin.from("miembros_cuenta").insert({
      cuenta_id: cuenta.id,
      usuario_id: creado.user.id,
      rol: "propietario",
    }));
  }
  if (errorMiembro) {
    // Sin miembro no hay portal: se deshace el usuario para poder reintentar.
    await admin.auth.admin.deleteUser(creado.user.id);
    registrarError("cuentas", errorMiembro, { nota: "miembro falló; usuario deshecho" });
    throw new Error("No pudimos terminar la activación. Inténtalo de nuevo.");
  }

  const { error: errorCuenta } = await admin
    .from("cuentas_cliente")
    .update({
      usuario_id: creado.user.id,
      estado: "activa",
      token_activacion: null,
      activacion_expira: null,
    })
    .eq("id", cuenta.id)
    .eq("estado", "pendiente");
  if (errorCuenta) registrarError("cuentas", errorCuenta, { nota: "cuenta quedó pendiente con miembro" });

  // Auditoría directa: aquí no hay firmante del equipo — el actor es el cliente.
  const { error: errorAud } = await admin.from("auditoria").insert({
    accion: "cuenta:activar",
    entidad: "cliente",
    entidad_id: cuenta.cliente_id,
    usuario_id: creado.user.id,
    usuario_email: cuenta.email,
    detalles: {},
  });
  if (errorAud) registrarError("auditoria", errorAud, { accion: "cuenta:activar" });

  await avisarPortal(admin, "portal_activado", cuenta.cliente_id, cuenta.email);

  return { email: cuenta.email };
}

/**
 * Aviso al equipo por la bandeja de salida: los hitos del portal no
 * pasan en silencio. Si falla, la operación del cliente NO se cae — un
 * portal activado vale más que su correo interno.
 */
async function avisarPortal(
  admin: ReturnType<typeof crearClienteAdmin>,
  tipo: "portal_activado" | "portal_colaborador" | "portal_password",
  clienteId: string | null,
  detalle: string,
  /** UUID de referencia cuando no hay cliente (ej. el usuario de auth). */
  referenciaId?: string
) {
  try {
    let nombre = detalle;
    if (clienteId) {
      const { data: cliente } = await admin
        .from("clientes")
        .select("nombre")
        .eq("id", clienteId)
        .maybeSingle();
      if (cliente?.nombre) nombre = cliente.nombre;
    }
    await encolarAvisoEquipo(
      admin,
      tipo,
      { nombre, detalle, rutaPanel: "/panel/clientes", urlBase: urlBase() },
      { tipo: "cliente", id: clienteId ?? referenciaId ?? "" }
    );
  } catch (e) {
    registrarError("avisos", e, { tipo, paso: "aviso portal" });
  }
}

/**
 * El colaborador invitado activa su acceso: mismo trato que el
 * propietario (token de un solo uso, SU contraseña), pero nace como
 * miembro 'colaborador' con los permisos que el propietario le dio.
 */
export async function activarColaborador(token: string, password: string) {
  if (!token || !/^[a-f0-9]{32}$/i.test(token)) throw new Error("Enlace de invitación no válido.");
  if (!passwordValida(password)) {
    throw new Error("La contraseña debe tener al menos 8 caracteres.");
  }

  const admin = crearClienteAdmin();
  const { data: invitacion, error } = await admin
    .from("invitaciones_cuenta")
    .select("id, cuenta_id, email, permisos, expira_en, usado_en, revocada_en")
    .eq("token", token)
    .maybeSingle();
  if (error) throw new Error("No pudimos comprobar tu enlace. Inténtalo de nuevo.");
  if (!invitacion || !invitacionVigente(invitacion, new Date())) {
    throw new Error(
      "Esta invitación ya no sirve (venció, se usó o fue revocada). Pídele una nueva a quien te invitó."
    );
  }

  // La cuenta a la que entra tiene que seguir activa.
  const { data: cuenta } = await admin
    .from("cuentas_cliente")
    .select("id, cliente_id, estado")
    .eq("id", invitacion.cuenta_id)
    .maybeSingle();
  if (!cuenta || cuenta.estado !== "activa") {
    throw new Error("Esta cuenta no está activa. Escríbenos y lo resolvemos.");
  }

  const { data: creado, error: errorUsuario } = await admin.auth.admin.createUser({
    email: invitacion.email,
    password,
    email_confirm: true,
  });
  if (errorUsuario || !creado?.user) {
    registrarError("cuentas", errorUsuario ?? new Error("sin usuario"), {
      nota: "createUser colaborador falló",
    });
    throw new Error(
      /already|registered|exists/i.test(errorUsuario?.message ?? "")
        ? "Ese correo ya tiene un usuario en Invifty. Escríbenos para conectarlo a esta cuenta."
        : "No pudimos crear tu usuario. Inténtalo de nuevo en un momento."
    );
  }

  const { error: errorMiembro } = await admin.from("miembros_cuenta").insert({
    cuenta_id: cuenta.id,
    usuario_id: creado.user.id,
    rol: "colaborador",
    // Saneados otra vez al nacer el miembro: la fila de la invitación
    // pudo escribirse con un código anterior a la limpieza.
    permisos: sanearPermisos(invitacion.permisos),
    email: invitacion.email,
  });
  if (errorMiembro) {
    await admin.auth.admin.deleteUser(creado.user.id);
    registrarError("cuentas", errorMiembro, { nota: "miembro colaborador falló; usuario deshecho" });
    throw new Error("No pudimos terminar la activación. Inténtalo de nuevo.");
  }

  // La invitación se quema: un solo uso.
  const { error: errorInv } = await admin
    .from("invitaciones_cuenta")
    .update({ usado_en: new Date().toISOString() })
    .eq("id", invitacion.id)
    .is("usado_en", null);
  if (errorInv) registrarError("cuentas", errorInv, { nota: "invitación quedó sin quemar" });

  const { error: errorAud } = await admin.from("auditoria").insert({
    accion: "cuenta:activar_colaborador",
    entidad: "cliente",
    entidad_id: cuenta.cliente_id,
    usuario_id: creado.user.id,
    usuario_email: invitacion.email,
    detalles: {},
  });
  if (errorAud) registrarError("auditoria", errorAud, { accion: "cuenta:activar_colaborador" });

  await avisarPortal(admin, "portal_colaborador", cuenta.cliente_id, invitacion.email);

  return { email: invitacion.email };
}

/**
 * El EQUIPO genera un enlace de recuperación de contraseña para el
 * propietario (el cliente escribe por WhatsApp, el equipo se lo manda).
 * Vence en horas y se usa una vez. Jamás se genera una contraseña aquí.
 */
export async function generarRecuperacion(clienteId: string) {
  const supabase = await crearClienteServidor();
  const quien = await exigirPermiso(supabase, "gestionar_cuentas");

  const { data: cuenta } = await supabase
    .from("cuentas_cliente")
    .select("id, usuario_id, email, estado")
    .eq("cliente_id", clienteId)
    .maybeSingle();
  if (!cuenta?.usuario_id) throw new Error("Este cliente no tiene cuenta activada.");
  if (cuenta.estado !== "activa") {
    throw new Error("La cuenta no está activa: reactívala antes de recuperar la contraseña.");
  }

  const token = tokenOpaco();
  const admin = crearClienteAdmin();
  const { error } = await admin.from("recuperaciones").insert({
    usuario_id: cuenta.usuario_id,
    email: cuenta.email,
    token,
    expira_en: expiraRecuperacion(new Date()),
    creado_por_email: quien.email,
  });
  if (error) throw new Error(`No se pudo generar la recuperación: ${error.message}`);

  await registrarAccion(supabase, quien, "cuenta:generar_recuperacion", "cliente", clienteId);
  return { token };
}

/**
 * LA OTRA ACCIÓN PÚBLICA: canjear el token de recuperación por una
 * contraseña nueva que elige el cliente. Un solo uso, con fecha.
 */
export async function recuperarPassword(token: string, password: string) {
  if (!token || !/^[a-f0-9]{32}$/i.test(token)) throw new Error("Enlace de recuperación no válido.");
  if (!passwordValida(password)) {
    throw new Error("La contraseña debe tener al menos 8 caracteres.");
  }

  const admin = crearClienteAdmin();
  const { data: rec, error } = await admin
    .from("recuperaciones")
    .select("id, usuario_id, email, expira_en, usado_en")
    .eq("token", token)
    .maybeSingle();
  if (error) throw new Error("No pudimos comprobar tu enlace. Inténtalo de nuevo.");
  if (!rec || !recuperacionVigente(rec, new Date())) {
    throw new Error(
      "Este enlace de recuperación ya no sirve (venció o ya se usó). Escríbenos y te mandamos otro."
    );
  }

  // Primero se QUEMA el token (un solo uso), después se cambia la
  // contraseña: si dos peticiones llegan a la vez, solo una pasa.
  const { data: quemada, error: errorQuemar } = await admin
    .from("recuperaciones")
    .update({ usado_en: new Date().toISOString() })
    .eq("id", rec.id)
    .is("usado_en", null)
    .select("id");
  if (errorQuemar || !quemada?.length) {
    throw new Error("Este enlace ya se usó. Escríbenos si no fuiste tú.");
  }

  const { error: errorPassword } = await admin.auth.admin.updateUserById(rec.usuario_id, {
    password,
  });
  if (errorPassword) {
    registrarError("cuentas", errorPassword, { nota: "updateUserById falló tras quemar token" });
    throw new Error("No pudimos guardar tu contraseña nueva. Escríbenos y te mandamos otro enlace.");
  }

  const { error: errorAud } = await admin.from("auditoria").insert({
    accion: "cuenta:recuperar_password",
    entidad: "cliente",
    entidad_id: null,
    usuario_id: rec.usuario_id,
    usuario_email: rec.email,
    detalles: {},
  });
  if (errorAud) registrarError("auditoria", errorAud, { accion: "cuenta:recuperar_password" });

  // Aviso de seguridad: si el cliente no lo pidió, el equipo debe verlo.
  await avisarPortal(admin, "portal_password", null, rec.email, rec.usuario_id);

  return { email: rec.email };
}
