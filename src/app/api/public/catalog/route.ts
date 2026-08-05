import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { catalogoPublico } from "@/lib/catalogo-publico";
import { cabecerasCors } from "@/lib/cors-publico";
import { limitar, ipDePeticion } from "@/lib/limite";

/**
 * GET /api/public/catalog — el catálogo que consume Invifty Web
 * ==============================================================
 * Solo lectura y sin secretos: planes, precios y capacidades REALES (lo
 * vendido-pero-no-implementado no sale; ver lib/catalogo-publico.ts). La
 * web deja de llevar los precios copiados a mano: cambiarlos en
 * lib/planes.ts y desplegar es cambiarlos en todas partes.
 *
 * El contenido sale de la configuración, no de la base de datos, así que
 * se puede cachear fuerte: 5 minutos compartidos + ETag para que las
 * visitas repetidas cuesten un 304 vacío.
 */

/** Generoso: es contenido cacheado. Frena solo el bucle descarado. */
const FRENO = { max: 120, ventanaMs: 60 * 1000 };

export async function GET(req: NextRequest) {
  const cors = cabecerasCors(req.headers.get("origin"));

  const freno = limitar(`catalogo:${ipDePeticion(req.headers)}`, FRENO);
  if (!freno.ok) {
    return NextResponse.json(
      { error: "Demasiadas peticiones." },
      { status: 429, headers: { "Retry-After": String(freno.esperaS), ...cors } }
    );
  }

  const cuerpo = JSON.stringify(catalogoPublico());
  const etag = `"${createHash("sha256").update(cuerpo).digest("hex").slice(0, 16)}"`;

  const cabeceras = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
    ETag: etag,
    ...cors,
  };

  if (req.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304, headers: cabeceras });
  }

  return new NextResponse(cuerpo, { headers: cabeceras });
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: cabecerasCors(req.headers.get("origin")),
  });
}
