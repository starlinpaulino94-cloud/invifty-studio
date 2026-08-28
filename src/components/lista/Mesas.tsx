"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ocupacionDeMesas,
  hogaresSinMesa,
  planoTexto,
  type HogarAsignable,
  type MesaBase,
} from "@/lib/mesas";
import { Loader2, Armchair, Plus, Trash2, Copy, Check } from "lucide-react";

/**
 * EL ORGANIZADOR DE MESAS del anfitrión: crear mesas, asignar hogares
 * completos (las familias se sientan juntas) y copiar el plano para el
 * venue. La ocupación cuenta confirmados; a los que no responden les
 * reserva su cupo — mejor sobrar silla que faltar.
 */
export default function Mesas({
  token,
  titulo,
  mesas,
  hogares,
  confirmadosPorHogar,
  respondieron,
}: {
  token: string;
  titulo: string;
  mesas: MesaBase[];
  hogares: HogarAsignable[];
  confirmadosPorHogar: Record<string, number>;
  respondieron: string[];
}) {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [capacidad, setCapacidad] = useState("10");
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const tarjeta = "bg-white/5 border border-white/10 rounded-2xl";

  const quienesRespondieron = new Set(respondieron);
  const ocupacion = ocupacionDeMesas(mesas, hogares, confirmadosPorHogar, quienesRespondieron);
  const pendientes = hogaresSinMesa(hogares);

  const llamar = async (init: RequestInit) => {
    setError("");
    setOcupado(true);
    try {
      const r = await fetch(`/api/lista/${token}/mesas`, {
        headers: { "Content-Type": "application/json" },
        ...init,
      });
      const cuerpo = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(cuerpo.error ?? "No se pudo completar la acción.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo completar la acción.");
    } finally {
      setOcupado(false);
    }
  };

  const crear = (e: FormEvent) => {
    e.preventDefault();
    void llamar({
      method: "POST",
      body: JSON.stringify({ nombre, capacidad: Number(capacidad) }),
    }).then(() => {
      setNombre("");
    });
  };

  const copiarPlano = async () => {
    await navigator.clipboard.writeText(planoTexto(ocupacion, pendientes, titulo));
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  return (
    <div className={`${tarjeta} p-5 mt-6`}>
      <div className="flex items-center justify-between gap-3 mb-1 flex-wrap">
        <h2 className="text-white text-sm font-medium flex items-center gap-2">
          <Armchair className="w-4 h-4 text-[#D4AF37]" /> Mesas
        </h2>
        {mesas.length > 0 && (
          <button
            onClick={copiarPlano}
            className="inline-flex items-center gap-1.5 text-[#D4AF37] hover:text-[#F2D06B] text-[11px] font-semibold uppercase tracking-[0.12em]"
          >
            {copiado ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copiado ? "Copiado" : "Copiar plano"}
          </button>
        )}
      </div>
      <p className="text-white/40 text-xs mb-4">
        Asigna hogares completos: las familias se sientan juntas. El conteo usa
        los confirmados; a quien no ha respondido le reserva su cupo.
      </p>

      {/* Crear mesa */}
      <form onSubmit={crear} className="flex flex-wrap items-center gap-2 mb-4">
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          maxLength={40}
          placeholder="Mesa 1 / Mesa de los novios…"
          className="flex-1 min-w-40 bg-black/30 border border-white/15 focus:border-[#D4AF37] rounded-xl px-3 py-2 text-white text-xs focus:outline-none"
        />
        <input
          type="number"
          min={1}
          max={100}
          value={capacidad}
          onChange={(e) => setCapacidad(e.target.value)}
          className="w-20 bg-black/30 border border-white/15 focus:border-[#D4AF37] rounded-xl px-3 py-2 text-white text-xs focus:outline-none"
          title="Capacidad"
        />
        <button
          type="submit"
          disabled={ocupado || !nombre.trim()}
          className="bg-[#D4AF37] hover:bg-[#F2D06B] disabled:opacity-50 text-black font-semibold text-[11px] uppercase tracking-[0.15em] px-4 py-2.5 rounded-xl inline-flex items-center gap-1.5"
        >
          {ocupado ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          Crear
        </button>
      </form>

      {error && <p className="text-red-300 text-xs mb-3">{error}</p>}

      {/* Las mesas y su ocupación */}
      {ocupacion.length > 0 && (
        <div className="grid sm:grid-cols-2 gap-2 mb-4">
          {ocupacion.map((mesa) => (
            <div key={mesa.id} className="bg-black/30 border border-white/10 rounded-2xl p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-white/80 text-xs font-semibold truncate">{mesa.nombre}</p>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`text-[11px] font-semibold ${
                      mesa.sobrecupo ? "text-amber-300" : "text-white/40"
                    }`}
                  >
                    {mesa.personas}/{mesa.capacidad}
                    {mesa.sobrecupo && " ⚠"}
                  </span>
                  <button
                    title="Eliminar mesa (sus hogares quedan sin mesa)"
                    disabled={ocupado}
                    onClick={() => llamar({ method: "DELETE", body: JSON.stringify({ mesaId: mesa.id }) })}
                    className="text-red-300/70 hover:text-red-300"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              {mesa.hogares.length > 0 && (
                <p className="text-white/40 text-[11px] mt-1.5">
                  {mesa.hogares.map((h) => h.nombre).join(" · ")}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Asignación por hogar */}
      {hogares.length === 0 ? (
        <p className="text-white/30 text-xs">
          Cuando organices a tus invitados en hogares, aquí los asignas a sus mesas.
        </p>
      ) : (
        mesas.length > 0 && (
          <ul className="divide-y divide-white/5">
            {hogares.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-3 py-2">
                <span className="text-white/70 text-xs truncate">{h.nombre}</span>
                <select
                  value={h.mesa_id ?? ""}
                  disabled={ocupado}
                  onChange={(e) =>
                    llamar({
                      method: "PATCH",
                      body: JSON.stringify({ hogarId: h.id, mesaId: e.target.value || null }),
                    })
                  }
                  className="bg-black/30 border border-white/15 rounded-lg px-2 py-1.5 text-white/80 text-[11px] focus:outline-none focus:border-[#D4AF37] max-w-40"
                >
                  <option value="">Sin mesa</option>
                  {mesas.map((m) => (
                    <option key={m.id} value={m.id}>{m.nombre}</option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}
