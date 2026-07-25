/**
 * URL base del sistema, usada para armar los enlaces que se envían a los
 * clientes (formularios e invitaciones).
 *
 * Orden de resolución:
 *  1. NEXT_PUBLIC_APP_URL — lo que definas tú en Vercel (recomendado:
 *     tu dominio final, ej. https://studio.invifty.com).
 *  2. VERCEL_PROJECT_PRODUCTION_URL — dominio de producción del proyecto,
 *     que Vercel inyecta solo. Evita que los enlaces salgan con
 *     "localhost" si olvidas configurar la variable anterior.
 *  3. VERCEL_URL — la URL de este despliegue concreto (útil en previews).
 *  4. localhost — desarrollo local.
 */
export function urlBase(): string {
  const configurada = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configurada) return sinBarraFinal(configurada);

  const produccion = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (produccion) return `https://${sinBarraFinal(produccion)}`;

  const despliegue = process.env.VERCEL_URL?.trim();
  if (despliegue) return `https://${sinBarraFinal(despliegue)}`;

  return "http://localhost:3000";
}

function sinBarraFinal(url: string): string {
  return url.replace(/\/+$/, "");
}
