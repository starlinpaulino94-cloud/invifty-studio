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
