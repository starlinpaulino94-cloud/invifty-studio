import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { cruzarLista, type InvitadoDeLista, type ConfirmacionCruzada } from "@/lib/lista";
import PanelInvitados from "@/components/lista/PanelInvitados";
import type { DatosInvitacion } from "@/lib/tipos";

/**
 * EL PANEL DEL ANFITRIÓN
 * =======================
 * Lo que el cliente que pagó la invitación quiere ver: quién viene, quién
 * no, y —lo que más pregunta— a quién le falta contestar.
 *
 * Entra con un enlace secreto, sin cuenta ni contraseña, igual que el
 * formulario en /f/<token>. El anfitrión no es usuario del sistema: es el
 * cliente, y pedirle que se registre para ver su propia boda sobraría.
 *
 * `noindex` y sin caché: es la lista de invitados de una persona.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tus confirmaciones — Invifty",
  description: "Quién ha confirmado su asistencia a tu evento.",
  robots: { index: false, follow: false },
};

export default async function PaginaLista({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = crearClienteAdmin();

  const { data: invitacion } = await supabase
    .from("invitaciones")
    .select("id, slug, datos, estado")
    .eq("token_lista", token)
    .maybeSingle();

  // Un token que no existe se trata como página inexistente, sin decir "ese
  // enlace no vale": no hay por qué confirmarle nada a quien esté probando.
  if (!invitacion) notFound();

  const [{ data: invitadosData }, { data: confirmacionesData }] = await Promise.all([
    supabase
      .from("invitados")
      .select("id, nombre, nombre_normalizado")
      .eq("invitacion_id", invitacion.id)
      .order("creado_en"),
    supabase
      .from("confirmaciones")
      .select("nombre, nombre_normalizado, asiste, cantidad, nota, creado_en")
      .eq("invitacion_id", invitacion.id)
      .order("creado_en", { ascending: false }),
  ]);

  const cruce = cruzarLista(
    (invitadosData ?? []) as InvitadoDeLista[],
    (confirmacionesData ?? []) as ConfirmacionCruzada[]
  );

  const datos = (invitacion.datos ?? {}) as DatosInvitacion;

  return (
    <PanelInvitados
      token={token}
      titulo={datos.titulo || "Tu evento"}
      fechaEvento={datos.fechaEvento ?? null}
      publicada={invitacion.estado === "publicada"}
      invitados={(invitadosData ?? []) as InvitadoDeLista[]}
      cruce={cruce}
    />
  );
}
