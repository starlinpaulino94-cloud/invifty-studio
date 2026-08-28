import { NextRequest, NextResponse } from "next/server";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { ipDePeticion, limitar, limitarCompartido } from "@/lib/limite";
import { generarDerivados } from "@/lib/imagenes";
import { BUCKET, HORAS_FIRMA } from "@/lib/fotos";
import { contratoDePedido } from "@/lib/capacidades";
import {
  autorLimpio,
  estadoDeGaleria,
  GALERIA_MAX_MB,
  GALERIA_TIPOS,
  MAX_FOTOS_GALERIA,
  rutaGaleria,
  rutaGaleriaMiniatura,
  tieneGaleria,
} from "@/lib/galeria";
import { registrarError } from "@/lib/registro";

/**
 * LA API PÚBLICA DE LA GALERÍA — autenticada por conocer el enlace,
 * como el RSVP: cualquiera con /galeria/<slug> es, por definición, un
 * invitado. Lo que cuida el resto son los frenos (compartidos entre
 * instancias: esto lo puede llamar cualquiera de internet), los topes
 * técnicos y la moderación del anfitrión.
 */

const SEGUNDOS_FIRMA = HORAS_FIRMA * 60 * 60;

/** Subidas por IP: un invitado real sube un puñado, no cientos. */
const FRENO_SUBIDA = { max: 30, ventanaS: 15 * 60 };
/** Lecturas del álbum, por IP. */
const FRENO_LECTURA = { max: 120, ventanaMs: 5 * 60 * 1000 };

async function buscarGaleria(slug: string) {
  const admin = crearClienteAdmin();
  const { data } = await admin
    .from("invitaciones")
    .select("id, estado, galeria_abierta, pedidos(id, extras, plan, capacidades_contratadas)")
    .eq("slug", slug)
    .maybeSingle();
  if (!data?.pedidos) return null;

  const pedido = data.pedidos as unknown as {
    id: string; extras: string[]; plan: string; capacidades_contratadas: unknown;
  };
  const incluida = tieneGaleria(pedido, contratoDePedido(pedido));
  return {
    admin,
    invitacion: data as unknown as { id: string; estado: string; galeria_abierta: boolean },
    estado: estadoDeGaleria(incluida, data as unknown as { estado: string; galeria_abierta: boolean }),
  };
}

async function fotosFirmadas(
  admin: ReturnType<typeof crearClienteAdmin>,
  invitacionId: string
) {
  const { data: filas } = await admin
    .from("fotos_galeria")
    .select("id, ruta, miniatura_ruta, autor, creado_en")
    .eq("invitacion_id", invitacionId)
    .eq("estado", "visible")
    .order("creado_en", { ascending: false })
    .limit(MAX_FOTOS_GALERIA);

  const fotos = filas ?? [];
  if (!fotos.length) return [];

  // Una sola llamada firma todo el álbum (web y miniaturas juntas).
  const rutas = fotos.flatMap((f) => [f.ruta, f.miniatura_ruta]);
  const { data: firmadas } = await admin.storage
    .from(BUCKET)
    .createSignedUrls(rutas, SEGUNDOS_FIRMA);
  const porRuta = new Map((firmadas ?? []).map((f) => [f.path, f.signedUrl]));

  return fotos.map((f) => ({
    id: f.id,
    autor: f.autor,
    url: porRuta.get(f.ruta) ?? null,
    miniatura: porRuta.get(f.miniatura_ruta) ?? null,
  }));
}

// GET → el álbum (fotos visibles, de la más nueva a la más vieja)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const freno = limitar(`galeria-ver:${ipDePeticion(req.headers)}`, FRENO_LECTURA);
  if (!freno.ok) {
    return NextResponse.json(
      { error: "Demasiadas peticiones. Espera un momento." },
      { status: 429, headers: { "Retry-After": String(freno.esperaS) } }
    );
  }

  const galeria = await buscarGaleria(slug);
  if (!galeria || galeria.estado === "no_disponible") {
    return NextResponse.json({ error: "Galería no encontrada" }, { status: 404 });
  }

  const fotos = await fotosFirmadas(galeria.admin, galeria.invitacion.id);
  return NextResponse.json({ abierta: galeria.estado === "abierta", fotos });
}

