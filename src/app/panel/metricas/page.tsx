import { crearClienteServidor } from "@/lib/supabase/servidor";
import { PLANES, EXTRAS, TIPOS_EVENTO, formatoDOP } from "@/lib/planes";
import { Pago, Pedido, Plan, TipoEvento } from "@/lib/tipos";
import { BarChart3, TrendingUp, Package, PartyPopper } from "lucide-react";

export const dynamic = "force-dynamic";

function BarraHorizontal({ etiqueta, valor, maximo, sufijo = "" }: {
  etiqueta: string; valor: number; maximo: number; sufijo?: string;
}) {
  const pct = maximo > 0 ? Math.round((valor / maximo) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-600 font-medium">{etiqueta}</span>
        <span className="text-gray-900 font-bold">{valor}{sufijo}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-[#D4AF37] to-[#F2D06B] rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default async function PaginaMetricas() {
  const supabase = await crearClienteServidor();
  const [{ data: pedidosData }, { data: pagosData }] = await Promise.all([
    supabase.from("pedidos").select("*"),
    supabase.from("pagos").select("*"),
  ]);

  const pedidos = (pedidosData ?? []) as Pedido[];
  const pagos = (pagosData ?? []) as Pago[];

  const ahora = new Date();
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);

  const pedidosMes = pedidos.filter((p) => new Date(p.creado_en) >= inicioMes);
  const ingresosMes = pagos
    .filter((p) => new Date(p.fecha) >= inicioMes)
    .reduce((s, p) => s + Number(p.monto), 0);
  const ventasMes = pedidosMes.reduce((s, p) => s + Number(p.precio), 0);

  // Distribuciones (histórico completo)
  const porPlan = (Object.keys(PLANES) as Plan[]).map((plan) => ({
    plan,
    cantidad: pedidos.filter((p) => p.plan === plan).length,
  }));
  const porEvento = (Object.keys(TIPOS_EVENTO) as TipoEvento[]).map((tipo) => ({
    tipo,
    cantidad: pedidos.filter((p) => p.tipo_evento === tipo).length,
  }));
  const porExtra = EXTRAS.map((extra) => ({
    extra,
    cantidad: pedidos.filter((p) => p.extras.includes(extra.id)).length,
  })).sort((a, b) => b.cantidad - a.cantidad);

  const maxPlan = Math.max(...porPlan.map((x) => x.cantidad), 1);
  const maxEvento = Math.max(...porEvento.map((x) => x.cantidad), 1);
  const maxExtra = Math.max(...porExtra.map((x) => x.cantidad), 1);

  const nombreMes = ahora.toLocaleDateString("es-DO", { month: "long", year: "numeric" });

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="font-serif text-3xl text-gray-900 flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-[#D4AF37]" /> Métricas
        </h1>
        <p className="text-sm text-gray-500 mt-1 capitalize">{nombreMes}</p>
      </div>

      {/* Tarjetas del mes */}
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="bg-[#0D0D0F] text-white rounded-2xl p-6">
          <PartyPopper className="w-5 h-5 text-[#D4AF37] mb-3" />
          <p className="text-3xl font-serif">{pedidosMes.length}</p>
          <p className="text-xs text-white/50 mt-1">Pedidos este mes</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
          <TrendingUp className="w-5 h-5 text-[#D4AF37] mb-3" />
          <p className="text-3xl font-serif text-gray-900">{formatoDOP(ingresosMes)}</p>
          <p className="text-xs text-gray-400 mt-1">Cobrado este mes (abonos)</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
          <Package className="w-5 h-5 text-[#D4AF37] mb-3" />
          <p className="text-3xl font-serif text-gray-900">{formatoDOP(ventasMes)}</p>
          <p className="text-xs text-gray-400 mt-1">Vendido este mes (precios acordados)</p>
        </div>
      </div>

      {/* Distribuciones */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-4">
          <h2 className="font-serif text-lg text-gray-900">Por plan</h2>
          {porPlan.map(({ plan, cantidad }) => (
            <BarraHorizontal
              key={plan}
              etiqueta={PLANES[plan].nombre}
              valor={cantidad}
              maximo={maxPlan}
            />
          ))}
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-4">
          <h2 className="font-serif text-lg text-gray-900">Por tipo de evento</h2>
          {porEvento.map(({ tipo, cantidad }) => (
            <BarraHorizontal
              key={tipo}
              etiqueta={TIPOS_EVENTO[tipo]}
              valor={cantidad}
              maximo={maxEvento}
            />
          ))}
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-4">
        <h2 className="font-serif text-lg text-gray-900">Extras más vendidos</h2>
        {porExtra.every((x) => x.cantidad === 0) ? (
          <p className="text-sm text-gray-400">Todavía no se han vendido extras.</p>
        ) : (
          porExtra.map(({ extra, cantidad }) => (
            <BarraHorizontal
              key={extra.id}
              etiqueta={extra.nombre}
              valor={cantidad}
              maximo={maxExtra}
            />
          ))
        )}
      </div>
    </div>
  );
}
