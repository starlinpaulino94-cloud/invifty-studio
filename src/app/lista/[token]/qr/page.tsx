import { notFound } from "next/navigation";
import type { Metadata } from "next";
import QRCode from "qrcode";
import BotonImprimir from "@/components/panel/BotonImprimir";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { codigoCorto } from "@/lib/checkin";
import { urlBase } from "@/lib/url";
import type { DatosInvitacion } from "@/lib/tipos";

/**
 * LOS QR DE LOS HOGARES — /lista/<token>/qr
 * ==========================================
 * Una hoja para imprimir: un QR por hogar. El QR lleva el ENLACE
 * PERSONAL del hogar (/i/<slug>?h=<token-opaco>) — el invitado que lo
 * escanea abre su invitación con su nombre y su cupo ya puestos. Debajo,
 * el código corto para la puerta: se teclea en Recepción cuando no hay
 * cámara.
 *
 * PRIVACIDAD: dentro del QR no viaja ningún dato personal — solo la
 * dirección pública del evento y un token que es puro azar. El nombre
 * del hogar está IMPRESO al lado (la tarjeta es para dárselo en mano),
 * no codificado dentro.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Códigos QR de tus invitaciones — Invifty",
  robots: { index: false, follow: false },
};

export default async function PaginaQR({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = crearClienteAdmin();

  const { data: invitacion } = await supabase
    .from("invitaciones")
    .select("id, slug, datos")
    .eq("token_lista", token)
    .maybeSingle();
  if (!invitacion) notFound();

  const { data: hogares } = await supabase
    .from("hogares")
    .select("id, nombre, cupo, token")
    .eq("invitacion_id", invitacion.id)
    .order("nombre");
  if (!hogares || hogares.length === 0) notFound();

  const base = urlBase();
  const tarjetas = await Promise.all(
    hogares.map(async (h) => ({
      ...h,
      svg: await QRCode.toString(`${base}/i/${invitacion.slug}?h=${h.token}`, {
        type: "svg",
        margin: 1,
        width: 160,
        errorCorrectionLevel: "M",
        color: { dark: "#0D0D0F", light: "#FFFFFF" },
      }),
    }))
  );

  const titulo = (invitacion.datos as DatosInvitacion)?.titulo || "Tu evento";

  return (
    <main className="bg-white min-h-dvh p-8 print:p-0 text-black">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6 print:hidden">
          <div>
            <h1 className="font-serif text-2xl">Códigos de {titulo}</h1>
            <p className="text-xs text-gray-500 mt-1">
              Imprime esta hoja y recorta: cada tarjeta abre la invitación personal del hogar, y
              el código de abajo sirve para registrar su entrada en la puerta.
            </p>
          </div>
          <BotonImprimir />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {tarjetas.map((h) => (
            <div
              key={h.id}
              className="border border-gray-300 border-dashed rounded-xl p-4 text-center break-inside-avoid"
            >
              <div
                className="mx-auto w-[160px]"
                // SVG generado en el servidor por la librería `qrcode`
                dangerouslySetInnerHTML={{ __html: h.svg }}
              />
              <p className="text-sm font-bold mt-2">{h.nombre}</p>
              <p className="text-[11px] text-gray-500">
                hasta {h.cupo} {h.cupo === 1 ? "persona" : "personas"}
              </p>
              <p className="text-[11px] tracking-[0.3em] font-mono mt-1">{codigoCorto(h.token)}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
