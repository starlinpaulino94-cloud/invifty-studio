import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { ESTADOS, PLANES, TIPOS_EVENTO, formatoFecha, formatoDOP } from "@/lib/planes";
import { EstadoPedido, PedidoConCliente, Plan, TipoEvento } from "@/lib/tipos";
import { AlertTriangle, ClipboardCheck, PlusCircle, CalendarDays } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function Tablero() {
  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .from("pedidos")
    .select("*, clientes(*)")
    .order("creado_en", { ascending: false });

  const pedidos = (data ?? []) as PedidoConCliente[];

  // Alertas
  const hoy = new Date();
  const en7dias = new Date(hoy);
  en7dias.setDate(en7dias.getDate() + 7);

  const eventosProximos = pedidos.filter((p) => {
    if (!p.fecha_evento) return false;
    if (["entregada", "activa", "vencida"].includes(p.estado)) return false;
    const fecha = new Date(p.fecha_evento + "T12:00:00");
    return fecha >= hoy && fecha <= en7dias;
  });

  const pendientesDiseno = pedidos.filter((p) => p.estado === "formulario_completado");

  const porEstado = (estado: EstadoPedido) => pedidos.filter((p) => p.estado === estado);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-3xl text-gray-900">Tablero</h1>
          <p className="text-sm text-gray-500 mt-1">
            {pedidos.length} pedido{pedidos.length === 1 ? "" : "s"} en total
          </p>
        </div>
        <Link
          href="/panel/pedidos/nuevo"
          className="inline-flex items-center gap-2 bg-[#0D0D0F] text-white text-sm font-semibold px-5 py-3 rounded-xl hover:bg-black transition-colors active:scale-95"
        >
          <PlusCircle className="w-4 h-4 text-[#D4AF37]" />
          Crear pedido
        </Link>
      </div>

      {/* Alertas */}
      {(eventosProximos.length > 0 || pendientesDiseno.length > 0) && (
        <div className="grid sm:grid-cols-2 gap-3">
          {eventosProximos.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <div className="flex items-center gap-2 text-amber-800 font-semibold text-sm mb-2">
                <AlertTriangle className="w-4 h-4" />
                Eventos en menos de 7 días
              </div>
              <ul className="space-y-1.5">
                {eventosProximos.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/panel/pedidos/${p.id}`}
                      className="text-sm text-amber-900 hover:underline flex justify-between gap-2"
                    >
                      <span>{p.clientes.nombre} · {TIPOS_EVENTO[p.tipo_evento as TipoEvento]}</span>
                      <span className="font-semibold shrink-0">{formatoFecha(p.fecha_evento)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {pendientesDiseno.length > 0 && (
            <div className="bg-violet-50 border border-violet-200 rounded-2xl p-4">
              <div className="flex items-center gap-2 text-violet-800 font-semibold text-sm mb-2">
                <ClipboardCheck className="w-4 h-4" />
                Formularios completados, listos para diseño
              </div>
              <ul className="space-y-1.5">
                {pendientesDiseno.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/panel/pedidos/${p.id}`}
                      className="text-sm text-violet-900 hover:underline flex justify-between gap-2"
                    >
                      <span>{p.clientes.nombre} · Plan {PLANES[p.plan as Plan].nombre}</span>
                      <span className="font-semibold shrink-0">
                        {p.fecha_evento ? formatoFecha(p.fecha_evento) : "sin fecha"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Pipeline */}
      <div className="overflow-x-auto pb-4 -mx-5 px-5">
        <div className="flex gap-4 min-w-max">
          {ESTADOS.map((estado) => {
            const lista = porEstado(estado.id);
            return (
              <div key={estado.id} className="w-64 shrink-0">
                <div className="flex items-center justify-between mb-3 px-1">
                  <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${estado.color}`}>
                    {estado.nombre}
                  </span>
                  <span className="text-xs text-gray-400 font-medium">{lista.length}</span>
                </div>

                <div className="space-y-2.5">
                  {lista.length === 0 && (
                    <div className="border border-dashed border-gray-200 rounded-xl py-6 text-center text-xs text-gray-300">
                      Vacío
                    </div>
                  )}
                  {lista.map((p) => (
                    <Link
                      key={p.id}
                      href={`/panel/pedidos/${p.id}`}
                      className="block bg-white border border-gray-100 rounded-xl p-4 shadow-sm hover:shadow-md hover:border-[#D4AF37]/50 transition-all"
                    >
                      <p className="font-semibold text-sm text-gray-900 truncate">
                        {p.clientes.nombre}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {TIPOS_EVENTO[p.tipo_evento as TipoEvento]} · Plan {PLANES[p.plan as Plan].nombre}
                      </p>
                      <div className="flex items-center justify-between mt-3 text-[11px] text-gray-400">
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="w-3 h-3" />
                          {p.fecha_evento ? formatoFecha(p.fecha_evento) : "Sin fecha"}
                        </span>
                        <span className="font-semibold text-gray-600">{formatoDOP(p.precio)}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
