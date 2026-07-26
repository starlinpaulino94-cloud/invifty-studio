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

/** Donde vive la sesión del equipo y los datos de los clientes. */
const PRIVADAS = [
  // Nadie mete el panel en un iframe suyo para robar clics.
  { key: "X-Frame-Options", value: "DENY" },
  // Que ni el navegador ni un proxy guarden copia de datos de clientes.
  { key: "Cache-Control", value: "no-store, max-age=0" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: "/:path*", headers: BASICAS },
      { source: "/panel/:path*", headers: PRIVADAS },
      { source: "/login", headers: PRIVADAS },
      { source: "/api/:path*", headers: PRIVADAS },
    ];
  },
};

export default nextConfig;
