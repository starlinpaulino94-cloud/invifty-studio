import { NextRequest, NextResponse } from "next/server";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { ipDePeticion, limitarCompartido } from "@/lib/limite";
import { BUCKET } from "@/lib/fotos";
import {
  COMPROBANTE_MAX_MB,
  COMPROBANTE_TIPOS,
  MAX_NOTA,
  validarReporte,
} from "@/lib/cobro";
import { encolarAvisoEquipo } from "@/lib/avisos";
import { urlBase } from "@/lib/url";
import { formatoDOP } from "@/lib/planes";
import { registrarError } from "@/lib/registro";

/**
 * EL CLIENTE REPORTA SU TRANSFERENCIA — /api/cobro/<token>/reportar
 * ==================================================================
 * Autenticado por el token de cobro del pedido. Crea un pagos_reportados
 * PENDIENTE: el balance no se mueve hasta que el equipo lo confirme
 * contra el banco. El comprobante va al bucket privado de siempre.
 */

/** Reportes por IP: un cliente real reporta uno o dos, no veinte. */
const FRENO = { max: 10, ventanaS: 15 * 60 };

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  // El freno ANTES de leer el cuerpo, compartido entre instancias: esta
  // ruta la puede llamar cualquiera de internet.
  const admin = crearClienteAdmin();
  const freno = await limitarCompartido(admin, `cobro:${ipDePeticion(req.headers)}`, FRENO);
  if (!freno.ok) {
    return NextResponse.json(
      { error: "Demasiados intentos seguidos. Espera un momento." },
      { status: 429, headers: { "Retry-After": String(freno.esperaS) } }
    );
  }

  const { data: pedido } = await admin
    .from("pedidos")
    .select("id, clientes(nombre)")
    .eq("token_cobro", token)
    .maybeSingle();
  if (!pedido) return NextResponse.json({ error: "Enlace no encontrado" }, { status: 404 });

  const form = await req.formData();
  const archivo = form.get("comprobante") as File | null;

  const veredicto = validarReporte({
    monto: form.get("monto"),
    referencia: String(form.get("referencia") ?? ""),
    tieneComprobante: Boolean(archivo && archivo.size > 0),
  });
  if (!veredicto.ok) return NextResponse.json({ error: veredicto.error }, { status: 400 });

  const nota = String(form.get("nota") ?? "").trim().slice(0, MAX_NOTA) || null;

  // El comprobante, si vino: al bucket privado bajo comprobantes/<pedido>/.
  let comprobanteRuta: string | null = null;
  if (archivo && archivo.size > 0) {
    if (!(archivo.type in COMPROBANTE_TIPOS)) {
      return NextResponse.json(
        { error: "El comprobante debe ser una imagen (JPG, PNG, WebP) o un PDF." },
        { status: 400 }
      );
    }
    if (archivo.size > COMPROBANTE_MAX_MB * 1024 * 1024) {
      return NextResponse.json(
        { error: `El comprobante supera los ${COMPROBANTE_MAX_MB} MB.` },
        { status: 400 }
      );
    }
    comprobanteRuta = `comprobantes/${pedido.id}/reporte-${crypto.randomUUID()}.${COMPROBANTE_TIPOS[archivo.type]}`;
    const { error: errorSubida } = await admin.storage
      .from(BUCKET)
      .upload(comprobanteRuta, Buffer.from(await archivo.arrayBuffer()), {
        contentType: archivo.type,
      });
    if (errorSubida) {
      registrarError("cobro", errorSubida, { paso: "subir comprobante" });
      return NextResponse.json(
        { error: "No se pudo guardar el comprobante. Inténtalo de nuevo." },
        { status: 500 }
      );
    }
  }

  const { error } = await admin.from("pagos_reportados").insert({
    pedido_id: pedido.id,
    monto: veredicto.monto,
    referencia: veredicto.referencia,
    comprobante_ruta: comprobanteRuta,
    nota,
  });
  if (error) {
    registrarError("cobro", error, { paso: "insertar reporte" });
    return NextResponse.json(
      { error: "No se pudo enviar tu reporte. Inténtalo de nuevo." },
      { status: 500 }
    );
  }

  // Aviso al equipo: dinero reportado no puede esperar al que abra el panel.
  const nombre = (pedido.clientes as unknown as { nombre: string } | null)?.nombre ?? "Un cliente";
  await encolarAvisoEquipo(
    admin,
    "pago_reportado",
    {
      nombre,
      detalle: formatoDOP(veredicto.monto),
      rutaPanel: `/panel/pedidos/${pedido.id}`,
      urlBase: urlBase(),
    },
    { tipo: "pedido", id: pedido.id }
  );

  return NextResponse.json({ ok: true });
}
