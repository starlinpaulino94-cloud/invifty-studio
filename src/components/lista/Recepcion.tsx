"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, DoorOpen, Loader2, Undo2, UserPlus } from "lucide-react";
import { buscarHogar, estadoPuerta, type EntradaRegistrada } from "@/lib/checkin";
import type { HogarDeLista } from "./Hogares";

/**
 * LA RECEPCIÓN — la puerta el día del evento
 * ===========================================
 * Pensada para usarse con una mano y prisa: se busca a la familia (por
 * nombre, o tecleando/escaneando el código de su QR), se ve cuántos se
 * esperaban y cuántos ya entraron, y se confirma. Los avisos —cupo
 * pasado, hogar que reingresa— se enseñan en ámbar y la decisión es del
 * humano: la puerta registra, no discute.
 */

export interface EntradaDeLista extends EntradaRegistrada {
  id: string;
  nombre: string;
  operador: string | null;
  creado_en: string;
}

export default function Recepcion({
  token,
  hogares,
  entradas,
  confirmadosPorHogar,
  mesaDeHogar = {},
}: {
  token: string;
  hogares: HogarDeLista[];
  entradas: EntradaDeLista[];
  confirmadosPorHogar: Record<string, number>;
  /** Nombre de la mesa de cada hogar (seating): la puerta la anuncia. */
  mesaDeHogar?: Record<string, string>;
}) {
  const router = useRouter();
  const [pendiente, empezar] = useTransition();
  const [consulta, setConsulta] = useState("");
  const [operador, setOperador] = useState("");
  const [personas, setPersonas] = useState<Record<string, number>>({});
  const [nombreLibre, setNombreLibre] = useState("");
  const [error, setError] = useState("");

  const refrescar = () => empezar(() => router.refresh());

  const dentro = entradas.filter((e) => !e.anulada_en).reduce((s, e) => s + e.personas, 0);
  const resultados = buscarHogar(hogares, consulta);

  const registrar = async (hogar: HogarDeLista | null, nombre: string, cantidad: number) => {
    setError("");
    const res = await fetch(`/api/lista/${token}/entradas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hogarId: hogar?.id ?? null,
        nombre,
        personas: cantidad,
        operador,
      }),
    });
    const cuerpo = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(cuerpo.error ?? "No se pudo registrar.");
      return;
    }
    setConsulta("");
    setNombreLibre("");
    refrescar();
  };

  const anular = async (id: string) => {
    await fetch(`/api/lista/${token}/entradas`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    refrescar();
  };

  const tarjeta = "bg-white/5 border border-white/10 rounded-2xl";

  return (
    <div className={`${tarjeta} p-5 mb-6`}>
      <div className="flex items-center justify-between gap-3 mb-1">
        <h2 className="text-white text-sm font-medium flex items-center gap-2">
          <DoorOpen className="w-4 h-4 text-[#D4AF37]" /> Recepción
        </h2>
        <span className="text-[11px] text-white/40">
          {dentro} {dentro === 1 ? "persona" : "personas"} dentro
        </span>
      </div>
      <p className="text-white/40 text-xs mb-4">
        Para el día del evento. Busca a la familia por nombre o teclea el código de su QR,
        confirma cuántos entran y listo. Nada se borra: lo mal anotado se anula.
      </p>

      <div className="flex flex-wrap gap-2 mb-3">
        <input
          value={consulta}
          onChange={(e) => setConsulta(e.target.value)}
          placeholder="Nombre o código (ej. A1B2C3)"
          className="flex-1 min-w-44 bg-black/40 border border-white/15 focus:border-[#D4AF37] rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none"
        />
        <input
          value={operador}
          onChange={(e) => setOperador(e.target.value)}
          maxLength={60}
          placeholder="¿Quién está en la puerta? (opcional)"
          className="flex-1 min-w-44 bg-black/40 border border-white/15 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none"
        />
      </div>

      {error && <p className="text-red-300 text-xs mb-2">{error}</p>}

      {/* Resultados de la búsqueda */}
      {consulta.trim().length >= 2 && (
        <div className="space-y-2 mb-4">
          {resultados.map((h) => {
            const estado = estadoPuerta(entradas, h.id, h.cupo);
            const esperados = confirmadosPorHogar[h.id] || h.cupo;
            return (
              <div key={h.id} className="bg-black/30 border border-white/10 rounded-xl p-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-sm text-white/90">{h.nombre}</p>
                    <p className="text-[11px] text-white/40">
                      cupo {h.cupo}
                      {confirmadosPorHogar[h.id] ? ` · confirmó ${confirmadosPorHogar[h.id]}` : ""}
                      {estado.dentro > 0 && ` · ya dentro ${estado.dentro}`}
                    </p>
                    {mesaDeHogar[h.id] && (
                      <p className="text-[11px] text-[#D4AF37] font-semibold mt-0.5">
                        🪑 {mesaDeHogar[h.id]}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={personas[h.id] ?? esperados}
                      onChange={(e) =>
                        setPersonas({ ...personas, [h.id]: Number(e.target.value) })
                      }
                      className="w-16 bg-black/40 border border-white/15 rounded-lg px-2 py-2 text-white text-sm focus:outline-none"
                      aria-label="Personas que entran"
                    />
                    <button
                      onClick={() => registrar(h, h.nombre, personas[h.id] ?? esperados)}
                      disabled={pendiente}
                      className="flex items-center gap-1.5 bg-[#D4AF37] hover:bg-[#F2D06B] disabled:opacity-50 text-black text-xs font-semibold px-4 py-2 rounded-full transition-colors"
                    >
                      {pendiente ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <DoorOpen className="w-3.5 h-3.5" />}
                      Entra
                    </button>
                  </div>
                </div>
                {estado.aviso && (
                  <p className="text-[11px] text-amber-300 mt-2 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {estado.aviso}
                  </p>
                )}
              </div>
            );
          })}

          {/* Entrada manual: gente sin hogar asignado */}
          <div className="bg-black/30 border border-white/10 rounded-xl p-3 flex items-center gap-2 flex-wrap">
            <UserPlus className="w-4 h-4 text-white/30 shrink-0" />
            <input
              value={nombreLibre}
              onChange={(e) => setNombreLibre(e.target.value)}
              maxLength={80}
              placeholder={resultados.length === 0 ? `Registrar "${consulta.trim()}" a mano` : "O registrar a alguien a mano"}
              className="flex-1 min-w-40 bg-transparent border-b border-white/15 focus:border-[#D4AF37] px-1 py-1.5 text-white text-sm focus:outline-none"
            />
            <input
              type="number"
              min={1}
              max={20}
              value={personas["libre"] ?? 1}
              onChange={(e) => setPersonas({ ...personas, libre: Number(e.target.value) })}
              className="w-14 bg-black/40 border border-white/15 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none"
              aria-label="Personas que entran"
            />
            <button
              onClick={() =>
                registrar(null, nombreLibre.trim() || consulta.trim(), personas["libre"] ?? 1)
              }
              disabled={pendiente || (nombreLibre.trim().length < 2 && consulta.trim().length < 2)}
              className="flex items-center gap-1.5 text-[11px] text-white/70 border border-white/20 hover:border-white/50 px-3 py-1.5 rounded-full transition-colors disabled:opacity-40"
            >
              Entra
            </button>
          </div>
        </div>
      )}

      {/* Últimas entradas */}
      {entradas.length > 0 && (
        <ul className="divide-y divide-white/5">
          {entradas.slice(0, 12).map((e) => (
            <li key={e.id} className="py-2.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p
                  className={`text-sm truncate ${e.anulada_en ? "text-white/30 line-through" : "text-white/80"}`}
                >
                  {e.nombre}
                </p>
                {/* suppressHydrationWarning: la hora se formatea con el
                    reloj y el idioma del TELÉFONO del operador, que no
                    coinciden con los del servidor. Es la hora que quiere
                    ver quien está en la puerta. */}
                <p className="text-[11px] text-white/30" suppressHydrationWarning>
                  {e.personas} {e.personas === 1 ? "persona" : "personas"}
                  {e.operador ? ` · anotó ${e.operador}` : ""}
                  {" · "}
                  {new Date(e.creado_en).toLocaleTimeString("es-DO", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {e.anulada_en ? " · anulada" : ""}
                </p>
              </div>
              {!e.anulada_en && (
                <button
                  onClick={() => anular(e.id)}
                  disabled={pendiente}
                  className="flex items-center gap-1 text-[11px] text-white/40 hover:text-red-400 transition-colors shrink-0"
                >
                  <Undo2 className="w-3 h-3" /> Anular
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
