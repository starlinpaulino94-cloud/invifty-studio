import { NextRequest, NextResponse } from "next/server";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { demosPublicas, type DemoConInvitacion } from "@/lib/demos";
import { cabecerasCors } from "@/lib/cors-publico";
import { limitar, ipDePeticion } from "@/lib/limite";
import { urlBase } from "@/lib/url";

/**
 * GET /api/public/demos — las invitaciones de muestra para Invifty Web
 * =====================================================================
 * Devuelve las demos que el equipo marcó en /panel/demos: título, estilo,
 * enlace y portada. Solo invitaciones PUBLICADAS y demos activas; el
 * filtrado y la promesa de "nada privado sale" viven en lib/demos.ts,
 * que se prueba aparte.
 */

const FRENO = { max: 120, ventanaMs: 60 * 1000 };

export async function GET(req: NextRequest) {
  const cors = cabecerasCors(req.headers.get("origin"));

  const freno = limitar(`demos:${ipDePeticion(req.headers)}`, FRENO);
  if (!freno.ok) {
    return NextResponse.json(
      { error: "Demasiadas peticiones." },
      { status: 429, headers: { "Retry-After": String(freno.esperaS), ...cors } }
    );
  }

  const supabase = crearClienteAdmin();
  const { data } = await supabase
    .from("demos")
    .select("*, invitaciones(slug, plantilla, estado, datos)")
    .eq("activa", true)
    .order("orden");

  const demos = demosPublicas((data ?? []) as DemoConInvitacion[], urlBase());

  return NextResponse.json(
    { demos },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
        ...cors,
      },
    }
  );
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: cabecerasCors(req.headers.get("origin")),
  });
}
