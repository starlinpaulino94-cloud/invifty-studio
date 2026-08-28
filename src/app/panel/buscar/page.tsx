import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import {
  consultaValida,
  digitosDeTelefono,
  patronBusqueda,
  tipoDeConsulta,
} from "@/lib/buscar";
import { PLANES, TIPOS_EVENTO, formatoDOP, formatoFecha } from "@/lib/planes";
import { ChipEstado } from "@/components/panel/Interactivos";
import type { EstadoPedido, Plan, TipoEvento } from "@/lib/tipos";
import { Search, User, FileText, Link2 } from "lucide-react";

export const dynamic = "force-dynamic";

interface PedidoEncontrado {
  id: string;
  tipo_evento: string;
  plan: string;
  estado: string;
  precio: number;
  fecha_evento: string | null;
  clientes: { nombre: string } | null;
}

/**
 * EL BUSCADOR GLOBAL — /panel/buscar?q=...
 * =========================================
 * Acepta lo que el equipo tenga a mano: un nombre, un teléfono con o sin
 * guiones, un slug, o un token pegado de cualquier enlace. La lógica
 * pura decide qué es (lib/buscar.ts) y aquí solo se pregunta donde tiene
 * sentido. Todas las consultas van con la sesión del equipo: el RLS es
 * el que decide qué se ve.
 */
export default async function PaginaBuscar({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const consulta = (q ?? "").trim();
  const supabase = await crearClienteServidor();

  let clientes: { id: string; nombre: string; telefono: string }[] = [];
  let pedidos: PedidoEncontrado[] = [];
  let invitaciones: { id: string; slug: string; estado: string; pedido_id: string }[] = [];
  let notaToken: string | null = null;

  if (consultaValida(consulta)) {
    const tipo = tipoDeConsulta(consulta);

    if (tipo === "token") {
      // Un token pegado de un enlace: se mira en cada cerradura que abre.
      const [formulario, lista, cobro] = await Promise.all([
        supabase.from("formularios").select("pedido_id").eq("token", consulta).maybeSingle(),
        supabase
          .from("invitaciones")
          .select("id, slug, estado, pedido_id")
          .eq("token_lista", consulta)
          .maybeSingle(),
        supabase.from("pedidos").select("id").eq("token_cobro", consulta).maybeSingle(),
      ]);
      const pedidoId = formulario.data?.pedido_id ?? lista.data?.pedido_id ?? cobro.data?.id;
      if (pedidoId) {
        const { data } = await supabase
          .from("pedidos")
          .select("id, tipo_evento, plan, estado, precio, fecha_evento, clientes(nombre)")
          .eq("id", pedidoId)
          .maybeSingle();
        if (data) pedidos = [data as unknown as PedidoEncontrado];
        notaToken = formulario.data
          ? "El token es de un formulario (/f)."
          : lista.data
            ? "El token es del panel del anfitrión (/lista)."
            : "El token es de un enlace de cobro (/pagar).";
      }
    } else if (tipo === "telefono") {
      const { data } = await supabase
        .from("clientes")
        .select("id, nombre, telefono")
        .like("telefono", `%${digitosDeTelefono(consulta)}%`)
        .limit(10);
      clientes = data ?? [];
    } else {
      const patron = patronBusqueda(consulta);
      const [clientesRes, invitacionesRes] = await Promise.all([
        supabase.from("clientes").select("id, nombre, telefono").ilike("nombre", patron).limit(10),
        supabase
          .from("invitaciones")
          .select("id, slug, estado, pedido_id")
          .ilike("slug", patron)
          .limit(10),
      ]);
      clientes = clientesRes.data ?? [];
      invitaciones = invitacionesRes.data ?? [];
    }

    // Los pedidos de los clientes encontrados, para llegar en un clic.
    if (clientes.length > 0 && pedidos.length === 0) {
      const { data } = await supabase
        .from("pedidos")
        .select("id, tipo_evento, plan, estado, precio, fecha_evento, clientes(nombre)")
        .in("cliente_id", clientes.map((c) => c.id))
        .order("creado_en", { ascending: false })
        .limit(20);
      pedidos = (data ?? []) as unknown as PedidoEncontrado[];
    }
  }

  const sinResultados =
    consultaValida(consulta) && !clientes.length && !pedidos.length && !invitaciones.length;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="font-serif text-3xl text-gray-900 flex items-center gap-2">
          <Search className="w-6 h-6 text-[#D4AF37]" /> Buscar
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Nombre, teléfono, slug de invitación o un token pegado de cualquier enlace.
        </p>
      </div>

      <form action="/panel/buscar" className="flex gap-2">
        <input
          name="q"
          defaultValue={consulta}
          autoFocus
          placeholder="Ej.: Camila / 8091234567 / camila-y-lucas / a1b2c3…"
          className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#D4AF37] bg-white"
        />
        <button
          type="submit"
          className="bg-[#0D0D0F] text-white text-sm font-semibold px-5 rounded-xl hover:bg-black"
        >
          Buscar
        </button>
      </form>

      {notaToken && <p className="text-xs text-gray-500">{notaToken}</p>}

      {sinResultados && (
        <div className="bg-white border border-dashed border-gray-200 rounded-2xl py-12 text-center text-sm text-gray-400">
          Nada con “{consulta}”. Prueba con menos letras o con el teléfono.
        </div>
      )}

      {clientes.length > 0 && (
        <section>
          <h2 className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-2 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5" /> Clientes
          </h2>
          <div className="space-y-2">
            {clientes.map((c) => (
              <div key={c.id} className="bg-white border border-gray-100 rounded-xl px-4 py-3 text-sm flex justify-between gap-3">
                <span className="font-semibold text-gray-900">{c.nombre}</span>
                <span className="text-gray-400 text-xs">{c.telefono}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {pedidos.length > 0 && (
        <section>
          <h2 className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-2 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" /> Pedidos
          </h2>
          <div className="space-y-2">
            {pedidos.map((p) => (
              <Link
                key={p.id}
                href={`/panel/pedidos/${p.id}`}
                className="flex items-center justify-between gap-3 bg-white border border-gray-100 rounded-xl px-4 py-3 hover:border-[#D4AF37]/50 transition-colors"
              >
                <div className="text-sm text-gray-800 min-w-0">
                  <span className="font-semibold">{p.clientes?.nombre ?? "Cliente"}</span>
                  <span className="text-gray-400 text-xs ml-2">
                    {TIPOS_EVENTO[p.tipo_evento as TipoEvento]} · {PLANES[p.plan as Plan]?.nombre}
                    {p.fecha_evento ? ` · ${formatoFecha(p.fecha_evento)}` : ""}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs font-semibold text-gray-600">{formatoDOP(p.precio)}</span>
                  <ChipEstado estado={p.estado as EstadoPedido} />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {invitaciones.length > 0 && (
        <section>
          <h2 className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-2 flex items-center gap-1.5">
            <Link2 className="w-3.5 h-3.5" /> Invitaciones
          </h2>
          <div className="space-y-2">
            {invitaciones.map((i) => (
              <Link
                key={i.id}
                href={`/panel/pedidos/${i.pedido_id}`}
                className="flex items-center justify-between gap-3 bg-white border border-gray-100 rounded-xl px-4 py-3 hover:border-[#D4AF37]/50 transition-colors text-sm"
              >
                <span className="text-gray-800">/i/{i.slug}</span>
                <span className="text-xs text-gray-400">
                  {i.estado === "publicada" ? "publicada" : "borrador"}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
