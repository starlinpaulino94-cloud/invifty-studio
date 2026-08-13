import { NextRequest, NextResponse } from "next/server";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { limitarCompartido, ipDePeticion } from "@/lib/limite";
import {
  puedeDecidir, seccionValida, comentarioValido,
  REFERENCIA_TIPOS, REFERENCIA_MAX_MB, MAX_REFERENCIAS_POR_REVISION,
  type RevisionVigencia,
} from "@/lib/revision";
import { encolarAvisoEquipo } from "@/lib/avisos";
import { registrarError } from "@/lib/registro";
import { BUCKET } from "@/lib/fotos";
import { urlBase } from "@/lib/url";
import type { DatosInvitacion } from "@/lib/tipos";

/**
 * COMENTARIO DEL CLIENTE — POST /api/revision/<token>/comentario
 * ===============================================================
 * Sin sesión: el token ES la autorización, igual que el formulario /f.
 * El servidor valida que la revisión siga viva (ni revocada, ni caducada,
 * ni ya decidida), que la sección exista en el catálogo y que el texto
 * tenga un tamaño humano.
 *
 * Acepta multipart: junto al texto puede venir UNA imagen de referencia
 * ("quiero la portada más como esto"). La imagen va al bucket PRIVADO
 * bajo referencias/<invitacion>/ — el panel la enseña con URL firmada —
 * y tiene tres frenos: tipo (JPG/PNG/WEBP), tamaño (8 MB) y un tope por
 * revisión, porque el token viaja por WhatsApp y el Storage no es
 * infinito. El freno de peticiones va ANTES de leer el archivo: primero
 * se decide si se atiende, después se paga el ancho de banda.
 */

const MAX_TEXTO = 1000;
const MAX_COMENTARIOS = 100;
const FRENO = { max: 30, ventanaS: 10 * 60 };

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const freno = await limitarCompartido(
    crearClienteAdmin(),
    `revision:${ipDePeticion(req.headers)}`,
    FRENO
  );
  if (!freno.ok) {
    return NextResponse.json(
      { error: "Demasiados envíos seguidos. Espera un momento." },
      { status: 429, headers: { "Retry-After": String(freno.esperaS) } }
    );
  }

  // JSON (texto solo) o multipart (texto + imagen): las dos puertas.
  let seccion = "general";
  let texto = "";
  let imagen: File | null = null;

  if (req.headers.get("content-type")?.includes("multipart/form-data")) {
    const formulario = await req.formData().catch(() => null);
    if (!formulario) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    seccion = String(formulario.get("seccion") ?? "general");
    texto = String(formulario.get("texto") ?? "").trim().slice(0, MAX_TEXTO);
    const archivo = formulario.get("imagen");
    if (archivo instanceof File && archivo.size > 0) imagen = archivo;
  } else {
    const body = await req.json().catch(() => null);
    seccion = String(body?.seccion ?? "general");
    texto = String(body?.texto ?? "").trim().slice(0, MAX_TEXTO);
  }

  if (!seccionValida(seccion)) {
    return NextResponse.json({ error: "Sección desconocida" }, { status: 400 });
  }
  if (!comentarioValido(texto, imagen !== null)) {
    return NextResponse.json({ error: "Escribe el comentario o adjunta una imagen." }, { status: 400 });
  }
  if (imagen) {
    if (!REFERENCIA_TIPOS[imagen.type]) {
      return NextResponse.json({ error: "La imagen debe ser JPG, PNG o WEBP." }, { status: 400 });
    }
    if (imagen.size > REFERENCIA_MAX_MB * 1024 * 1024) {
      return NextResponse.json(
        { error: `La imagen no puede pasar de ${REFERENCIA_MAX_MB} MB.` },
        { status: 400 }
      );
    }
  }

  const supabase = crearClienteAdmin();
  const { data: revision } = await supabase
    .from("revisiones")
    .select("id, estado, expira_en, revocada_en, invitacion_id, versiones(datos)")
    .eq("token", token)
    .maybeSingle();

  if (!revision) {
    return NextResponse.json({ error: "Enlace no disponible" }, { status: 404 });
  }
  if (!puedeDecidir(revision as unknown as RevisionVigencia, new Date())) {
    return NextResponse.json(
      { error: "Esta revisión ya se cerró. Pide al equipo un enlace nuevo." },
      { status: 409 }
    );
  }

  // Tope por revisión: nadie escribe cien comentarios de buena fe.
  const { count } = await supabase
    .from("comentarios")
    .select("id", { count: "exact", head: true })
    .eq("revision_id", revision.id);
  if ((count ?? 0) >= MAX_COMENTARIOS) {
    return NextResponse.json(
      { error: "Esta revisión alcanzó el máximo de comentarios." },
      { status: 429 }
    );
  }

  // Tope de imágenes, aparte del de comentarios: el Storage es lo caro.
  let imagenRuta: string | null = null;
  if (imagen) {
    const { count: conImagen } = await supabase
      .from("comentarios")
      .select("id", { count: "exact", head: true })
      .eq("revision_id", revision.id)
      .not("imagen_ruta", "is", null);
    if ((conImagen ?? 0) >= MAX_REFERENCIAS_POR_REVISION) {
      return NextResponse.json(
        { error: `Esta revisión ya tiene ${MAX_REFERENCIAS_POR_REVISION} imágenes. Escríbelo en texto o avisa al equipo.` },
        { status: 429 }
      );
    }

    imagenRuta = `referencias/${revision.invitacion_id}/${crypto.randomUUID()}.${REFERENCIA_TIPOS[imagen.type]}`;
    const { error: errorSubida } = await supabase.storage
      .from(BUCKET)
      .upload(imagenRuta, imagen, { contentType: imagen.type });
    if (errorSubida) {
      registrarError("revision", errorSubida, { paso: "subir referencia" });
      return NextResponse.json({ error: "No se pudo subir la imagen." }, { status: 500 });
    }
  }

  let { error } = await supabase.from("comentarios").insert({
    revision_id: revision.id,
    seccion,
    texto: texto || "(imagen de referencia)",
    autor: "cliente",
    ...(imagenRuta ? { imagen_ruta: imagenRuta } : {}),
  });

  // Base sin la migración de referencias: el comentario entra sin la
  // imagen (que ya subió — se anota la ruta en el log para no perderla).
  if (error && imagenRuta && /column|imagen_ruta|schema/i.test(error.message)) {
    registrarError("revision", error, {
      nota: "falta la migración 20260806050000; referencia subida sin fila",
    });
    ({ error } = await supabase.from("comentarios").insert({
      revision_id: revision.id,
      seccion,
      texto: texto || "(imagen de referencia)",
      autor: "cliente",
    }));
  }
  if (error) {
    registrarError("revision", error, { codigo: error.code, paso: "comentar" });
    return NextResponse.json({ error: "No se pudo guardar el comentario." }, { status: 500 });
  }

  const datos = (revision.versiones as unknown as { datos: DatosInvitacion } | null)?.datos;
  await encolarAvisoEquipo(
    supabase,
    "comentario_nuevo",
    {
      nombre: datos?.titulo || "Un cliente",
      detalle: imagenRuta ? `${seccion}, con imagen` : seccion,
      rutaPanel: `/panel/invitaciones/${revision.invitacion_id}`,
      urlBase: urlBase(),
    },
    { tipo: "revision", id: revision.id }
  );

  return NextResponse.json({ ok: true, conImagen: imagenRuta !== null });
}
