/**
 * DOMINIO PROPIO DE UNA INVITACIÓN
 * =================================
 * El catálogo vende "Dominio Web Propio" (RD$ 1,500) y el formulario
 * pregunta cuál quiere el cliente. Hasta ahora no existía nada: todas las
 * invitaciones vivían en /i/<slug> y el extra solo podía cumplirse a mano.
 *
 * Cómo funciona ahora, en dos partes:
 *
 *  1. FUERA DEL SISTEMA, una sola vez por dominio: añadirlo al proyecto en
 *     Vercel y apuntar el DNS. Eso no lo puede hacer el código; ninguna
 *     plataforma deja que una aplicación reclame dominios por su cuenta.
 *  2. DENTRO DEL SISTEMA, lo que vive aquí: cuando llega una petición con un
 *     dominio que no es el nuestro, el proxy la manda a /d/<dominio>, que
 *     busca de quién es y sirve su invitación.
 *
 * Así el paso manual se reduce a DNS, y quién es dueño de qué dominio es un
 * dato del sistema, no una configuración suelta que nadie recuerda.
 */

/**
 * Dominios que son del propio Studio y nunca pertenecen a un cliente.
 *
 * invifty.com y sus subdominios van fijos aquí: son la marca de la casa y
 * ningún cliente los tendrá como "dominio propio". Sin esto, entrar por
 * studio.invifty.com con NEXT_PUBLIC_APP_URL apuntando todavía a la URL de
 * Vercel hacía que el proxy lo tratara como dominio de un cliente — y el
 * panel entero respondía 404.
 */
const SUFIJOS_PROPIOS = [".vercel.app", ".localhost", ".invifty.com"];
const HOSTS_PROPIOS = ["localhost", "127.0.0.1", "0.0.0.0", "invifty.com"];

/** Quita el puerto de un Host ("midominio.com:3000" → "midominio.com"). */
export function hostSinPuerto(host: string): string {
  return (host ?? "").trim().toLowerCase().split(":")[0].replace(/\.$/, "");
}

/**
 * Deja el dominio como se guarda: sin protocolo, sin ruta, sin puerto, en
 * minúsculas y sin "www.".
 *
 * Se quita el "www." a propósito: quien escribe "www.bodacamila.com" y quien
 * escribe "bodacamila.com" quieren lo mismo, y guardarlos distinto haría que
 * una de las dos direcciones no encontrara nada.
 */
export function normalizarDominio(entrada: string): string {
  const limpio = (entrada ?? "")
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, "")
    .split("/")[0]
    .split("?")[0];

  return hostSinPuerto(limpio).replace(/^www\./, "");
}

/**
 * ¿Tiene forma de dominio? No comprueba que exista ni que apunte a ningún
 * sitio — eso se ve al configurarlo — pero evita guardar "mi boda" o un
 * enlace entero por error.
 */
export function dominioValido(dominio: string): boolean {
  if (!dominio || dominio.length > 253) return false;
  const etiquetas = dominio.split(".");
  if (etiquetas.length < 2) return false;
  // La última etiqueta es la extensión: solo letras y al menos dos.
  if (!/^[a-z]{2,}$/.test(etiquetas.at(-1)!)) return false;
  return etiquetas
    .slice(0, -1)
    .every((e) => /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(e));
}

/**
 * ¿Esta petición llega por un dominio del Studio o por el de un cliente?
 *
 * `base` es la dirección propia configurada (NEXT_PUBLIC_APP_URL). Sin ella
 * no se puede distinguir, así que se prefiere fallar del lado seguro y
 * tratarlo todo como propio: es mejor que el panel siga accesible a que un
 * despliegue mal configurado sirva una invitación en su lugar.
 */
export function esHostPropio(host: string, base: string): boolean {
  const limpio = hostSinPuerto(host);
  if (!limpio) return true;
  if (HOSTS_PROPIOS.includes(limpio)) return true;
  if (SUFIJOS_PROPIOS.some((s) => limpio.endsWith(s))) return true;

  const propio = hostSinPuerto((base ?? "").replace(/^[a-z]+:\/\//, "").split("/")[0]);
  if (!propio) return true;

  // Con y sin "www.": las dos son la misma casa.
  return limpio === propio || limpio.replace(/^www\./, "") === propio.replace(/^www\./, "");
}

/**
 * Rutas que se sirven igual venga por donde venga la petición. La API tiene
 * que responder en el dominio del cliente — de ahí salen las confirmaciones
 * de asistencia y el conteo de visitas de esa invitación.
 */
const RUTAS_COMPARTIDAS = ["/api/", "/_next/", "/favicon"];

export function seSirveEnCualquierDominio(ruta: string): boolean {
  return RUTAS_COMPARTIDAS.some((r) => ruta.startsWith(r));
}
