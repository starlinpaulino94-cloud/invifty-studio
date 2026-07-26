import { NextRequest, NextResponse } from "next/server";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { huellaDeVisita, horaTruncada, ipDeCabecera } from "@/lib/visitas";

/**
 * REGISTRO DE VISITA
 * ===================
 * La llama la propia invitación al abrirse. Se cuenta desde el navegador y
 * no al renderizar la página a propósito: así los rastreadores y las vistas
 * previas de enlaces —que piden el HTML pero no ejecutan JavaScript— no
 * inflan el número que se le enseña al cliente.
 *
 * No guarda IP ni cookies: solo una huella irreversible (ver lib/visitas.ts).
 * Nunca devuelve error al visitante: si algo falla, la invitación sigue
 * viéndose igual. Contar visitas no puede estropear la experiencia.
 *
 * SIN FRENO POR IP, A PROPÓSITO
 * ------------------------------
 * Las demás rutas públicas llevan un límite por IP (ver lib/limite.ts).
 * Esta no, y no es un olvido: en el salón del evento cien invitados abren
 * la invitación desde el mismo wifi, o sea desde la misma IP. Un freno ahí
 * dejaría sin contar justo el día que importa, y el número de visitas es lo
 * que se le enseña al cliente para que renueve.
 *
 * Lo que frena el abuso es el índice único (invitacion_id, huella, hora):
 * por mucho que alguien insista, de un dispositivo solo cabe una fila por
 * hora. La tabla no se puede inflar.
 */

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  try {
    const supabase = crearClienteAdmin();

    const { data: invitacion } = await supabase
      .from("invitaciones")
      .select("id, estado")
      .eq("slug", slug)
      .single();

    // Los borradores no cuentan: son las pruebas del propio equipo.
    if (!invitacion || invitacion.estado !== "publicada") {
      return NextResponse.json({ ok: true });
    }

    const ip = ipDeCabecera(
      req.headers.get("x-forwarded-for"),
      req.headers.get("x-real-ip")
    );
    const navegador = req.headers.get("user-agent") ?? "desconocido";

    await supabase.from("visitas").insert({
      invitacion_id: invitacion.id,
      huella: huellaDeVisita(invitacion.id, ip, navegador),
      hora: horaTruncada(new Date()),
    });
    // Si choca con el índice único es que ese dispositivo ya abrió la
    // invitación esta hora: no es un error, es justo lo que se busca.
  } catch {
    // Silencio deliberado: no vale la pena molestar al invitado por esto.
  }

  return NextResponse.json({ ok: true });
}