// POST → un invitado sube su foto
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  // El freno va ANTES de leer el cuerpo: si no, ya nos tragamos los MB.
  // Compartido entre instancias: esta ruta la puede llamar cualquiera.
  const admin = crearClienteAdmin();
  const freno = await limitarCompartido(
    admin,
    `galeria-subir:${ipDePeticion(req.headers)}`,
    FRENO_SUBIDA
  );
  if (!freno.ok) {
    return NextResponse.json(
      { error: "Demasiadas subidas seguidas. Espera un momento." },
      { status: 429, headers: { "Retry-After": String(freno.esperaS) } }
    );
  }

  const galeria = await buscarGaleria(slug);
  if (!galeria || galeria.estado === "no_disponible") {
    return NextResponse.json({ error: "Galería no encontrada" }, { status: 404 });
  }
  if (galeria.estado !== "abierta") {
    return NextResponse.json(
      { error: "La galería está cerrada por ahora. Pregúntale al anfitrión." },
      { status: 403 }
    );
  }

  const form = await req.formData();
  const archivo = form.get("archivo") as File | null;
  const autor = autorLimpio(form.get("autor"));
  if (!archivo) return NextResponse.json({ error: "Falta la foto." }, { status: 400 });
  if (!(archivo.type in GALERIA_TIPOS)) {
    return NextResponse.json({ error: "Solo se aceptan fotos (JPG, PNG, WebP o HEIC)." }, { status: 400 });
  }
  if (archivo.size > GALERIA_MAX_MB * 1024 * 1024) {
    return NextResponse.json({ error: `La foto supera los ${GALERIA_MAX_MB} MB.` }, { status: 400 });
  }

  // Tope técnico del álbum.
  const { count } = await admin
    .from("fotos_galeria")
    .select("id", { count: "exact", head: true })
    .eq("invitacion_id", galeria.invitacion.id);
  if ((count ?? 0) >= MAX_FOTOS_GALERIA) {
    return NextResponse.json(
      { error: "El álbum está lleno. ¡Gracias por querer compartir!" },
      { status: 400 }
    );
  }

  // Siempre se guardan los DERIVADOS, nunca el original: en la galería
  // colaborativa el original de 6 MB de cada invitado no aporta nada y
  // multiplica el Storage. Si la conversión falla, la foto no entra.
  const datos = Buffer.from(await archivo.arrayBuffer());
  const derivados = await generarDerivados(datos);
  if (!derivados) {
    return NextResponse.json(
      { error: "No pudimos procesar esa foto. Intenta con otra." },
      { status: 400 }
    );
  }

  const id = crypto.randomUUID();
  const ruta = rutaGaleria(galeria.invitacion.id, id);
  const miniatura = rutaGaleriaMiniatura(galeria.invitacion.id, id);

  const { error: errorWeb } = await admin.storage
    .from(BUCKET)
    .upload(ruta, derivados.web, { contentType: "image/webp" });
  const { error: errorMin } = await admin.storage
    .from(BUCKET)
    .upload(miniatura, derivados.miniatura, { contentType: "image/webp" });
  if (errorWeb || errorMin) {
    registrarError("galeria", errorWeb ?? errorMin, { slug, paso: "subir" });
    return NextResponse.json({ error: "No se pudo guardar la foto. Inténtalo de nuevo." }, { status: 500 });
  }

  const { error } = await admin.from("fotos_galeria").insert({
    id,
    invitacion_id: galeria.invitacion.id,
    ruta,
    miniatura_ruta: miniatura,
    autor,
  });
  if (error) {
    // La fila no entró: los archivos huérfanos se limpian, mejor-esfuerzo.
    await admin.storage.from(BUCKET).remove([ruta, miniatura]).catch(() => {});
    registrarError("galeria", error, { slug, paso: "insertar" });
    return NextResponse.json({ error: "No se pudo guardar la foto. Inténtalo de nuevo." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
