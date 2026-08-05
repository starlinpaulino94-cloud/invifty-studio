"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Home, Loader2, Plus, Printer, X } from "lucide-react";
import { codigoCorto } from "@/lib/checkin";

/**
 * LOS HOGARES — la lista como invita la gente de verdad
 * ======================================================
 * "Familia Pérez, hasta 4" es una invitación; cuatro nombres sueltos son
 * cuatro. Cada hogar tiene su ENLACE PERSONAL (la invitación con su
 * nombre y su cupo ya puestos) y su código para la puerta. Es opcional,
 * como la lista de nombres: sin hogares todo lo demás sigue funcionando.
 */

export interface HogarDeLista {
  id: string;
  nombre: string;
  cupo: number;
  token: string;
}

export default function Hogares({
  token,
  slug,
  hogares,
  confirmadosPorHogar,
}: {
  token: string;
  slug: string;
  hogares: HogarDeLista[];
  confirmadosPorHogar: Record<string, number>;
}) {
  const router = useRouter();
  const [pendiente, empezar] = useTransition();
  const [abriendo, setAbriendo] = useState(false);
  const [nombre, setNombre] = useState("");
  const [cupo, setCupo] = useState(2);
  const [error, setError] = useState("");
  const [copiado, setCopiado] = useState("");

  const refrescar = () => empezar(() => router.refresh());

  const crear = async () => {
    setError("");
    const res = await fetch(`/api/lista/${token}/hogares`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, cupo }),
    });
    const cuerpo = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(cuerpo.error ?? "No se pudo crear.");
      return;
    }
    setNombre("");
    setCupo(2);
    refrescar();
  };

  const quitar = async (id: string) => {
    await fetch(`/api/lista/${token}/hogares`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    refrescar();
  };

  const copiarEnlace = (h: HogarDeLista) => {
    const url = `${window.location.origin}/i/${slug}?h=${h.token}`;
    navigator.clipboard?.writeText(url).then(() => {
      setCopiado(h.id);
      setTimeout(() => setCopiado(""), 1500);
    });
  };

  const tarjeta = "bg-white/5 border border-white/10 rounded-2xl";

  return (
    <div className={`${tarjeta} p-5 mb-6`}>
      <div className="flex items-center justify-between gap-3 mb-1">
        <h2 className="text-white text-sm font-medium flex items-center gap-2">
          <Home className="w-4 h-4 text-[#D4AF37]" /> Hogares
        </h2>
        <span className="text-[11px] text-white/40">{hogares.length}</span>
      </div>
      <p className="text-white/40 text-xs mb-4">
        Invita por familia con un cupo: cada hogar tiene su enlace personal (la invitación ya
        sabe quiénes son y cuántos caben) y su código para la entrada el día del evento.
      </p>

      {!abriendo ? (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setAbriendo(true)}
            className="flex items-center gap-2 text-xs text-[#D4AF37] border border-[#D4AF37]/40 rounded-full px-4 py-2 hover:bg-[#D4AF37]/10 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Añadir hogar
          </button>
          {hogares.length > 0 && (
            <a
              href={`/lista/${token}/qr`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs text-white/60 border border-white/15 rounded-full px-4 py-2 hover:bg-white/5 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" /> Imprimir códigos QR
            </a>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 items-center">
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            autoFocus
            maxLength={80}
            placeholder="Familia Pérez"
            className="flex-1 min-w-40 bg-black/40 border border-white/15 focus:border-[#D4AF37] rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none"
          />
          <label className="flex items-center gap-2 text-xs text-white/50">
            hasta
            <input
              type="number"
              min={1}
              max={20}
              value={cupo}
              onChange={(e) => setCupo(Number(e.target.value))}
              className="w-16 bg-black/40 border border-white/15 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none"
            />
            personas
          </label>
          <button
            onClick={crear}
            disabled={pendiente || nombre.trim().length < 2}
            className="flex items-center gap-2 bg-[#D4AF37] hover:bg-[#F2D06B] disabled:opacity-50 text-black text-xs font-semibold uppercase tracking-[0.15em] px-5 py-2.5 rounded-full transition-colors"
          >
            {pendiente && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Guardar
          </button>
          <button
            onClick={() => { setAbriendo(false); setError(""); }}
            className="text-xs text-white/50 px-2 py-2.5 hover:text-white transition-colors"
          >
            Cancelar
          </button>
        </div>
      )}
      {error && <p className="text-red-300 text-xs mt-2">{error}</p>}

      {hogares.length > 0 && (
        <ul className="divide-y divide-white/5 mt-4">
          {hogares.map((h) => {
            const confirmados = confirmadosPorHogar[h.id] ?? 0;
            return (
              <li key={h.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-white/90 truncate">{h.nombre}</p>
                  <p className="text-[11px] text-white/40">
                    hasta {h.cupo} · código {codigoCorto(h.token)}
                    {confirmados > 0 && (
                      <span className="text-emerald-400"> · confirmó {confirmados}</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => copiarEnlace(h)}
                    className="flex items-center gap-1.5 text-[11px] text-[#D4AF37] border border-[#D4AF37]/40 rounded-full px-3 py-1.5 hover:bg-[#D4AF37]/10 transition-colors"
                  >
                    {copiado === h.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    Su enlace
                  </button>
                  <button
                    onClick={() => quitar(h.id)}
                    aria-label={`Quitar ${h.nombre}`}
                    className="text-white/25 hover:text-red-400 transition-colors p-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
