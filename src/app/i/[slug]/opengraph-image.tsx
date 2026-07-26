import { ImageResponse } from "next/og";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { paleta } from "@/config/diseno";
import { inicialesDe } from "@/components/invitacion/base/Ornamentos";
import { fechaSinDiaSemana } from "@/lib/fechas";
import { DatosInvitacion } from "@/lib/tipos";

/**
 * Tarjeta de vista previa de la invitación.
 * Es lo que ven los invitados cuando el cliente comparte su enlace por
 * WhatsApp, Instagram o Facebook — la primera impresión del producto.
 *
 * Se dibuja con la paleta real de cada invitación, así que cada una llega
 * con sus propios colores en lugar de un enlace gris sin imagen.
 *
 * PRIVACIDAD: solo las invitaciones PUBLICADAS muestran sus datos. Los
 * borradores y los slugs inexistentes devuelven una tarjeta neutra de
 * Invifty, porque este endpoint lo consultan robots sin sesión iniciada.
 */

export const alt = "Invitación digital";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * El título encoge cuando es largo, para que nunca se desborde ni empuje
 * a la fecha contra el pie. Los nombres largos ("Valeria Guadalupe
 * Fernández Sánchez") son la norma, no la excepción.
 */
function tamanoTitulo(titulo: string): number {
  if (titulo.length > 40) return 52;
  if (titulo.length > 28) return 64;
  if (titulo.length > 16) return 84;
  return 100;
}

async function buscarPublicada(slug: string) {
  try {
    const admin = crearClienteAdmin();
    const { data } = await admin
      .from("invitaciones")
      .select("datos, estado")
      .eq("slug", slug)
      .single();
    if (!data || data.estado !== "publicada") return null;
    return data.datos as DatosInvitacion;
  } catch {
    return null;
  }
}

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const datos = await buscarPublicada(slug);

  // Tarjeta neutra para borradores y enlaces inexistentes: nunca filtra datos.
  const p = paleta(datos?.paleta);
  const titulo = datos?.titulo || "Invifty";
  const subtitulo = datos?.subtitulo || "Invitaciones digitales";
  const iniciales = (datos?.monograma?.trim() || inicialesDe(titulo)).slice(0, 7);
  const fecha = datos?.fechaEvento ? fechaSinDiaSemana(datos.fechaEvento) : "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: p.fondo,
          color: p.texto,
          position: "relative",
          // El hueco inferior reserva sitio para la firma: así un título de
          // dos líneas nunca la pisa.
          padding: "44px 0 116px",
        }}
      >
        {/* Marco doble, como el borde de una tarjeta impresa */}
        <div
          style={{
            position: "absolute",
            top: 32, left: 32, right: 32, bottom: 32,
            border: `2px solid ${p.acento}`,
            opacity: 0.5,
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 44, left: 44, right: 44, bottom: 44,
            border: `1px solid ${p.acento}`,
            opacity: 0.28,
            display: "flex",
          }}
        />

        {/* Monograma */}
        <div
          style={{
            width: 116,
            height: 116,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: `linear-gradient(135deg, ${p.acentoClaro}, ${p.acento})`,
            color: p.fondo,
            fontSize: 40,
            letterSpacing: 2,
            marginBottom: 34,
          }}
        >
          {iniciales}
        </div>

        {/* Antetítulo */}
        <div
          style={{
            display: "flex",
            fontSize: 22,
            letterSpacing: 12,
            textTransform: "uppercase",
            color: p.acento,
            marginBottom: 26,
          }}
        >
          {subtitulo.slice(0, 40)}
        </div>

        {/* Nombre del evento */}
        <div
          style={{
            display: "flex",
            fontSize: tamanoTitulo(titulo),
            lineHeight: 1.1,
            textAlign: "center",
            padding: "0 90px",
            color: p.texto,
          }}
        >
          {titulo.slice(0, 60)}
        </div>

        {/* Filete ornamental */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, margin: "34px 0" }}>
          <div style={{ width: 90, height: 1, backgroundColor: p.acento, opacity: 0.55, display: "flex" }} />
          <div
            style={{
              width: 9, height: 9,
              transform: "rotate(45deg)",
              backgroundColor: p.acento,
              display: "flex",
            }}
          />
          <div style={{ width: 90, height: 1, backgroundColor: p.acento, opacity: 0.55, display: "flex" }} />
        </div>

        {/* Fecha */}
        {fecha && (
          <div
            style={{
              display: "flex",
              fontSize: 27,
              letterSpacing: 7,
              textTransform: "uppercase",
              color: p.textoSuave,
            }}
          >
            {fecha}
          </div>
        )}

        {/* Firma */}
        <div
          style={{
            position: "absolute",
            bottom: 60,
            display: "flex",
            fontSize: 15,
            letterSpacing: 9,
            textTransform: "uppercase",
            color: p.textoSuave,
            opacity: 0.75,
          }}
        >
          Invifty
        </div>
      </div>
    ),
    size
  );
}
