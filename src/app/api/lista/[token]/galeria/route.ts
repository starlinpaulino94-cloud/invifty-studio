import { NextRequest, NextResponse } from "next/server";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { limitar } from "@/lib/limite";
import { BUCKET } from "@/lib/fotos";
import { registrarError } from "@/lib/registro";

/**
 * LA MODERACIÓN DE LA GALERÍA — /api/lista/<token>/galeria
 * =========================================================
 * El anfitrión manda en su álbum, con el mismo token secreto de su
 * panel: abrir o cerrar la galería, ocultar una foto (sale del álbum
 * sin borrarse) y eliminarla del todo (también del Storage).
 */

const FRENO = { max: 60, ventanaMs: 10 * 60 * 1000 };

async function invitacionDelToken(token: string) {
  const supabase = crearClienteAdmin();
  const { data } = await supabase
    .from("invitaciones")
    .select("id, galeria_abierta")
    .eq("token_lista", token)
    .maybeSingle();
  return data;
}

function frenar(token: string) {
  const freno = limitar(`galeria-moderar:${token}`, FRENO);
  if (freno.ok) return null;
  return NextResponse.json(
    { error: "Demasiadas acciones seguidas. Espera un momento." },
    { status: 429, headers: { "Retry-After": String(freno.esperaS) } }
  );
}

/* ---------- El álbum COMPLETO del anfitrión (visibles y ocultas) ---------- */

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const frenada = frenar(token);
  if (frenada) return frenada;

  const invitacion = await invitacionDelToken(token);
  if (!invitacion) return NextResponse.json({ error: "Lista no encontrada" }, { status: 404 });

  const supabase = crearClienteAdmin();
  const { data: filas } = await supabase
    .from("fotos_galeria")
    .select("id, ruta, miniatura_ruta, autor, estado, creado_en")
    .eq("invitacion_id", invitacion.id)
    .order("creado_en", { ascending: false })
    .limit(500);

  const fotos = filas ?? [];
  const rutas = fotos.map((f) => f.miniatura_ruta);
  const { data: firmadas } = rutas.length
    ? await supabase.storage.from(BUCKET).createSignedUrls(rutas, 60 * 60)
    : { data: [] };
  const porRuta = new Map((firmadas ?? []).map((f) => [f.path, f.signedUrl]));

  return NextResponse.json({
    abierta: Boolean(invitacion.galeria_abierta),
    fotos: fotos.map((f) => ({
      id: f.id,
      autor: f.autor,
      estado: f.estado,
      miniatura: porRuta.get(f.miniatura_ruta) ?? null,
    })),
  });
}

/* ---------- Abrir/cerrar la galería u ocultar/mostrar una foto ---------- */

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const frenada = frenar(token);
  if (frenada) return frenada;

  const invitacion = await invitacionDelToken(token);
  if (!invitacion) return NextResponse.json({ error: "Lista no encontrada" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const supabase = crearClienteAdmin();

  // El interruptor del álbum.
  if (typeof body?.abierta === "boolean") {
    const { error } = await supabase
      .from("invitaciones")
      .update({ galeria_abierta: body.abierta })
      .eq("id", invitacion.id);
    if (error) return NextResponse.json({ error: "No se pudo guardar." }, { status: 500 });
    return NextResponse.json({ ok: true, abierta: body.abierta });
  }

  // Ocultar o volver a mostrar una foto. La pertenencia se exige en el
  // propio update: una foto de OTRA invitación no se toca ni sabiendo su id.
  const fotoId = typeof body?.fotoId === "string" ? body.fotoId : null;
  const estado = body?.estado === "oculta" || body?.estado === "visible" ? body.estado : null;
  if (!fotoId || !estado) {
    return NextResponse.json({ error: "Falta qué cambiar." }, { status: 400 });
  }

  const { data: filas, error } = await supabase
    .from("fotos_galeria")
    .update({ estado })
    .eq("id", fotoId)
    .eq("invitacion_id", invitacion.id)
    .select("id");
  if (error) return NextResponse.json({ error: "No se pudo guardar." }, { status: 500 });
  if (!filas?.length) return NextResponse.json({ error: "Esa foto no existe." }, { status: 404 });

  return NextResponse.json({ ok: true });
}

/* ---------- Eliminar una foto del todo ---------- */

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const frenada = frenar(token);
  if (frenada) return frenada;

  const invitacion = await invitacionDelToken(token);
  if (!invitacion) return NextResponse.json({ error: "Lista no encontrada" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const fotoId = typeof body?.fotoId === "string" ? body.fotoId : null;
  if (!fotoId) return NextResponse.json({ error: "Falta la foto." }, { status: 400 });

  const supabase = crearClienteAdmin();
  const { data: foto } = await supabase
    .from("fotos_galeria")
    .select("id, ruta, miniatura_ruta")
    .eq("id", fotoId)
    .eq("invitacion_id", invitacion.id)
    .maybeSingle();
  if (!foto) return NextResponse.json({ error: "Esa foto no existe." }, { status: 404 });

  const { error } = await supabase.from("fotos_galeria").delete().eq("id", foto.id);
  if (error) return NextResponse.json({ error: "No se pudo eliminar." }, { status: 500 });

  // El Storage después de la fila: un archivo huérfano no enseña nada
  // (las URLs firmadas caducan) y la limpieza es mejor-esfuerzo.
  await supabase.storage
    .from(BUCKET)
    .remove([foto.ruta, foto.miniatura_ruta])
    .catch((e) => registrarError("galeria", e, { paso: "borrar storage" }));

  return NextResponse.json({ ok: true });
}
