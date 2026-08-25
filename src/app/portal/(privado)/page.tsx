import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { PLANES, nombreEstado, formatoFecha, TIPOS_EVENTO } from "@/lib/planes";
import type { Plan, TipoEvento, EstadoPedido } from "@/lib/tipos";
import { FileText, ExternalLink, Users, Eye } from "lucide-react";

export const dynamic = "force-dynamic";

interface FilaPedido {
  id: string;
  plan: string;
  tipo_evento: string;
  estado: string;
  fecha_evento: string | null;
  fecha_vencimiento: string | null;
  formularios: { token: string; estado: string }[];
  invitaciones: { slug: string; token_lista: string | null; estado: string }[];
}

/**
 * EL RESUMEN DEL CLIENTE — todo con la sesión del usuario, sin llave
 * administrativa: cada dato de esta página pasó por el RLS multicuenta.
 * Si el cliente ve algo aquí, es porque la base dijo que es suyo.
 */
export default async function PaginaPortal() {
  const supabase = await crearClienteServidor();

  const { data: cliente } = await supabase
    .from("clientes")
    .select("id, nombre")
    .maybeSingle();

  const { data: pedidos } = await supabase
    .from("pedidos")
    .select(
      "id, plan, tipo_evento, estado, fecha_evento, fecha_vencimiento, formularios(token, estado), invitaciones(slug, token_lista, estado)"
    )
    .order("creado_en", { ascending: false })
    .returns<FilaPedido[]>();

  const primerNombre = cliente?.nombre?.split(" ")[0] ?? "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-white text-xl font-semibold">
          {primerNombre ? `Hola, ${primerNombre}` : "Tu portal"}
        </h1>
        <p className="text-white/40 text-xs mt-1">
          Aquí está todo lo tuyo: tu invitación, tus invitados y tus enlaces.
        </p>
      </div>

      {!pedidos?.length ? (
        <div className="bg-white/5 border border-white/10 rounded-3xl p-8 text-center">
          <p className="text-white/60 text-sm">Todavía no hay pedidos en tu cuenta.</p>
          <p className="text-white/30 text-xs mt-2">Si esto no cuadra, escríbenos por WhatsApp.</p>
        </div>
      ) : (
        pedidos.map((pedido) => {
          const formulario = pedido.formularios?.[0];
          const invitacion = pedido.invitaciones?.[0];
          const formularioPendiente = formulario && formulario.estado !== "completado";
          return (
            <div key={pedido.id} className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-white text-sm font-semibold">
                    {TIPOS_EVENTO[pedido.tipo_evento as TipoEvento] ?? pedido.tipo_evento}
                    {pedido.fecha_evento ? (
                      <span className="text-white/40 font-normal"> · {formatoFecha(pedido.fecha_evento)}</span>
                    ) : null}
                  </p>
                  <p className="text-white/40 text-xs mt-0.5">
                    Plan {PLANES[pedido.plan as Plan]?.nombre ?? pedido.plan}
                    {pedido.fecha_vencimiento
                      ? ` · en línea hasta ${formatoFecha(pedido.fecha_vencimiento)}`
                      : ""}
                  </p>
                </div>
                <span className="text-[10px] uppercase tracking-[0.15em] text-[#D4AF37] border border-[#D4AF37]/40 rounded-full px-3 py-1 whitespace-nowrap">
                  {nombreEstado(pedido.estado as EstadoPedido)}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {formularioPendiente && (
                  <Enlace
                    href={`/f/${formulario.token}`}
                    Icono={FileText}
                    titulo="Completar el formulario"
                    detalle="Los datos de tu celebración"
                  />
                )}
                {invitacion?.slug && invitacion.estado === "publicada" && (
                  <Enlace
                    href={`/i/${invitacion.slug}`}
                    Icono={ExternalLink}
                    titulo="Ver mi invitación"
                    detalle="Como la ven tus invitados"
                  />
                )}
                {invitacion?.token_lista && (
                  <Enlace
                    href={`/lista/${invitacion.token_lista}`}
                    Icono={Users}
                    titulo="Mis invitados"
                    detalle="Lista, confirmaciones y recepción"
                  />
                )}
                {!formularioPendiente && !invitacion && (
                  <p className="text-white/40 text-xs col-span-full">
                    Tu invitación está en manos del equipo. Te avisamos por WhatsApp cuando haya
                    algo que revisar.
                  </p>
                )}
              </div>
            </div>
          );
        })
      )}

      <p className="text-white/25 text-[11px] text-center flex items-center justify-center gap-1.5">
        <Eye className="w-3 h-3" />
        Solo ves lo tuyo: cada dato de esta página pasa por los permisos de tu cuenta.
      </p>
    </div>
  );
}

function Enlace({
  href,
  Icono,
  titulo,
  detalle,
}: {
  href: string;
  Icono: typeof FileText;
  titulo: string;
  detalle: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 bg-black/30 border border-white/10 hover:border-[#D4AF37]/50 rounded-2xl px-4 py-3 transition-colors"
    >
      <Icono className="w-4 h-4 text-[#D4AF37] shrink-0" />
      <span>
        <span className="block text-white text-xs font-medium">{titulo}</span>
        <span className="block text-white/40 text-[11px]">{detalle}</span>
      </span>
    </Link>
  );
}
