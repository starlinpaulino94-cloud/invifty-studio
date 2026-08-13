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

/**
 * ¿Los enlaces se están generando con un dominio DISTINTO al que se está
 * usando? Pasó de verdad: NEXT_PUBLIC_APP_URL decía "invifty.co" (sin la
 * eme) y los formularios salieron por WhatsApp con un enlace roto, sin
 * que nada fallara a la vista. El panel usa esto para avisar en grande.
 * Devuelve null cuando todo cuadra o cuando no hay con qué comparar.
 */
export function avisoDeDominio(
  hostReal: string | null | undefined
): { configurado: string; real: string } | null {
  if (!hostReal) return null;
  try {
    const configurado = new URL(urlBase()).host;
    return configurado === hostReal ? null : { configurado, real: hostReal };
  } catch {
    return null; // una urlBase impronunciable no puede tumbar el panel
  }
}
