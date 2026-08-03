import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { esHostPropio, seSirveEnCualquierDominio } from "@/lib/dominios";
import { urlBase } from "@/lib/url";

/**
 * Proxy (middleware) de Next.js:
 *  - Manda al dueño correcto las peticiones que llegan por el dominio
 *    propio de un cliente (el extra "Dominio Web Propio").
 *  - Mantiene fresca la sesión de Supabase (refresco de cookies).
 *  - Protege todas las rutas /panel: sin sesión → /login.
 *
 * El orden importa: lo del dominio va primero y no consulta la base de
 * datos ni la sesión, así que una petición desde el dominio de un cliente
 * no arrastra el coste de comprobar una sesión que ahí no existe.
 */
export default async function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const ruta = request.nextUrl.pathname;

  /* ---------- Dominio propio del cliente ---------- */
  if (!seSirveEnCualquierDominio(ruta) && !esHostPropio(host, urlBase())) {
    // Todo lo que llegue por ese dominio es su invitación: no hay panel ni
    // formularios ahí. La API sí responde igual (`seSirveEnCualquierDominio`),
    // porque de ella salen las confirmaciones y el conteo de visitas.
    const destino = request.nextUrl.clone();
    destino.pathname = `/d/${encodeURIComponent(host)}`;
    destino.search = "";
    const reescrita = NextResponse.rewrite(destino);
    // Las mismas cabeceras que /i lleva por next.config: las reglas de ahí
    // miran la ruta ANTES de esta reescritura y aquí nunca coinciden.
    reescrita.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    reescrita.headers.set("Referrer-Policy", "no-referrer");
    return reescrita;
  }

  let respuesta = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          respuesta = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            respuesta.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const esPanel = ruta.startsWith("/panel");
  const esLogin = ruta.startsWith("/login");

  // La sesión solo se comprueba donde hace falta: el resto de páginas son
  // públicas y no tienen por qué pagar una llamada a Supabase.
  if (!esPanel && !esLogin) return respuesta;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (esPanel && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (esLogin && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/panel";
    return NextResponse.redirect(url);
  }

  return respuesta;
}

export const config = {
  /**
   * Todas las peticiones menos los archivos estáticos: hace falta ver el
   * Host de cada una para saber si viene por el dominio de un cliente.
   * Antes solo miraba /panel y /login.
   */
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
