import type { NextConfig } from "next";

/**
 * CABECERAS DE SEGURIDAD
 * =======================
 * Lo que el navegador necesita que le digamos y por defecto no decimos.
 *
 * POR QUÉ NO HAY UN CSP QUE LIMITE SCRIPTS
 * -----------------------------------------
 * Sería lo primero que uno pondría, y aquí rompería el producto.
 *
 * Las invitaciones "de código propio" son HTML de terceros (a veces hecho
 * con IA) que se muestra dentro de un iframe con `srcDoc`. Un documento
 * srcdoc NO hace petición de red: hereda el CSP de la página que lo
 * contiene. Así que un `script-src 'self'` en la página de la invitación
 * mataría el JavaScript del diseño del cliente, y sus tipografías e
 * imágenes externas — invitaciones ya pagadas y repartidas.
 *
 * Y no es solo la página pública: el editor del panel enseña esa misma
 * previsualización en vivo (components/panel/VistaPreviaEnVivo.tsx), así
 * que el CSP tampoco puede ir en /panel.
 *
 * El aislamiento de ese HTML no depende del CSP: va en un iframe con
 * `sandbox` y SIN `allow-same-origin`, o sea con origen opaco, sin acceso
 * a la sesión del equipo ni a la página de fuera (ver lib/codigo.ts).
 *
 * Contra el clickjacking del panel se usa X-Frame-Options, que es cabecera
 * de respuesta y por lo tanto no lo hereda ningún srcdoc.
 */

/** Válidas en cualquier página, públicas incluidas. */
const BASICAS = [
  // Sin esto el navegador "adivina" el tipo de un archivo por su contenido,
  // y una foto subida por un cliente podría acabar ejecutándose como script.
  { key: "X-Content-Type-Options", value: "nosniff" },

  // El slug de una invitación es secreto (por eso lleva sufijo al azar). Sin
  // esta cabecera, al pulsar un enlace externo se enviaría la URL entera al
  // otro sitio en el Referer: solo sale el dominio.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },

  // Nada de esto se usa; se apaga para que no lo pueda usar nadie más.
  // `camera` se queda fuera a propósito: en el móvil el cliente sube fotos
  // con la cámara desde el formulario.
  { key: "Permissions-Policy", value: "geolocation=(), microphone=(), payment=(), usb=()" },

  // Un año de HTTPS obligatorio. Sin `includeSubDomains` ni `preload`: esto
  // también viaja por los dominios propios de los clientes y no sabemos qué
  // tienen colgando de sus subdominios.
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
];

/**
 * La invitación publicada: pública para quien tiene el enlace, invisible
 * para todo lo demás. La versión servida por dominio propio no pasa por
 * aquí (el proxy la reescribe antes de que estas reglas miren la ruta),
 * así que src/proxy.ts pone estas mismas cabeceras al reescribir.
 */
const INVITACION = [
  // El noindex del HTML no cubre lo que no es HTML; esta cabecera sí.
  { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
  // El slug es semisecreto: a los sitios externos no les llega ni el dominio.
  { key: "Referrer-Policy", value: "no-referrer" },
];

/** Donde vive la sesión del equipo y los datos de los clientes. */
const PRIVADAS = [
  // Nadie mete el panel en un iframe suyo para robar clics.
  { key: "X-Frame-Options", value: "DENY" },
  // Que ni el navegador ni un proxy guarden copia de datos de clientes.
  { key: "Cache-Control", value: "no-store, max-age=0" },
];

const nextConfig: NextConfig = {
  /**
   * El HTML de una invitación de código propio viaja en el cuerpo de la
   * acción de servidor que guarda el editor. El tope por defecto de Next
   * es 1 MB, y una invitación con imágenes o tipografías embebidas lo
   * pasa de sobra: la acción moría con «Body exceeded 1 MB limit» y el
   * navegador enseñaba «This page couldn't load», sin decir nada útil.
   *
   * 4 MB deja margen sobre LIMITE_CODIGO_BYTES (lib/codigo.ts: 3 MB de
   * código + el JSON del resto) y queda por debajo de los 4,5 MB que
   * Vercel permite en el cuerpo de una función. Más allá de eso ya no es
   * cuestión de configurar: se rechaza con un mensaje claro.
   */
  experimental: {
    serverActions: { bodySizeLimit: "4mb" },
  },

  async headers() {
    return [
      { source: "/:path*", headers: BASICAS },
      { source: "/panel/:path*", headers: PRIVADAS },
      { source: "/login", headers: PRIVADAS },
      { source: "/api/:path*", headers: PRIVADAS },
      // El panel del anfitrión: no lleva sesión, pero enseña la lista de
      // invitados de una persona. No se cachea y no se deja enmarcar.
      { source: "/lista/:path*", headers: PRIVADAS },
      // El formulario del cliente, por lo mismo: sus datos y sus fotos.
      { source: "/f/:path*", headers: PRIVADAS },
      { source: "/i/:path*", headers: INVITACION },
      { source: "/d/:path*", headers: INVITACION },
    ];
  },
};

export default nextConfig;
