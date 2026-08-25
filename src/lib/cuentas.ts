/**
 * CUENTAS DEL PORTAL DE CLIENTES — la lógica pura
 * ================================================
 * El cliente NO se registra: Invifty le crea el acceso y le manda un
 * enlace de activación (por WhatsApp, como todo en este negocio). El
 * enlace CADUCA a los 7 días y es de un solo uso: al activar, el cliente
 * pone SU contraseña — una contraseña jamás viaja por WhatsApp ni por
 * correo. Reenviar la activación genera token nuevo y mata el anterior.
 *
 * Las reglas de vigencia viven aquí, puras y probadas, porque si fallan
 * no dan error en ninguna pantalla: dejan un enlace de activación
 * eterno rodando por WhatsApp, que es una llave sin fecha de cambio.
 */

export const DIAS_ACTIVACION = 7;

export type EstadoCuenta = "pendiente" | "activa" | "suspendida";

/** Cuándo caduca un enlace de activación generado ahora. */
export function expiraActivacion(ahora: Date): string {
  return new Date(ahora.getTime() + DIAS_ACTIVACION * 24 * 60 * 60 * 1000).toISOString();
}

export interface ActivacionPendiente {
  estado: string;
  token_activacion: string | null;
  activacion_expira: string | null;
}

/**
 * ¿Este token de activación sigue sirviendo? Solo si la cuenta está
 * pendiente, el token existe y no ha caducado. Una cuenta activa o
 * suspendida no se re-activa con un enlace viejo.
 */
export function activacionVigente(cuenta: ActivacionPendiente, ahora: Date): boolean {
  return (
    cuenta.estado === "pendiente" &&
    Boolean(cuenta.token_activacion) &&
    Boolean(cuenta.activacion_expira) &&
    new Date(cuenta.activacion_expira!).getTime() > ahora.getTime()
  );
}

/** La contraseña mínima que aceptamos. Sencilla de explicar, sin teatro. */
export const MIN_PASSWORD = 8;

export function passwordValida(password: string): boolean {
  return typeof password === "string" && password.length >= MIN_PASSWORD;
}

/* =====================================================================
 * COLABORADORES — el segundo miembro, con permisos acotados
 * ===================================================================== */

/**
 * Los permisos que el propietario puede dar (o no) a un colaborador.
 * El propietario los tiene TODOS siempre. La base los exige igual que la
 * interfaz (mi_permiso() en las políticas): esconder la sección no es
 * seguridad.
 */
export const PERMISOS_COLABORADOR = [
  { id: "ver_pagos", nombre: "Ver pagos y saldos" },
  { id: "editar_invitacion", nombre: "Editar los textos de la invitación" },
] as const;

export type PermisoColaborador = (typeof PERMISOS_COLABORADOR)[number]["id"];

/**
 * Limpia lo que llegó del navegador antes de guardarlo como permisos:
 * SOLO ids del catálogo y SOLO el booleano true. Importa porque
 * mi_permiso() en la base hace `(permisos->>x)::boolean` — y el string
 * "true" también castea a true: un objeto sin sanear podría conceder
 * en la base lo que la pantalla cree negado.
 */
export function sanearPermisos(
  crudo: unknown
): Partial<Record<PermisoColaborador, boolean>> {
  const limpios: Partial<Record<PermisoColaborador, boolean>> = {};
  if (!crudo || typeof crudo !== "object") return limpios;
  for (const { id } of PERMISOS_COLABORADOR) {
    if ((crudo as Record<string, unknown>)[id] === true) limpios[id] = true;
  }
  return limpios;
}

/**
 * ¿Este miembro tiene este permiso? La misma regla que mi_permiso() en
 * la base: propietario = todo; colaborador = solo lo concedido.
 */
export function tienePermiso(
  miembro: { rol: string; permisos: Record<string, unknown> | null },
  permiso: PermisoColaborador
): boolean {
  if (miembro.rol === "propietario") return true;
  return miembro.permisos?.[permiso] === true;
}

