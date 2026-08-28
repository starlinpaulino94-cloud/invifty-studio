"use client";

import { useState } from "react";
import {
  hogaresSinConfirmar,
  mensajeRecordatorioConfirmacion,
  mensajeRecordatorioEvento,
} from "@/lib/recordatorios";
import type { HogarDeLista } from "./Hogares";
import { BellRing, Copy, Check } from "lucide-react";

/**
 * RECORDATORIOS, DEL LADO DEL ANFITRIÓN: mensajes listos para reenviar.
 * El sistema redacta (nombre del hogar, enlace personal, días que
 * faltan, fecha límite); el anfitrión pega cada uno en su chat con esa
 * familia. Dos toques por hogar, nadie olvidado.
 */
export default function Recordatorios({
  titulo,
  slug,
  fechaEvento,
  fechaLimite,
  hogares,
  hogaresQueRespondieron,
}: {
  titulo: string;
  slug: string;
  fechaEvento: string | null;
  fechaLimite: string | null;
  hogares: HogarDeLista[];
  hogaresQueRespondieron: string[];
}) {
  const [copiado, setCopiado] = useState("");
  const tarjeta = "bg-white/5 border border-white/10 rounded-2xl";

  const base = typeof window !== "undefined" ? window.location.origin : "";
  const ahora = new Date();
  const pendientes = hogaresSinConfirmar(hogares, new Set(hogaresQueRespondieron));

  const copiar = async (clave: string, texto: string) => {
    await navigator.clipboard.writeText(texto);
    setCopiado(clave);
    setTimeout(() => setCopiado(""), 2000);
  };

  return (
    <div className={`${tarjeta} p-5 mt-6`}>
      <h2 className="text-white text-sm font-medium flex items-center gap-2 mb-1">
        <BellRing className="w-4 h-4 text-[#D4AF37]" /> Recordatorios
      </h2>
      <p className="text-white/40 text-xs mb-4">
        Mensajes listos para reenviar por WhatsApp: el general para grupos o
        estados, y uno personal por cada hogar que aún no confirma.
      </p>

      <button
        onClick={() =>
          copiar(
            "general",
            mensajeRecordatorioEvento({ titulo, fechaEvento, url: `${base}/i/${slug}`, ahora })
          )
        }
        className="inline-flex items-center gap-1.5 text-[#D4AF37] hover:text-[#F2D06B] font-semibold uppercase tracking-[0.12em] text-[11px] mb-4"
      >
        {copiado === "general" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        {copiado === "general" ? "Copiado" : "Copiar recordatorio general"}
      </button>

      {hogares.length === 0 ? (
        <p className="text-white/30 text-xs">
          Cuando organices a tus invitados en hogares, aquí saldrá un mensaje
          personal por cada hogar que falte por confirmar.
        </p>
      ) : pendientes.length === 0 ? (
        <p className="text-white/40 text-xs">
          🎉 Todos tus hogares ya respondieron: no hay a quién recordarle.
        </p>
      ) : (
        <>
          <p className="text-white/50 text-xs mb-2">
            Sin confirmar ({pendientes.length} de {hogares.length}):
          </p>
          <ul className="divide-y divide-white/5">
            {pendientes.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-3 py-2">
                <span className="text-white/70 text-xs truncate">{h.nombre}</span>
                <button
                  onClick={() =>
                    copiar(
                      h.id,
                      mensajeRecordatorioConfirmacion({
                        nombreHogar: h.nombre,
                        titulo,
                        fechaEvento,
                        url: `${base}/i/${slug}?h=${h.token}`,
                        fechaLimite,
                        ahora,
                      })
                    )
                  }
                  className="inline-flex items-center gap-1.5 text-[#D4AF37] hover:text-[#F2D06B] text-[11px] font-semibold uppercase tracking-[0.12em] shrink-0"
                >
                  {copiado === h.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiado === h.id ? "Copiado" : "Copiar mensaje"}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
