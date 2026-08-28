"use client";

import { useState, useRef, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { COMPROBANTE_MAX_MB } from "@/lib/cobro";
import { Loader2, Copy, Check, Upload, Landmark } from "lucide-react";

export interface CuentaParaCopiar {
  banco: string;
  tipo: string;
  numero: string;
  titular: string;
  documento?: string;
}

/**
 * Las cuentas con botón de copiar campo por campo, y el formulario para
 * reportar la transferencia (monto + referencia y/o comprobante). El
 * servidor valida todo otra vez; esto solo es la parte amable.
 */
export default function ReportarPago({
  token,
  cuentas,
  saldo,
}: {
  token: string;
  cuentas: CuentaParaCopiar[];
  saldo: number;
}) {
  const router = useRouter();
  const [monto, setMonto] = useState(saldo > 0 ? String(saldo) : "");
  const [referencia, setReferencia] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [copiado, setCopiado] = useState("");
  const archivo = useRef<HTMLInputElement>(null);

  const copiar = async (clave: string, texto: string) => {
    await navigator.clipboard.writeText(texto);
    setCopiado(clave);
    setTimeout(() => setCopiado(""), 2000);
  };

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setEnviando(true);
    try {
      const datos = new FormData();
      datos.append("monto", monto);
      datos.append("referencia", referencia);
      const f = archivo.current?.files?.[0];
      if (f) datos.append("comprobante", f);
      const r = await fetch(`/api/cobro/${token}/reportar`, { method: "POST", body: datos });
      const cuerpo = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(cuerpo.error ?? "No se pudo enviar tu reporte.");
      setEnviado(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo enviar tu reporte.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Las cuentas */}
      <div className="bg-white/5 border border-white/10 rounded-3xl p-5 space-y-4">
        <p className="text-white text-sm font-semibold flex items-center gap-2">
          <Landmark className="w-4 h-4 text-[#D4AF37]" /> Transfiere a cualquiera de estas cuentas
        </p>
        {cuentas.length === 0 ? (
          <p className="text-white/40 text-xs">
            Escríbenos por WhatsApp y te pasamos los datos de la cuenta.
          </p>
        ) : (
          cuentas.map((c, i) => (
            <div key={i} className="bg-black/30 border border-white/10 rounded-2xl p-4 space-y-1.5">
              <p className="text-white/80 text-sm font-semibold">{c.banco} · {c.tipo}</p>
              {[
                ["numero", "Cuenta", c.numero],
                ["titular", "Titular", c.titular],
                ...(c.documento ? [["documento", "Documento", c.documento] as const] : []),
              ].map(([clave, etiqueta, valor]) => (
                <div key={clave} className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-white/40">{etiqueta}</span>
                  <button
                    onClick={() => copiar(`${i}-${clave}`, String(valor))}
                    className="inline-flex items-center gap-1.5 text-white/80 hover:text-white"
                    title="Copiar"
                  >
                    <span className="font-medium">{valor}</span>
                    {copiado === `${i}-${clave}` ? (
                      <Check className="w-3 h-3 text-emerald-300" />
                    ) : (
                      <Copy className="w-3 h-3 text-[#D4AF37]" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      {/* El reporte */}
      {enviado ? (
        <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-3xl p-6 text-center">
          <p className="text-emerald-300 text-sm font-semibold">¡Recibimos tu reporte! ✓</p>
          <p className="text-white/40 text-xs mt-2">
            Lo revisamos contra el banco y te confirmamos por WhatsApp.
          </p>
        </div>
      ) : (
        <form onSubmit={enviar} className="bg-white/5 border border-white/10 rounded-3xl p-5 space-y-4">
          <p className="text-white text-sm font-semibold">Ya transferí — reportar mi pago</p>
          <div>
            <label htmlFor="monto" className="block text-xs text-white/60 mb-1.5 font-medium">
              Monto transferido (RD$)
            </label>
            <input
              id="monto"
              type="number"
              min="1"
              step="0.01"
              required
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              className="w-full bg-black/30 border border-white/15 focus:border-[#D4AF37] rounded-xl px-4 py-3 text-white text-sm focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="referencia" className="block text-xs text-white/60 mb-1.5 font-medium">
              Número de referencia o confirmación
            </label>
            <input
              id="referencia"
              type="text"
              maxLength={60}
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
              className="w-full bg-black/30 border border-white/15 focus:border-[#D4AF37] rounded-xl px-4 py-3 text-white text-sm focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-white/60 mb-1.5 font-medium">
              Comprobante (captura o PDF · máx. {COMPROBANTE_MAX_MB} MB)
            </label>
            <input
              ref={archivo}
              type="file"
              accept="image/*,application/pdf"
              className="w-full text-xs text-white/50 file:mr-3 file:rounded-xl file:border-0 file:bg-white/10 file:px-4 file:py-2.5 file:text-white/80 file:text-xs"
            />
          </div>
          {error && (
            <p className="text-red-300 text-xs bg-red-950/40 border border-red-500/30 rounded-xl py-2 px-3">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={enviando}
            className="w-full bg-[#D4AF37] hover:bg-[#F2D06B] disabled:opacity-60 text-black font-semibold text-xs uppercase tracking-[0.2em] py-3.5 rounded-xl flex items-center justify-center gap-2"
          >
            {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Enviar mi reporte
          </button>
        </form>
      )}
    </div>
  );
}
