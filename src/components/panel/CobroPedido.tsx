"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  generarEnlaceCobro,
  confirmarPagoReportado,
  rechazarPagoReportado,
} from "@/lib/acciones";
import { mensajeWhatsAppCobro } from "@/lib/cobro";
import { formatoDOP, formatoFecha } from "@/lib/planes";
import { BotonCopiar } from "@/components/panel/Interactivos";
import { Loader2, Link2, CheckCircle2, XCircle, FileText } from "lucide-react";

export interface ReporteParaRevisar {
  id: string;
  monto: number;
  referencia: string | null;
  nota: string | null;
  comprobante_url: string | null;
  creado_en: string;
}

/**
 * EL COBRO EN LA FICHA: generar el enlace /pagar (uno por pedido, para
 * siempre), copiar el mensaje de WhatsApp con el saldo, y revisar los
 * pagos que el cliente reportó — confirmar (se vuelve pago real, con
 * idempotencia) o rechazar con motivo que el cliente leerá.
 */
export default function CobroPedido({
  pedidoId,
  nombreCliente,
  saldo,
  token,
  urlBase,
  reportes,
}: {
  pedidoId: string;
  nombreCliente: string;
  saldo: number;
  token: string | null;
  urlBase: string;
  reportes: ReporteParaRevisar[];
}) {
  const router = useRouter();
  const [tokenFresco, setTokenFresco] = useState("");
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [rechazando, setRechazando] = useState("");
  const [motivo, setMotivo] = useState("");

  const enlace = tokenFresco || token;
  const url = enlace ? `${urlBase}/pagar/${enlace}` : "";

  const ejecutar = async (accion: () => Promise<unknown>) => {
    setError("");
    setOcupado(true);
    try {
      await accion();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo completar la acción.");
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* El enlace de cobro */}
      <div className="flex flex-wrap items-center gap-2">
        {!enlace ? (
          <button
            onClick={() =>
              ejecutar(async () => {
                const { token } = await generarEnlaceCobro(pedidoId);
                setTokenFresco(token);
              })
            }
            disabled={ocupado}
            className="text-xs font-semibold text-gray-700 border border-gray-200 hover:border-gray-400 rounded-xl px-3 py-2 inline-flex items-center gap-1.5 disabled:opacity-60"
          >
            {ocupado ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
            Generar enlace de cobro
          </button>
        ) : (
          <>
            <code className="text-[11px] bg-gray-50 border border-gray-100 rounded-lg px-2 py-1 break-all">
              {url}
            </code>
            <BotonCopiar
              texto={mensajeWhatsAppCobro(nombreCliente, saldo, url)}
              etiqueta="Copiar mensaje con el saldo"
            />
          </>
        )}
      </div>

      {/* Los reportes por revisar */}
      {reportes.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
          <p className="text-amber-800 text-sm font-semibold">
            💰 {reportes.length} pago{reportes.length === 1 ? "" : "s"} reportado{reportes.length === 1 ? "" : "s"} por revisar
          </p>
          <ul className="divide-y divide-amber-100">
            {reportes.map((r) => (
              <li key={r.id} className="py-3 space-y-2">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-amber-900">
                  <span className="font-bold">{formatoDOP(Number(r.monto))}</span>
                  <span>{formatoFecha(r.creado_en)}</span>
                  {r.referencia && <span>ref. {r.referencia}</span>}
                  {r.comprobante_url && (
                    <a
                      href={r.comprobante_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 underline"
                    >
                      <FileText className="w-3 h-3" /> Ver comprobante
                    </a>
                  )}
                </div>
                {r.nota && <p className="text-[11px] text-amber-700">“{r.nota}”</p>}
                {rechazando === r.id ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                      placeholder="Motivo (el cliente lo leerá)"
                      className="flex-1 min-w-40 border border-amber-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-amber-500"
                    />
                    <button
                      onClick={() =>
                        ejecutar(async () => {
                          await rechazarPagoReportado(r.id, pedidoId, motivo);
                          setRechazando("");
                          setMotivo("");
                        })
                      }
                      disabled={ocupado}
                      className="text-xs font-semibold text-red-700 border border-red-200 hover:border-red-400 rounded-xl px-3 py-2 disabled:opacity-60"
                    >
                      Rechazar
                    </button>
                    <button
                      onClick={() => setRechazando("")}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => ejecutar(() => confirmarPagoReportado(r.id, pedidoId))}
                      disabled={ocupado}
                      className="text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl px-3 py-2 inline-flex items-center gap-1.5 disabled:opacity-60"
                    >
                      {ocupado ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                      Confirmar: cuadra con el banco
                    </button>
                    <button
                      onClick={() => {
                        setRechazando(r.id);
                        setMotivo("");
                      }}
                      disabled={ocupado}
                      className="text-xs font-semibold text-red-700 border border-red-200 hover:border-red-400 rounded-xl px-3 py-2 inline-flex items-center gap-1.5 disabled:opacity-60"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Rechazar
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <p className="text-red-600 text-xs bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>
      )}
    </div>
  );
}
