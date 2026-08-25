import { notFound } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { tienePermiso } from "@/lib/cuentas";
import DetallePedido, {
  type PedidoDelPortal,
  type RevisionDelPortal,
} from "@/components/portal/DetallePedido";

export const dynamic = "force-dynamic";

/**
 * EL DETALLE DEL PEDIDO EN EL PORTAL — todo con la sesión del cliente.
 * Ni una consulta con llave administrativa: si el RLS multicuenta no
 * reconoce este pedido como suyo, la página es un 404 y punto. Eso es a
 * propósito: la pantalla ejercita las políticas en cada visita.
 */
export default async function PaginaDetallePedido({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await crearClienteServidor();

  // El permiso del miembro firmado decide si la sección de pagos existe.
  // El RLS lo exige igual en la base; esto evita enseñar cifras vacías.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: miembro } = await supabase
    .from("miembros_cuenta")
    .select("rol, permisos")
    .eq("usuario_id", user?.id ?? "")
    .maybeSingle();
  const verPagos = miembro ? tienePermiso(miembro, "ver_pagos") : false;

  const { data } = await supabase
    .from("pedidos")
    .select(
      "id, plan, tipo_evento, estado, precio, fecha_evento, fecha_entrega, fecha_vencimiento, capacidades_contratadas, formularios(token, estado), invitaciones(id, slug, token_lista, estado), pagos(id, monto, tipo, metodo, fecha, fecha_efectiva, anulado_en)"
    )
    .eq("id", id)
    .maybeSingle();

  const pedido = data as PedidoDelPortal | null;
  if (!pedido) notFound();

  const invitacion = pedido.invitaciones?.[0];

  const { data: confirmaciones } = invitacion
    ? await supabase
        .from("confirmaciones")
        .select("asiste, cantidad")
        .eq("invitacion_id", invitacion.id)
    : { data: null };

  const { data: revisiones } = invitacion
    ? await supabase
        .from("revisiones")
        .select("token, estado, expira_en, revocada_en")
        .eq("invitacion_id", invitacion.id)
        .order("creado_en", { ascending: false })
        .limit(1)
    : { data: null };

  return (
    <DetallePedido
      pedido={pedido}
      confirmaciones={confirmaciones ?? []}
      revision={(revisiones?.[0] as RevisionDelPortal | undefined) ?? null}
      ahora={new Date()}
      verPagos={verPagos}
    />
  );
}
