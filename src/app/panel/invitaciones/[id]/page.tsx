import Link from "next/link";
import { notFound } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import EditorInvitacion from "@/components/panel/EditorInvitacion";
import { PLANES, TIPOS_EVENTO } from "@/lib/planes";
import { Cliente, DatosInvitacion, Invitacion, Pedido, Plan, TipoEvento } from "@/lib/tipos";
import { urlBase as resolverUrlBase } from "@/lib/url";
import { ArrowLeft, Link2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PaginaEditorInvitacion({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .from("invitaciones")
    .select("*, pedidos(*, clientes(*))")
    .eq("id", id)
    .single();

  if (!data) notFound();

  const invitacion = data as Invitacion & { pedidos: Pedido & { clientes: Cliente } };
  const pedido = invitacion.pedidos;
  const urlBase = resolverUrlBase();
  const urlPublica = `${urlBase}/i/${invitacion.slug}`;

  return (
    <div className="space-y-6 max-w-3xl">
      <Link
        href={`/panel/pedidos/${pedido.id}`}
        className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 font-medium"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Volver a la ficha del pedido
      </Link>

      <div>
        <h1 className="font-serif text-3xl text-gray-900">Editor de invitación</h1>
        <p className="text-sm text-gray-500 mt-1">
          {pedido.clientes.nombre} · {TIPOS_EVENTO[pedido.tipo_evento as TipoEvento]} · Plan{" "}
          {PLANES[pedido.plan as Plan].nombre}
        </p>
        {invitacion.estado === "publicada" && (
          <a
            href={urlPublica}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-[#B08D2A] hover:underline mt-2 break-all"
          >
            <Link2 className="w-3.5 h-3.5" /> {urlPublica}
          </a>
        )}
      </div>

      <EditorInvitacion
        invitacionId={invitacion.id}
        slugInicial={invitacion.slug}
        plantillaInicial={invitacion.plantilla}
        datosIniciales={invitacion.datos as DatosInvitacion}
        estado={invitacion.estado}
        urlPublica={urlPublica}
      />
    </div>
  );
}