/**
 * Tope TÉCNICO de miembros por cuenta (anti-abuso), no una regla
 * comercial: nadie ha vendido "hasta N colaboradores". Si algún día se
 * vuelve comercial, va al catálogo y a la foto del contrato, no aquí.
 */
export const MAX_MIEMBROS = 10;

export interface InvitacionColaborador {
  expira_en: string | null;
  usado_en: string | null;
  revocada_en: string | null;
}

/** ¿Esta invitación de colaborador sigue sirviendo? Un solo uso, con fecha. */
export function invitacionVigente(inv: InvitacionColaborador, ahora: Date): boolean {
  return (
    !inv.usado_en &&
    !inv.revocada_en &&
    Boolean(inv.expira_en) &&
    new Date(inv.expira_en!).getTime() > ahora.getTime()
  );
}

/* =====================================================================
 * RECUPERACIÓN DE CONTRASEÑA — mismo patrón, vida más corta
 * ===================================================================== */

/**
 * Horas de vida de un enlace de recuperación. Más corto que la
 * activación (7 días): la recuperación se pide y se usa en el momento;
 * un enlace de cambio de contraseña no puede quedarse días rodando.
 */
export const HORAS_RECUPERACION = 24;

export function expiraRecuperacion(ahora: Date): string {
  return new Date(ahora.getTime() + HORAS_RECUPERACION * 60 * 60 * 1000).toISOString();
}

export interface Recuperacion {
  expira_en: string | null;
  usado_en: string | null;
}

/** ¿Este enlace de recuperación sigue sirviendo? Un solo uso, con fecha. */
export function recuperacionVigente(rec: Recuperacion, ahora: Date): boolean {
  return (
    !rec.usado_en &&
    Boolean(rec.expira_en) &&
    new Date(rec.expira_en!).getTime() > ahora.getTime()
  );
}

/** Mensaje listo para WhatsApp con el enlace de activación. */
export function mensajeWhatsAppActivacion(nombreCliente: string, url: string): string {
  const primerNombre = nombreCliente.split(" ")[0];
  return (
    `¡Hola ${primerNombre}! 💛 Ya tienes tu portal de cliente en Invifty.\n\n` +
    `Desde ahí podrás ver tu invitación, tus invitados y tus confirmaciones, todo en un solo lugar.\n\n` +
    `Actívalo aquí (el enlace vence en ${DIAS_ACTIVACION} días) y elige tu contraseña:\n\n` +
    `🔐 ${url}\n\n` +
    `Si el enlace vence, escríbenos y te mandamos uno nuevo. ¡Nunca te pediremos tu contraseña!`
  );
}

/** Mensaje del propietario a su colaborador con el enlace de invitación. */
export function mensajeWhatsAppInvitacionColaborador(url: string): string {
  return (
    `¡Hola! Te comparto el acceso a nuestro portal de Invifty para que veas ` +
    `la invitación y los invitados del evento.\n\n` +
    `Actívalo aquí (el enlace vence en ${DIAS_ACTIVACION} días) y elige tu contraseña:\n\n` +
    `🔐 ${url}\n\n` +
    `Invifty nunca te pedirá tu contraseña.`
  );
}

/** Mensaje del equipo con el enlace de recuperación de contraseña. */
export function mensajeWhatsAppRecuperacion(nombreCliente: string, url: string): string {
  const primerNombre = nombreCliente.split(" ")[0];
  return (
    `¡Hola ${primerNombre}! 💛 Aquí tienes el enlace para elegir una contraseña nueva ` +
    `de tu portal de Invifty (vence en ${HORAS_RECUPERACION} horas y se usa una sola vez):\n\n` +
    `🔐 ${url}\n\n` +
    `Si tú no lo pediste, ignóralo y avísanos. ¡Nunca te pediremos tu contraseña!`
  );
}
