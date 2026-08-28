import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { ESTADOS, PLANES, TIPOS_EVENTO, formatoFecha, formatoDOP } from "@/lib/planes";
import { desglosePagos } from "@/lib/pagos";
import { EstadoPedido, Pago, PedidoConCliente, Plan, TipoEvento } from "@/lib/tipos";
import { AlertTriangle, ClipboardCheck, PlusCircle, CalendarDays } from "lucide-react";
import {
  TiraDeTareas, AlertaRevisiones, type TareaDeHoy,
} from "@/components/panel/HoyTeToca";
import ActividadPortal from "@/components/panel/ActividadPortal";
import { ACCIONES_PORTAL, type FilaActividad } from "@/lib/portal";

export const dynamic = "force-dynamic";

/**
 * Hasta dónde carga el tablero. Los pedidos ACTIVOS de un estudio caben
 * de sobra; lo que crece sin tope son los terminados (vencida, cancelado)
 * de años anteriores, y esos no necesitan estar todos en el kanban.
 */
const TOPE_TABLERO = 400;

export default async function Tablero() {
  const supabase = await crearClienteServidor();

  /**
   * LO QUE TE TOCA HOY se pregunta en paralelo con el kanban. Cada
   * consulta extra es un conteo o una lista corta, y cada una falla SOLA
   * si su migración no corrió (data null → tarjeta oculta): el tablero
   * clásico nunca se cae por una función nueva.
   */
  const [
    { data, count },
    { count: leadsNuevos },
    { data: cambiosData },
    { data: aprobadasData },
    { count: avisosFallidos },
    { data: pagosData },
    { data: actividadData },
    { count: pagosReportados },
  ] = await Promise.all([
    supabase
      .from("pedidos")
      .select("*, clientes(*)", { count: "exact" })
      .order("creado_en", { ascending: false })
      .limit(TOPE_TABLERO),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("estado", "nuevo"),
    // Clientes que pidieron cambios: la pelota está en nuestro tejado.
    supabase
      .from("revisiones")
      .select("invitacion_id, invitaciones(pedidos(clientes(nombre)))")
      .eq("estado", "cambios_solicitados")
      .is("revocada_en", null)
      .order("actualizado_en", { ascending: false })
      .limit(20),
    // Aprobadas (bloqueadas) que siguen en borrador: falta el último paso.
    supabase
      .from("invitaciones")
      .select("id, pedidos(clientes(nombre))")
      .not("bloqueada_en", "is", null)
      .eq("estado", "borrador")
      .limit(20),
    supabase.from("avisos").select("id", { count: "exact", head: true }).eq("estado", "fallido"),
    supabase
      .from("pagos")
      .select("pedido_id, monto, tipo, anulado_en")
      .order("fecha", { ascending: false })
      .limit(5000),
    // Lo que los clientes hicieron solos en su portal. La lista de
    // acciones viene de lib/portal.ts: una acción nueva se agrega allí.
    supabase
      .from("auditoria")
      .select("accion, usuario_email, creado_en")
      .in("accion", Object.keys(ACCIONES_PORTAL))
      .order("creado_en", { ascending: false })
      .limit(8),
    // Dinero que el cliente dice haber transferido, esperando revisión.
    supabase
      .from("pagos_reportados")
      .select("id", { count: "exact", head: true })
      .eq("estado", "pendiente"),
  ]);

  const pedidos = (data ?? []) as PedidoConCliente[];
  const totalPedidos = count ?? pedidos.length;
  const hayMas = totalPedidos > pedidos.length;

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

  /* ---------- Los números de "hoy te toca" ---------- */

  // Cobros pendientes: pedidos vivos (ni cancelados ni vencidos) que aún
  // deben dinero, con el saldo total. El mismo desglose de la ficha.
  const pagosPorPedido = new Map<string, Pick<Pago, "monto" | "tipo" | "anulado_en">[]>();
  for (const pago of (pagosData ?? []) as Pago[]) {
    const lista = pagosPorPedido.get(pago.pedido_id) ?? [];
    lista.push(pago);
    pagosPorPedido.set(pago.pedido_id, lista);
  }
  let porCobrar = 0;
  let pedidosConDeuda = 0;
  for (const pedido of pedidos) {
    if (["cancelado", "vencida"].includes(pedido.estado)) continue;
    const saldo = Number(pedido.precio) - desglosePagos(pagosPorPedido.get(pedido.id) ?? []).neto;
    if (saldo > 0.01) {
      porCobrar += saldo;
      pedidosConDeuda++;
    }
  }

  // Vencen en 30 días: el momento de vender la renovación.
  const en30dias = new Date(hoy);
  en30dias.setDate(en30dias.getDate() + 30);
  const porVencer = pedidos.filter((p) => {
    if (!p.fecha_vencimiento || !["entregada", "activa"].includes(p.estado)) return false;
    const fecha = new Date(p.fecha_vencimiento + "T12:00:00");
    return fecha >= hoy && fecha <= en30dias;
  }).length;

  // Nombre del cliente detrás de cada revisión/invitación pendiente.
  type ConCliente = { pedidos: { clientes: { nombre: string } | null } | null };
  const nombreDe = (fila: ConCliente | null | undefined) =>
    fila?.pedidos?.clientes?.nombre ?? "Cliente";

  const cambiosSolicitados = ((cambiosData ?? []) as unknown as ({
    invitacion_id: string;
    invitaciones: ConCliente | null;
  })[]).map((r) => ({ id: r.invitacion_id, nombre: nombreDe(r.invitaciones) }));

  const aprobadasSinPublicar = ((aprobadasData ?? []) as unknown as ({
    id: string;
  } & ConCliente)[]).map((i) => ({ id: i.id, nombre: nombreDe(i) }));

  // La tira de "hoy te toca": solo tarjetas con destino real, y solo si
  // hay algo. Un cero no es una tarea. El dibujo vive en HoyTeToca.tsx.
  const tareas: TareaDeHoy[] = [
    {
      // El dinero primero: un reporte sin revisar es un cliente esperando.
      cuenta: pagosReportados ?? 0,
      etiqueta: "pagos reportados por confirmar (en la ficha de cada pedido)",
      href: null,
      icono: "cobrar",
      tono: "text-emerald-700 bg-emerald-50 border-emerald-200",
    },
    {
      cuenta: leadsNuevos ?? 0,
      etiqueta: "leads nuevos sin contactar",
      href: "/panel/leads",
      icono: "leads",
      tono: "text-blue-700 bg-blue-50 border-blue-200",
    },
    {
      cuenta: pedidosConDeuda,
      etiqueta: `por cobrar (${formatoDOP(porCobrar)})`,
      href: "/panel/metricas",
      icono: "cobrar",
      tono: "text-gray-700 bg-gray-50 border-gray-200",
    },
    {
      cuenta: porVencer,
      etiqueta: "vencen en 30 días",
      href: "/panel/vencimientos",
      icono: "vencer",
      tono: "text-orange-700 bg-orange-50 border-orange-200",
    },
    {
      // Sin página propia todavía: la tarjeta informa (el detalle está en
      // la tabla `avisos` y el log), no manda a un callejón.
      cuenta: avisosFallidos ?? 0,
      etiqueta: "avisos por email fallidos — revisa Resend",
      href: null,
      icono: "avisos",
      tono: "text-red-700 bg-red-50 border-red-200",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-3xl text-gray-900">Tablero</h1>
          <p className="text-sm text-gray-500 mt-1">
            {totalPedidos} pedido{totalPedidos === 1 ? "" : "s"} en total
            {hayMas && ` · el tablero enseña los ${pedidos.length} más recientes`}
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

      {/* Hoy te toca: solo aparece lo que necesita acción */}
      <TiraDeTareas tareas={tareas} />

      {/* Lo que los clientes hicieron solos en su portal */}
      <ActividadPortal filas={(actividadData ?? []) as FilaActividad[]} ahora={hoy} />

      {/* Alertas */}
      {(eventosProximos.length > 0 ||
        pendientesDiseno.length > 0 ||
        cambiosSolicitados.length > 0 ||
        aprobadasSinPublicar.length > 0) && (
        <div className="grid sm:grid-cols-2 gap-3">
          <AlertaRevisiones variante="cambios" invitaciones={cambiosSolicitados} />
          <AlertaRevisiones variante="publicar" invitaciones={aprobadasSinPublicar} />
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
