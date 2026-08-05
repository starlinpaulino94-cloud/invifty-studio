/**
 * REGISTRO DE ERRORES DEL SERVIDOR
 * =================================
 * Las rutas API le dicen al usuario "no se pudo guardar" —correcto, no hay
 * que enseñarle tripas— pero hasta ahora TIRABAN el error de verdad. Un 500
 * en producción era indiagnosticable: ni qué tabla, ni qué código, nada.
 *
 * Esto escribe el error a la salida estándar, que en Vercel es el log de la
 * función (Vercel → proyecto → Logs) y en local la terminal. Sin proveedor
 * externo a propósito: es la observabilidad que no requiere ni cuenta ni
 * clave. Si algún día se conecta Sentry, se conecta AQUÍ y todos los que
 * llaman quedan puestos (ver docs/observabilidad.md).
 *
 * REGLA DE ORO: al log no entran datos personales. Nombres, teléfonos,
 * notas de invitados y tokens se quedan fuera — el log es para saber QUÉ
 * se rompió, no QUIÉN lo estaba usando. `redactar` corta además cualquier
 * cosa con pinta de clave o token que venga dentro del mensaje de error.
 */

/** Tapa lo que tenga forma de secreto: JWT, claves sb_*, tokens hex largos. */
function redactar(texto: string): string {
  return texto
    .replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}/g, "[JWT]")
    .replace(/sb_(?:secret|publishable)_[A-Za-z0-9_-]+/g, "[CLAVE]")
    .replace(/\b[a-f0-9]{32,}\b/gi, "[TOKEN]");
}

/**
 * Registra un error del servidor con su ámbito ("rsvp", "cron", …) y
 * contexto NO personal (slug, código de error, tabla). El ámbito es lo que
 * luego se busca en el log: `[rsvp]` encuentra todos los suyos.
 */
export function registrarError(
  ambito: string,
  error: unknown,
  contexto?: Record<string, string | number | undefined>
): void {
  const mensaje =
    error instanceof Error ? `${error.name}: ${error.message}` : String(error ?? "desconocido");

  const extras = contexto
    ? " " +
      Object.entries(contexto)
        .filter(([, v]) => v !== undefined && v !== "")
        .map(([k, v]) => `${k}=${v}`)
        .join(" ")
    : "";

  console.error(redactar(`[${ambito}] ${mensaje}${extras}`));
}
