"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Loader2, MessageCircle, UserPlus, Check } from "lucide-react";
import { cambiarEstadoLead, convertirLead } from "@/lib/acciones-leads";
import { formatoFecha, PLANES, TIPOS_EVENTO } from "@/lib/planes";
import type { EstadoLead } from "@/lib/leads";
import type { Lead, TipoEvento } from "@/lib/tipos";

/**
 * UN LEAD EN EL PANEL
 * ====================
 * La tarjeta responde a la pregunta operativa: ¿a quién le toca escribirle
 * hoy? Por eso el botón grande es WhatsApp con mensaje preparado, y los
 * estados son un clic — si actualizar el estado cuesta, nadie lo hace y la
 * lista miente.
 */

const ETIQUETAS: Record<EstadoLead, { nombre: string; color: string }> = {
  nuevo: { nombre: "Nuevo", color: "bg-sky-100 text-sky-700" },
  contactado: { nombre: "Contactado", color: "bg-amber-100 text-amber-700" },
  calificado: { nombre: "Calificado", color: "bg-violet-100 text-violet-700" },
  convertido: { nombre: "Convertido", color: "bg-emerald-100 text-emerald-700" },
  perdido: { nombre: "Perdido", color: "bg-gray-200 text-gray-500" },
};

export default function LeadTarjeta({ lead }: { lead: Lead }) {
  const [pendiente, empezar] = useTransition();
  const [error, setError] = useState("");

  const cambiar = (estado: EstadoLead) =>
    empezar(async () => {
      setError("");
      try {
        await cambiarEstadoLead(lead.id, estado);
      } catch {
        setError("No se pudo guardar el cambio.");
      }
    });

  const convertir = () =>
    empezar(async () => {
      setError("");
      try {
        await convertirLead(lead.id);
      } catch {
        setError("No se pudo convertir.");
      }
    });

  const etiqueta = ETIQUETAS[lead.estado];
  const saludo = `¡Hola ${lead.nombre.split(" ")[0]}! Te escribimos de Invifty: recibimos tu solicitud de invitación digital${lead.plan_id ? ` (plan ${PLANES[lead.plan_id].nombre})` : ""}. ¿Te contamos cómo funciona?`;
  const utm = Object.entries(lead.utm ?? {});

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 flex items-center gap-2 flex-wrap">
            {lead.nombre}
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${etiqueta.color}`}>
              {etiqueta.nombre}
            </span>
          </p>
          <p className="text-xs text-gray-500 mt-1 flex flex-wrap gap-x-2">
            <span>{TIPOS_EVENTO[lead.tipo_evento as TipoEvento] ?? lead.tipo_evento}</span>
            {lead.fecha_evento && <span>· evento {formatoFecha(lead.fecha_evento)}</span>}
            {lead.plan_id && <span>· plan {PLANES[lead.plan_id].nombre}</span>}
            <span>· llegó {formatoFecha(lead.creado_en)}</span>
            <span>· vía {lead.fuente}</span>
          </p>
          {utm.length > 0 && (
            <p className="text-[11px] text-gray-400 mt-1">
              {utm.map(([k, v]) => `${k}=${v}`).join(" · ")}
            </p>
          )}
          {lead.mensaje && (
            <p className="text-sm text-gray-600 mt-2 whitespace-pre-line border-l-2 border-[#D4AF37] pl-3">
              {lead.mensaje}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <a
            href={`https://wa.me/${lead.telefono}?text=${encodeURIComponent(saludo)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl transition-colors"
          >
            <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
          </a>
          {lead.estado !== "convertido" ? (
            <button
              onClick={convertir}
              disabled={pendiente}
              className="inline-flex items-center gap-1.5 text-xs font-semibold bg-[#0D0D0F] hover:bg-black text-white px-4 py-2 rounded-xl transition-colors disabled:opacity-60"
            >
              {pendiente ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
              Convertir en cliente
            </button>
          ) : (
            lead.cliente_id && (
              <Link
                href="/panel/clientes"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-4 py-2 rounded-xl"
              >
                <Check className="w-3.5 h-3.5" /> Cliente
              </Link>
            )
          )}
        </div>
      </div>

      {lead.estado !== "convertido" && (
        <div className="flex items-center gap-1.5 mt-4 flex-wrap">
          {(Object.keys(ETIQUETAS) as EstadoLead[])
            .filter((e) => e !== "convertido")
            .map((e) => (
              <button
                key={e}
                onClick={() => cambiar(e)}
                disabled={pendiente || e === lead.estado}
                className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                  e === lead.estado
                    ? "border-gray-900 text-gray-900 font-semibold"
                    : "border-gray-200 text-gray-400 hover:border-gray-400 hover:text-gray-600"
                }`}
              >
                {ETIQUETAS[e].nombre}
              </button>
            ))}
        </div>
      )}

      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  );
}
