import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { PLANES, TIPOS_EVENTO, formatoFecha } from "@/lib/planes";
import { PedidoConCliente, Plan, TipoEvento } from "@/lib/tipos";
import { CalendarClock, ExternalLink } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PaginaVencimientos() {
  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .from("pedidos")
    .select("*, clientes(*)")
    .not("fecha_vencimiento", "is", null)
    .order("fecha_vencimiento", { ascending: true });

  const pedidos = (data ?? []) as PedidoConCliente[];
  const hoy = new Date();
  const en30dias = new Date(hoy);
  en30dias.setDate(en30dias.getDate() + 30);

  const clasificar = (fecha: string) => {
    const f = new Date(fecha + "T12:00:00");
    if (f < hoy) return { texto: "Vencida", clase: "bg-red-100 text-red-600" };
    if (f <= en30dias) return { texto: "Vence pronto", clase: "bg-amber-100 text-amber-700" };
    return { texto: "Activa", clase: "bg-emerald-100 text-emerald-700" };
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="font-serif text-3xl text-gray-900 flex items-center gap-2">
          <CalendarClock className="w-6 h-6 text-[#D4AF37]" /> Vencimientos
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Invitaciones entregadas con su fecha de vencimiento — el momento ideal para
          ofrecer la renovación es 2-4 semanas antes.
        </p>
      </div>

      {pedidos.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-200 rounded-2xl py-16 text-center text-sm text-gray-400">
          Aún no hay invitaciones entregadas con vencimiento.
        </div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm divide-y divide-gray-50">
          {pedidos.map((p) => {
            const etiqueta = clasificar(p.fecha_vencimiento!);
            return (
              <div key={p.id} className="flex items-center justify-between gap-4 p-5 flex-wrap">
                <div className="min-w-0">
                  <Link
                    href={`/panel/pedidos/${p.id}`}
                    className="font-semibold text-gray-900 hover:underline"
                  >
                    {p.clientes.nombre}
                  </Link>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {TIPOS_EVENTO[p.tipo_evento as TipoEvento]} · Plan {PLANES[p.plan as Plan].nombre}
                    {p.url_entregada && (
                      <a
                        href={p.url_entregada}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-2 text-[#B08D2A] hover:underline inline-flex items-center gap-0.5"
                      >
                        Ver invitación <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900">{formatoFecha(p.fecha_vencimiento)}</p>
                    <p className="text-[11px] text-gray-400">Entregada {formatoFecha(p.fecha_entrega)}</p>
                  </div>
                  <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${etiqueta.clase}`}>
                    {etiqueta.texto}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
