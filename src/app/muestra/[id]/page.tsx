import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import Renderizador from "@/components/invitacion/Renderizador";
import { datosMuestra, fotosMuestra } from "@/config/muestra";
import { PLANTILLAS } from "@/config/plantillas";
import { urlFuentes } from "@/config/diseno";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Muestra de plantilla — Invifty Studio",
  robots: { index: false, follow: false },
};

/**
 * Muestra en vivo de una plantilla con datos de ejemplo.
 * Vive fuera del marco del panel para verse a pantalla completa,
 * pero sigue siendo privada: requiere sesión del equipo.
 */
export default async function MuestraPlantilla({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!PLANTILLAS.some((p) => p.id === id)) notFound();

  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const datos = datosMuestra(id);

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="stylesheet" href={urlFuentes(datos.tipografia)} />
      <Renderizador plantilla={id} datos={datos} fotos={fotosMuestra(id)} />
    </>
  );
}
