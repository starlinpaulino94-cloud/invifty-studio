"use client";

import { useState, FormEvent } from "react";
import type { CuentaRegalo } from "@/lib/regalos";
import { Loader2, Copy, Check, Gift, Landmark } from "lucide-react";

/**
 * Las cuentas del anfitrión con copiar campo a campo, y el registro del
 * regalo. El monto es OPCIONAL y lo dice la propia etiqueta: presionar
 * por la cifra sería de mal gusto.
 */
export default function RegistrarRegalo({
  slug,
  cuentas,
}: {
  slug: string;
  cuentas: CuentaRegalo[];
}) {
  const [nombre, setNombre] = useState("");
  const [monto, setMonto] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [copiado, setCopiado] = useState("");

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
      const r = await fetch(`/api/regalos/${slug}/aportar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, monto, mensaje }),
      });
      const cuerpo = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(cuerpo.error ?? "No se pudo registrar tu regalo.");
      setEnviado(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo registrar tu regalo.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Las cuentas del anfitrión */}
      <div className="bg-white/5 border border-white/10 rounded-3xl p-5 space-y-4">
        <p className="text-white text-sm font-semibold flex items-center gap-2">
          <Landmark className="w-4 h-4 text-[#D4AF37]" /> Para transferir
        </p>
        {cuentas.length === 0 ? (
          <p className="text-white/40 text-xs">
            Pregúntales a los anfitriones por los datos de su cuenta.
          </p>
        ) : (
          cuentas.map((c, i) => (
            <div key={i} className="bg-black/30 border border-white/10 rounded-2xl p-4 space-y-1.5">
              <p className="text-white/80 text-sm font-semibold">{c.banco}</p>
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

      {/* El registro */}
      {enviado ? (
        <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-3xl p-6 text-center">
          <p className="text-emerald-300 text-sm font-semibold">¡Gracias de corazón! 💛</p>
          <p className="text-white/40 text-xs mt-2">
            Los anfitriones recibieron tu registro y tu mensaje.
          </p>
        </div>
      ) : (
        <form onSubmit={enviar} className="bg-white/5 border border-white/10 rounded-3xl p-5 space-y-4">
          <p className="text-white text-sm font-semibold flex items-center gap-2">
            <Gift className="w-4 h-4 text-[#D4AF37]" /> Registrar mi regalo
          </p>
          <div>
            <label htmlFor="nombre" className="block text-xs text-white/60 mb-1.5 font-medium">
              Tu nombre
            </label>
            <input
              id="nombre"
              type="text"
              required
              maxLength={80}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full bg-black/30 border border-white/15 focus:border-[#D4AF37] rounded-xl px-4 py-3 text-white text-sm focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="monto" className="block text-xs text-white/60 mb-1.5 font-medium">
              Monto (RD$) — opcional, si quieres decirlo
            </label>
            <input
              id="monto"
              type="number"
              min="1"
              step="0.01"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              className="w-full bg-black/30 border border-white/15 focus:border-[#D4AF37] rounded-xl px-4 py-3 text-white text-sm focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="mensaje" className="block text-xs text-white/60 mb-1.5 font-medium">
              Un mensaje para los anfitriones (opcional)
            </label>
            <textarea
              id="mensaje"
              rows={3}
              maxLength={300}
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
              className="w-full bg-black/30 border border-white/15 focus:border-[#D4AF37] rounded-xl px-4 py-3 text-white text-sm focus:outline-none resize-y"
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
            {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gift className="w-4 h-4" />}
            Registrar mi regalo
          </button>
        </form>
      )}
    </div>
  );
}
