import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { PLANES, TIPOS_EVENTO, formatoFecha, formatoDOP } from "@/lib/planes";
import { Cliente, Pedido, Plan, TipoEvento } from "@/lib/tipos";
import { ChipEstado } from "@/components/panel/Interactivos";
import { Users, ChevronDown, Phone } from "lucide-react";

export const dynamic = "force-dynamic";

const POR_PAGINA = 50;

export default async function PaginaClientes({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string }>;
}) {
  const { pagina } = await searchParams;
  const paginaActual = Math.max(1, Number(pagina) || 1);
  const desde = (paginaActual - 1) * POR_PAGINA;

  const supabase = await crearClienteServidor();
  // Paginado: con cientos de clientes, traerlos todos a memoria en cada
  // visita es la clase de coste que crece en silencio hasta que duele.
  const [{ data: clientesData, count }, { data: pedidosData }] = await Promise.all([
    supabase
      .from("clientes")
      .select("*", { count: "exact" })
      .order("creado_en", { ascending: false })
      .range(desde, desde + POR_PAGINA - 1),
    supabase.from("pedidos").select("*").order("creado_en", { ascending: false }),
  ]);

  const totalPaginas = Math.max(1, Math.ceil((count ?? 0) / POR_PAGINA));
  const clientes = (clientesData ?? []) as Cliente[];
  const pedidos = (pedidosData ?? []) as Pedido[];
  const pedidosDe = (clienteId: string) => pedidos.filter((p) => p.cliente_id === clienteId);

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="font-serif text-3xl text-gray-900 flex items-center gap-2">
          <Users className="w-6 h-6 text-[#D4AF37]" /> Clientes
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {count ?? clientes.length} cliente{(count ?? clientes.length) === 1 ? "" : "s"} registrados
        </p>
      </div>

      {clientes.length === 0 && (
        <div className="bg-white border border-dashed border-gray-200 rounded-2xl py-16 text-center text-sm text-gray-400">
          Todavía no hay clientes. Crea tu primer pedido para comenzar.
        </div>
      )}

      <div className="space-y-3">
        {clientes.map((cliente) => {
          const susPedidos = pedidosDe(cliente.id);
          const total = susPedidos.reduce((s, p) => s + Number(p.precio), 0);
          return (
            <details
              key={cliente.id}
              className="bg-white border border-gray-100 rounded-2xl shadow-sm group open:ring-1 open:ring-[#D4AF37]/40"
            >
              <summary className="flex items-center justify-between gap-4 p-5 cursor-pointer list-none">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{cliente.nombre}</p>
                  <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1">
                      <Phone className="w-3 h-3 text-[#D4AF37]" /> {cliente.telefono}
                    </span>
                    {cliente.como_nos_conocio && <span>· Vía {cliente.como_nos_conocio}</span>}
                    <span>· Registrado {formatoFecha(cliente.creado_en)}</span>
                  </p>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900">{susPedidos.length} pedido{susPedidos.length === 1 ? "" : "s"}</p>
                    <p className="text-xs text-gray-400">{formatoDOP(total)}</p>
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-300 group-open:rotate-180 transition-transform" />
                </div>
              </summary>

              <div className="border-t border-gray-100 px-5 py-3 divide-y divide-gray-50">
                {susPedidos.length === 0 && (
                  <p className="text-xs text-gray-400 py-3">Sin pedidos registrados.</p>
                )}
                {susPedidos.map((p) => (
                  <Link
                    key={p.id}
                    href={`/panel/pedidos/${p.id}`}
                    className="flex items-center justify-between gap-3 py-3 hover:bg-gray-50 -mx-2 px-2 rounded-lg transition-colors"
                  >
                    <div className="text-sm text-gray-800">
                      {TIPOS_EVENTO[p.tipo_evento as TipoEvento]} · Plan {PLANES[p.plan as Plan].nombre}
                      <span className="text-gray-400 text-xs ml-2">
                        {p.fecha_evento ? formatoFecha(p.fecha_evento) : "sin fecha"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs font-semibold text-gray-600">{formatoDOP(p.precio)}</span>
                      <ChipEstado estado={p.estado} />
                    </div>
                  </Link>
                ))}
              </div>
            </details>
          );
        })}
      </div>

      {totalPaginas > 1 && (
        <div className="flex items-center justify-center gap-3 text-xs text-gray-500">
          {paginaActual > 1 && (
            <Link href={`/panel/clientes?pagina=${paginaActual - 1}`} className="hover:text-gray-900 font-medium">
              ← Anteriores
            </Link>
          )}
          <span>Página {paginaActual} de {totalPaginas}</span>
          {paginaActual < totalPaginas && (
            <Link href={`/panel/clientes?pagina=${paginaActual + 1}`} className="hover:text-gray-900 font-medium">
              Siguientes →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
