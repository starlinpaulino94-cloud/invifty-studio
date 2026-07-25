import Asistente from "@/components/formulario/Asistente";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tu invitación — Invifty",
  description: "Completa los datos de tu evento para crear tu invitación digital.",
  robots: { index: false, follow: false },
};

export default async function PaginaFormulario({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <Asistente token={token} />;
}
