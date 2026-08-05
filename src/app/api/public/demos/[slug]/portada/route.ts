import { NextRequest, NextResponse } from "next/server";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { listarArchivos, ordenarFotos, urlsDeFoto } from "@/lib/fotos";
import { limitar, ipDePeticion } from "@/lib/limite";
import type { DatosInvitacion } from "@/lib/tipos";

/**
 * GET /api/public/demos/<slug>/portada — la imagen de muestra de una demo
 * ========================================================================
 * Las fotos viven en un bucket privado con URLs firmadas que CADUCAN, así
 * que la web no puede pegarse una URL fija. Esta ruta es la dirección
 * estable: comprueba que el slug es una demo activa y publicada, firma la
 * miniatura de la portada en ese momento y redirige.
 *
 * Solo funciona para DEMOS: no es una vía para sacar fotos de cualquier
 * invitación conociendo su slug — sin fila activa en `demos`, 404.
 */

const FRENO = { max: 120, ventanaMs: 60 * 1000 };

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const freno = limitar(`demo-portada:${ipDePeticion(req.headers)}`, FRENO);
  if (!freno.ok) {
    return NextResponse.json({ error: "Demasiadas peticiones." }, { status: 429 });
  }

  const { slug } = await params;
  const supabase = crearClienteAdmin();

  const { data: invitacion } = await supabase
    .from("invitaciones")
    .select("id, pedido_id, estado, datos, demos!inner(activa)")
    .eq("slug", slug)
    .eq("demos.activa", true)
    .maybeSingle();

  if (!invitacion || invitacion.estado !== "publicada") {
    return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  }

  const datos = (invitacion.datos ?? {}) as DatosInvitacion;
  const archivos = await listarArchivos(supabase, invitacion.pedido_id);
  const visibles = ordenarFotos(archivos, datos.ordenFotos, datos.fotosOcultas).filter(
    (a) => !a.esVideo
  );

  const portada = visibles[0];
  if (!portada) return NextResponse.json({ error: "Sin portada" }, { status: 404 });

  const { urlMiniatura, url } = await urlsDeFoto(supabase, invitacion.pedido_id, portada);
  const destino = urlMiniatura ?? url;
  if (!destino) return NextResponse.json({ error: "Sin portada" }, { status: 404 });

  return NextResponse.redirect(destino, {
    // Menos que la vida de la firma, para no redirigir a una URL muerta.
    headers: { "Cache-Control": "public, s-maxage=1800, max-age=900" },
  });
}
