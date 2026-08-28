import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { desglosePagos, pagoActivo } from "@/lib/pagos";
import { formatoDOP, PLANES } from "@/lib/planes";
import { NOMBRE_ESTADO_REPORTE, type EstadoReporte } from "@/lib/cobro";
import { CUENTAS_COBRO } from "@/config/cobro";
import ReportarPago, { CuentaParaCopiar } from "@/components/cobro/ReportarPago";
import type { Pago, Plan } from "@/lib/tipos";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pagar — Invifty",
  description: "Tu saldo, nuestras cuentas y tu comprobante, todo en un lugar.",
  robots: { index: false, follow: false },
};

/**
 * LA PÁGINA DE COBRO — /pagar/<token>
 * ====================================
 * El cliente ve su saldo real (derivado de las transacciones, el mismo
 * número del panel), copia los datos bancarios campo por campo y sube su
 * comprobante. Lo que reporta queda PENDIENTE hasta que el equipo lo
 * confirme contra el banco: aquí nadie se acredita pagos solo.
 */
export default async function PaginaPagar({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!/^[a-f0-9]{32}$/i.test(token)) notFound();

  const admin = crearClienteAdmin();
  const { data: pedido } = await admin
    .from("pedidos")
    .select("id, plan, precio, clientes(nombre), pagos(monto, tipo, anulado_en)")
    .eq("token_cobro", token)
    .maybeSingle();
  if (!pedido) notFound();

  const pagos = ((pedido.pagos ?? []) as Pago[]).filter(pagoActivo);
  const dinero = desglosePagos(pagos);
  const saldo = Math.max(0, Number(pedido.precio) - dinero.neto);
  const nombre = (pedido.clientes as unknown as { nombre: string } | null)?.nombre ?? "";

  // Sus reportes anteriores, para que sepa en qué quedó cada uno.
  const { data: reportes } = await admin
    .from("pagos_reportados")
    .select("id, monto, estado, motivo_rechazo, creado_en")
    .eq("pedido_id", pedido.id)
    .order("creado_en", { ascending: false })
    .limit(10);

  return (
    <div className="min-h-dvh bg-[#0D0D0F] px-4 py-10">
      <div className="max-w-md mx-auto space-y-6">
        <div className="text-center">
          <span className="font-serif text-2xl tracking-[0.3em] text-white uppercase block">
            Invifty
          </span>
          <span className="text-[10px] uppercase tracking-[0.4em] text-[#D4AF37] font-semibold">
            Pago de tu invitación
          </span>
        </div>

        {/* El saldo, con los mismos números del panel */}
        <div className="bg-white/5 border border-white/10 rounded-3xl p-6 text-center">
          {nombre && <p className="text-white/50 text-sm">{nombre.split(" ")[0]}, tu plan {PLANES[pedido.plan as Plan]?.nombre ?? pedido.plan}:</p>}
          <div className="grid grid-cols-3 gap-2 mt-4 text-center">
            <div><p className="text-white text-sm font-semibold">{formatoDOP(Number(pedido.precio))}</p><p className="text-white/35 text-[10px] uppercase tracking-wide">total</p></div>
            <div><p className="text-white text-sm font-semibold">{formatoDOP(dinero.neto)}</p><p className="text-white/35 text-[10px] uppercase tracking-wide">abonado</p></div>
            <div><p className="text-[#D4AF37] text-sm font-bold">{formatoDOP(saldo)}</p><p className="text-white/35 text-[10px] uppercase tracking-wide">pendiente</p></div>
          </div>
          {saldo <= 0 && (
            <p className="text-emerald-300 text-xs mt-4">✓ Tu pago está completo. ¡Gracias!</p>
          )}
        </div>

        <ReportarPago
          token={token}
          cuentas={CUENTAS_COBRO as CuentaParaCopiar[]}
          saldo={saldo}
        />

        {(reportes?.length ?? 0) > 0 && (
          <div className="bg-white/5 border border-white/10 rounded-3xl p-5">
            <p className="text-white/60 text-xs font-semibold mb-2">Tus reportes</p>
            <ul className="divide-y divide-white/5">
              {(reportes ?? []).map((r) => (
                <li key={r.id} className="py-2 flex items-center justify-between gap-3 text-xs">
                  <span className="text-white/70">{formatoDOP(Number(r.monto))}</span>
                  <span
                    className={
                      r.estado === "confirmado"
                        ? "text-emerald-300"
                        : r.estado === "rechazado"
                          ? "text-red-300"
                          : "text-white/40"
                    }
                  >
                    {NOMBRE_ESTADO_REPORTE[r.estado as EstadoReporte]}
                    {r.estado === "rechazado" && r.motivo_rechazo ? ` — ${r.motivo_rechazo}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-white/20 text-[11px] text-center">
          Invifty · tu pago se confirma contra el banco antes de reflejarse
        </p>
      </div>
    </div>
  );
}
