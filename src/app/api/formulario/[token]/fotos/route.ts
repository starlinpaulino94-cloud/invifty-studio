import { NextRequest, NextResponse } from "next/server";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { LIMITE_FOTOS } from "@/lib/planes";
import { Plan } from "@/lib/tipos";
import { generarDerivados } from "@/lib/imagenes";
import {
  BUCKET, borrarArchivo, listarArchivos, rutaMiniatura, rutaOriginal, rutaWeb, urlsDeFoto,
} from "@/lib/fotos";

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
  const existentes = await listarArchivos(supabase, pedido.id, 500);
  const cantidadImagenes = existentes.filter((a) => !a.esVideo).length;

  const archivoEsVideo = archivo.type.startsWith("video/");
  if (!archivoEsVideo && Number.isFinite(limite) && cantidadImagenes >= limite) {
    return NextResponse.json(
      { error: `Tu plan permite hasta ${limite} fotos. Elimina alguna para subir otra.` },
      { status: 400 }
    );
  }

  const extension = (archivo.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const prefijo = archivoEsVideo ? "video-" : "";
  const nombre = `${prefijo}${crypto.randomUUID()}.${extension}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(rutaOriginal(pedido.id, nombre), archivo, { contentType: archivo.type });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  /**
   * Versiones ligeras para la invitación. El original se queda intacto
   * para el equipo de diseño. Si la conversión falla (formato raro), la
   * foto sirve igual desde el original: no se corta la subida.
   */
  if (!archivoEsVideo) {
    const derivados = await generarDerivados(Buffer.from(await archivo.arrayBuffer()));
    if (derivados) {
      await Promise.all([
        supabase.storage
          .from(BUCKET)
          .upload(rutaWeb(pedido.id, nombre), derivados.web, { contentType: "image/webp" }),
        supabase.storage
          .from(BUCKET)
          .upload(rutaMiniatura(pedido.id, nombre), derivados.miniatura, {
            contentType: "image/webp",
          }),
      ]);
    }
  }

  return NextResponse.json({
    ok: true,
    foto: { nombre, ruta: rutaOriginal(pedido.id, nombre) },
  });
}

/**
 * Extrae el nombre del archivo a partir de la ruta que manda el cliente,
 * comprobando que sea un archivo directo de SU pedido. Rechaza cualquier
 * cosa con subcarpetas o saltos de directorio ("pedido/../otro/foto.jpg"),
 * para que el token de un pedido no pueda alcanzar los archivos de otro.
 */
function nombreDeRuta(ruta: string, pedidoId: string): string | null {
  const prefijo = `${pedidoId}/`;
  if (!ruta.startsWith(prefijo)) return null;
  const nombre = ruta.slice(prefijo.length);
  if (!nombre || nombre.includes("/") || nombre.includes("..")) return null;
  return nombre;
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

  const pedidoId = formulario.pedidos.id as string;
  const nombre = nombreDeRuta(req.nextUrl.searchParams.get("ruta") || "", pedidoId);
  if (!nombre) return NextResponse.json({ error: "Ruta inválida" }, { status: 403 });

  // Se borra también la versión web y la miniatura, para no dejar huérfanos.
  const { error } = await borrarArchivo(crearClienteAdmin(), pedidoId, nombre);
  if (error) return NextResponse.json({ error }, { status: 500 });
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

  const pedidoId = formulario.pedidos.id as string;
  const nombre = nombreDeRuta(req.nextUrl.searchParams.get("ruta") || "", pedidoId);
  if (!nombre) return NextResponse.json({ error: "Ruta inválida" }, { status: 403 });

  // La vista previa del formulario usa la miniatura: el cliente está en el
  // celular y no necesita descargar su propia foto a tamaño completo.
  const supabase = crearClienteAdmin();
  const archivos = await listarArchivos(supabase, pedidoId, 500);
  const archivo = archivos.find((a) => a.nombre === nombre);
  if (!archivo) return NextResponse.json({ error: "No disponible" }, { status: 404 });

  const { urlMiniatura } = await urlsDeFoto(supabase, pedidoId, archivo);
  if (!urlMiniatura) return NextResponse.json({ error: "No disponible" }, { status: 500 });
  return NextResponse.json({ url: urlMiniatura });
}
