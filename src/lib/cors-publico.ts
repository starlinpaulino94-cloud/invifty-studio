import { urlBase } from "./url";

/**
 * CORS DE LA API PÚBLICA (/api/public/*)
 * =======================================
 * Estas rutas existen para que Invifty Web —otro despliegue, otro
 * dominio— consulte el catálogo y envíe leads desde el navegador. El CORS
 * dice desde QUÉ páginas puede hacerlo un navegador: la marca y nada más.
 *
 * Qué protege y qué no, sin cuentos: CORS frena el uso desde OTRAS webs
 * (que nadie monte un formulario ajeno alimentándose de nuestra API), pero
 * no frena a un script sin navegador. Para eso están el rate limiting, la
 * validación y el honeypot de cada ruta. Por lo mismo, aquí NO hay clave
 * secreta: una clave dentro del JavaScript público de la web dejaría de
 * ser secreta en el primer F12.
 */

const ORIGENES_FIJOS = [
  "https://invifty.com",
  "https://www.invifty.com",
];

function permitido(origen: string): boolean {
  if (ORIGENES_FIJOS.includes(origen)) return true;
  // El propio Studio (previews de Vercel incluidas) y el desarrollo local.
  if (origen === urlBase()) return true;
  if (/^http:\/\/localhost(:\d+)?$/.test(origen)) return true;
  return false;
}

/**
 * Cabeceras CORS para un origen dado. Si el origen no está permitido
 * devuelve {} — sin cabeceras, el navegador bloquea la respuesta solo.
 * Una petición sin Origin (curl, servidor a servidor) no necesita CORS.
 */
export function cabecerasCors(origen: string | null): Record<string, string> {
  if (!origen || !permitido(origen)) return {};
  return {
    "Access-Control-Allow-Origin": origen,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    // El origen permitido varía por petición: que ningún caché lo mezcle.
    Vary: "Origin",
    "Access-Control-Max-Age": "86400",
  };
}
