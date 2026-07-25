import { NextRequest, NextResponse } from "next/server";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { LIMITE_FOTOS } from "@/lib/planes";
import { Plan } from "@/lib/tipos";

const TIPOS_PERMITIDOS = [
  "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif",
  "video/mp4", "video/quicktime", "video/webm",
];
const TAMANO_MAXIMO = 50 * 1024 * 1024; // 50 MB (videos de portada)

async function buscarFormulario(token: string) {
  const supabase = crearClienteAdmin();
  const { data } = await supabase
    .from("formularios")
    .select("*, pedidos(*)")
    .eq("token", token)
    .single();
  return data;
}

// POST → subir un archivo al pedido (respetando el límite del plan)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const formulario = await buscarFormulario(token);
  if (!formulario) {
    return NextResponse.json({ error: "Formulario no encontrado" }, { status: 404 });
  }

  const pedido = formulario.pedidos;
  const supabase = crearClienteAdmin();

  const form = await req.formData();
  const archivo = form.get("archivo") as File | null;
  if (!archivo) return NextResponse.json({ error: "Falta el archivo" }, { status: 400 });
  if (!TIPOS_PERMITIDOS.includes(archivo.type)) {
    return NextResponse.json({ error: "Formato no permitido. Usa JPG, PNG, WebP o video MP4." }, { status: 400 });
  }
  if (archivo.size > TAMANO_MAXIMO) {
    return NextResponse.json({ error: "El archivo supera los 50 MB." }, { status: 400 });
  }

  // Límite de fotos según el plan (los videos cuentan aparte, máx. 1)
  const limite = LIMITE_FOTOS[pedido.plan as Plan];
  const { data: existentes } = await supabase.storage
    .from("fotos-pedidos")
    .list(pedido.id, { limit: 500 });
  const cantidadImagenes = (existentes ?? []).filter((a) => !a.name.startsWith("video-")).length;

  const esVideo = archivo.type.startsWith("video/");
  if (!esVideo && Number.isFinite(limite) && cantidadImagenes >= limite) {
    return NextResponse.json(
      { error: `Tu plan permite hasta ${limite} fotos. Elimina alguna para subir otra.` },
      { status: 400 }
    );
  }

  const extension = (archivo.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const prefijo = esVideo ? "video-" : "";
  const nombre = `${prefijo}${crypto.randomUUID()}.${extension}`;
  const ruta = `${pedido.id}/${nombre}`;

  const { error } = await supabase.storage
    .from("fotos-pedidos")
    .upload(ruta, archivo, { contentType: archivo.type });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, foto: { nombre, ruta } });
}

// DELETE → eliminar un archivo subido (?ruta=pedidoId/nombre)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const formulario = await buscarFormulario(token);
  if (!formulario) {
    return NextResponse.json({ error: "Formulario no encontrado" }, { status: 404 });
  }

  const ruta = req.nextUrl.searchParams.get("ruta") || "";
  // Solo puede borrar archivos de SU pedido
  if (!ruta.startsWith(`${formulario.pedidos.id}/`)) {
    return NextResponse.json({ error: "Ruta inválida" }, { status: 403 });
  }

  const supabase = crearClienteAdmin();
  const { error } = await supabase.storage.from("fotos-pedidos").remove([ruta]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// GET → vista previa firmada de un archivo (?ruta=...)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const formulario = await buscarFormulario(token);
  if (!formulario) {
    return NextResponse.json({ error: "Formulario no encontrado" }, { status: 404 });
  }

  const ruta = req.nextUrl.searchParams.get("ruta") || "";
  if (!ruta.startsWith(`${formulario.pedidos.id}/`)) {
    return NextResponse.json({ error: "Ruta inválida" }, { status: 403 });
  }

  const supabase = crearClienteAdmin();
  const { data, error } = await supabase.storage
    .from("fotos-pedidos")
    .createSignedUrl(ruta, 60 * 60); // 1 hora

  if (error || !data) return NextResponse.json({ error: "No disponible" }, { status: 500 });
  return NextResponse.json({ url: data.signedUrl });
}
