/**
 * VARIABLES DE ENTORNO, EN UN SOLO SITIO
 * =======================================
 * Antes cada módulo leía `process.env.X!` por su cuenta. El `!` le miente
 * al compilador: si la variable falta, el error revienta lejos de aquí y
 * dice "Invalid URL" en vez de "falta NEXT_PUBLIC_SUPABASE_URL". Quien
 * instala el sistema pierde una hora en descubrir lo que esta función le
 * habría dicho en una línea.
 *
 * Reglas de la casa:
 *  - El error SIEMPRE nombra la variable y NUNCA enseña su valor.
 *  - Lo secreto comprueba que no está corriendo en un navegador. Si eso
 *    llegara a pasar, el bundle del cliente tendría la clave dentro: mejor
 *    un error a gritos que un secreto en silencio.
 *  - `NEXT_PUBLIC_*` se lee con acceso DIRECTO (process.env.NOMBRE, no
 *    process.env[nombre]): Next las incrusta al compilar buscando el texto
 *    literal, y el acceso dinámico se quedaría vacío en el navegador.
 */

function faltante(nombre: string, pista: string): Error {
  return new Error(
    `Falta la variable de entorno ${nombre}. ${pista} ` +
      "(Copia .env.example como .env.local y complétala; en producción va en Vercel → Environment Variables.)"
  );
}

/* ---------- Públicas (seguras en el navegador) ---------- */

export function supabaseUrl(): string {
  const valor = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!valor) throw faltante("NEXT_PUBLIC_SUPABASE_URL", "Es la URL del proyecto de Supabase.");
  return valor;
}

export function supabaseClaveAnon(): string {
  const valor = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!valor) throw faltante("NEXT_PUBLIC_SUPABASE_ANON_KEY", "Es la clave pública (anon) de Supabase.");
  return valor;
}

/* ---------- Secretas (solo servidor) ---------- */

/** Revienta si esto corre donde no debe. Un secreto en el navegador es la filtración ya hecha. */
function soloServidor(nombre: string): void {
  if (typeof window !== "undefined") {
    throw new Error(
      `${nombre} se pidió desde el navegador. Es una clave de servidor: ` +
        "algún componente cliente está importando código administrativo."
    );
  }
}

/**
 * La clave administrativa de Supabase: salta RLS, así que su sitio es el
 * servidor y ningún otro. Se aceptan los dos nombres — SUPABASE_SECRET_KEY
 * es el actual y SUPABASE_SERVICE_ROLE_KEY el clásico — con preferencia
 * por el nuevo, para poder rotar sin tocar código.
 */
export function supabaseClaveSecreta(): string {
  soloServidor("SUPABASE_SECRET_KEY");
  const valor =
    process.env.SUPABASE_SECRET_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!valor) {
    throw faltante(
      "SUPABASE_SECRET_KEY (o SUPABASE_SERVICE_ROLE_KEY)",
      "Es la clave secreta del servidor."
    );
  }
  return valor;
}

/**
 * La contraseña del repaso diario de vencimientos. Sin ella la ruta del
 * cron queda cerrada A PROPÓSITO: devolvemos null y quien llama responde
 * 401, para que nadie pueda disparar el repaso desde fuera.
 */
export function secretoCron(): string | null {
  soloServidor("CRON_SECRET");
  return process.env.CRON_SECRET?.trim() || null;
}

/* ---------- IA creativa (Etapa D) ---------- */

export type ModoIA = "mock" | "anthropic" | "off";

/**
 * Qué proveedor de conceptos está activo. Por defecto "mock": el pipeline
 * completo funciona sin clave ni coste. "anthropic" exige IA_API_KEY — sin
 * ella se cae a mock CON NOTA EN EL LOG, porque un despliegue que cree
 * estar usando IA real y esté usando el mock debe poder descubrirse.
 */
export function modoIA(): ModoIA {
  soloServidor("IA_PROVEEDOR");
  const valor = process.env.IA_PROVEEDOR?.trim().toLowerCase();
  if (valor === "off") return "off";
  if (valor === "anthropic") {
    if (!process.env.IA_API_KEY?.trim()) {
      console.error("[ia] IA_PROVEEDOR=anthropic pero falta IA_API_KEY: se usa el modo mock.");
      return "mock";
    }
    return "anthropic";
  }
  return "mock";
}

/** La clave del proveedor de IA. Secreta: solo servidor. */
export function claveIA(): string | null {
  soloServidor("IA_API_KEY");
  return process.env.IA_API_KEY?.trim() || null;
}
