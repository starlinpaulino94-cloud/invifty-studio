import { NextRequest, NextResponse } from "next/server";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { haySesion } from "@/lib/sesion";
import { generarDerivados } from "@/lib/imagenes";
import {
  BUCKET, listarArchivos, rutaOriginal, rutaWeb, rutaMiniatura,
} from "@/lib/fotos";
import { FOTOS_POR_TANDA, MS_POR_TANDA, type AvanceFotos } from "@/lib/mantenimiento";

/**
 * GENERAR LAS VERSIONES LIGERAS DE LAS FOTOS YA SUBIDAS
 * ======================================================
 * Las fotos subidas antes de esta mejora se sirven desde el original: 3-6 MB
 * cada una. Al subir una foto nueva los derivados se generan solos; esto es
 * para ponerse al día con las viejas.
 *
 *   GET  → cuenta cuántas faltan, sin tocar nada.
 *   POST → procesa UNA TANDA y devuelve por dónde se quedó.
 *
 * Va por tandas porque una función de servidor tiene tiempo máximo y esto
 * son cientos de fotos que hay que bajar, convertir y volver a subir. El
 * panel llama en bucle hasta que `terminado` viene en true.
 *
 * Es seguro repetirlo y seguro cortarlo a media faena: el cursor solo avanza
 * cuando un pedido queda entero, así que la tanda siguiente vuelve a mirar el
 * que se quedó a medias y salta las fotos que ya se hicieron. El original
 * nunca se toca.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Admin = ReturnType<typeof crearClienteAdmin>;

/** Pedidos por página. Nada que ver con las fotos: solo evita traerse
 *  la tabla entera en cada llamada. */
const PEDIDOS_POR_PAGINA = 40;

async function pedidosDesde(admin: Admin, cursor: string | null, limite: number) {
  let consulta = admin.from("pedidos").select("id").order("id").limit(limite);
  if (cursor) consulta = consulta.gt("id", cursor);
  const { data, error } = await consulta;
  return { pedidos: (data ?? []) as { id: string }[], error };
}

/* ---------- Cuántas faltan ---------- */

export async function GET() {
  if (!(await haySesion())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const admin = crearClienteAdmin();
  const { data, error } = await admin.from("pedidos").select("id").order("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const pedidos = (data ?? []) as { id: string }[];

  // De ocho en ocho: en serie tarda demasiado con muchos pedidos, y todas a
  // la vez es un montón de peticiones simultáneas a Storage.
  let pendientes = 0;
  let fotos = 0;
  for (let i = 0; i < pedidos.length; i += 8) {
    const listas = await Promise.all(
      pedidos.slice(i, i + 8).map((p) => listarArchivos(admin, p.id, 500))
    );
    for (const lista of listas) {
      const imagenes = lista.filter((a) => !a.esVideo);
      fotos += imagenes.length;
      pendientes += imagenes.filter((a) => !a.tieneDerivados).length;
    }
  }

  return NextResponse.json({ ok: true, pedidos: pedidos.length, fotos, pendientes });
}

/* ---------- Procesar una tanda ---------- */

export async function POST(req: NextRequest) {
  if (!(await haySesion())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const cuerpo = await req.json().catch(() => ({}));
  const cursorInicial: string | null =
    typeof cuerpo?.cursor === "string" && cuerpo.cursor ? cuerpo.cursor : null;

  const admin = crearClienteAdmin();
  const { pedidos, error } = await pedidosDesde(admin, cursorInicial, PEDIDOS_POR_PAGINA);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const avance: AvanceFotos = {
    procesadas: 0,
    fallidas: 0,
    saltadas: 0,
    fallos: [],
    cursor: cursorInicial,
    terminado: pedidos.length === 0,
  };

  const empezado = Date.now();
  const sinTiempo = () => Date.now() - empezado > MS_POR_TANDA;

  for (const pedido of pedidos) {
    if (avance.procesadas >= FOTOS_POR_TANDA || sinTiempo()) break;

    const archivos = await listarArchivos(admin, pedido.id, 500);
    const pendientes = archivos.filter((a) => !a.esVideo && !a.tieneDerivados);
    avance.saltadas += archivos.filter((a) => !a.esVideo && a.tieneDerivados).length;

    let pedidoCompleto = true;

    for (const foto of pendientes) {
      if (avance.procesadas >= FOTOS_POR_TANDA || sinTiempo()) {
        // Este pedido queda a medias: el cursor NO avanza más allá de él.
        pedidoCompleto = false;
        break;
      }

      const hecho = await procesarFoto(admin, pedido.id, foto.nombre);
      if (hecho === true) avance.procesadas++;
      else {
        avance.fallidas++;
        avance.fallos.push(`${foto.nombre}: ${hecho}`);
      }
    }

    if (!pedidoCompleto) break;
    avance.cursor = pedido.id;
  }

  // Solo se da por terminado cuando la página de pedidos vino incompleta Y se
  // recorrió entera: si vino llena, quedan más pedidos por detrás.
  if (pedidos.length < PEDIDOS_POR_PAGINA && avance.cursor === pedidos.at(-1)?.id) {
    avance.terminado = true;
  }

  return NextResponse.json({ ok: true, ...avance });
}

/** Devuelve true, o el motivo del fallo. Nunca lanza. */
async function procesarFoto(
  admin: Admin,
  pedidoId: string,
  nombre: string
): Promise<true | string> {
  const { data: descarga, error } = await admin.storage
    .from(BUCKET)
    .download(rutaOriginal(pedidoId, nombre));

  if (error || !descarga) return "no se pudo descargar";

  const derivados = await generarDerivados(Buffer.from(await descarga.arrayBuffer()));
  // Un formato que el servidor no sabe leer (un HEIC, por ejemplo). La foto
  // se sigue viendo desde el original: no hay nada que arreglar.
  if (!derivados) return "formato no soportado, se queda el original";

  const subidas = await Promise.all([
    admin.storage.from(BUCKET).upload(rutaWeb(pedidoId, nombre), derivados.web, {
      contentType: "image/webp",
      upsert: true,
    }),
    admin.storage.from(BUCKET).upload(rutaMiniatura(pedidoId, nombre), derivados.miniatura, {
      contentType: "image/webp",
      upsert: true,
    }),
  ]);

  const fallo = subidas.find((s) => s.error);
  return fallo ? `no se pudieron subir las versiones ligeras (${fallo.error!.message})` : true;
}
