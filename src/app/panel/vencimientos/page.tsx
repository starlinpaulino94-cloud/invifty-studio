import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { PLANES, TIPOS_EVENTO, formatoFecha, mensajeWhatsAppRenovacion } from "@/lib/planes";
import type { PedidoConCliente, Plan, TipoEvento } from "@/lib/tipos";
import {
  estadoVigencia, textoVigencia, DIAS_DE_AVISO, type EstadoVigencia,
} from "@/lib/vencimientos";
import { BotonCopiar } from "@/components/panel/Interactivos";
import { CalendarClock, ExternalLink, Wrench } from "lucide-react";

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

  const ETIQUETAS: Record<EstadoVigencia, { texto: string; clase: string }> = {
    vencida: { texto: "Vencida", clase: "bg-red-100 text-red-600" },
    por_vencer: { texto: "Vence pronto", clase: "bg-amber-100 text-amber-700" },
    vigente: { texto: "Activa", clase: "bg-emerald-100 text-emerald-700" },
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="font-serif text-3xl text-gray-900 flex items-center gap-2">
          <CalendarClock className="w-6 h-6 text-[#D4AF37]" /> Vencimientos
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Invitaciones entregadas con su fecha de vencimiento. El sistema avisa por
          correo {DIAS_DE_AVISO} días antes; aquí puedes copiar el mensaje de
          renovación ya escrito para mandárselo al cliente.
        </p>
        <Link
          href="/panel/mantenimiento"
          className="text-xs text-[#B08D2A] hover:underline inline-flex items-center gap-1 mt-2"
        >
          <Wrench className="w-3.5 h-3.5" />
          ¿Cambió la política de vigencias? Recalcula las fechas ya entregadas
        </Link>
      </div>

      {pedidos.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-200 rounded-2xl py-16 text-center text-sm text-gray-400">
          Aún no hay invitaciones entregadas con vencimiento.
        </div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm divide-y divide-gray-50">
          {pedidos.map((p) => {
            const vigencia = estadoVigencia(p.fecha_vencimiento!, hoy);
            const etiqueta = ETIQUETAS[vigencia];
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
                  {p.aviso_vencimiento_en && (
                    <p className="text-[11px] text-gray-400 mt-1">
                      Avisado el {formatoFecha(p.aviso_vencimiento_en)}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0 flex-wrap justify-end">
                  {vigencia !== "vigente" && (
                    <BotonCopiar
                      texto={mensajeWhatsAppRenovacion(
                        p.clientes.nombre,
                        p.plan as Plan,
                        p.fecha_vencimiento!,
                        p.url_entregada
                      )}
                      etiqueta="Copiar renovación"
                    />
                  )}
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900">{formatoFecha(p.fecha_vencimiento)}</p>
                    <p className="text-[11px] text-gray-400">
                      {textoVigencia(p.fecha_vencimiento!, hoy)}
                    </p>
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
