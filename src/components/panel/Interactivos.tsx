"use client";

import { useState, useTransition } from "react";
import { cambiarEstado, marcarFormularioEnviado, eliminarPago } from "@/lib/acciones";
import { ESTADOS, colorEstado, nombreEstado } from "@/lib/planes";
import { EstadoPedido } from "@/lib/tipos";
import { Check, Copy, Loader2, MessageCircle, Trash2 } from "lucide-react";

/* ---------- Selector de estado (un clic) ---------- */

export function SelectorEstado({
  pedidoId,
  estado,
}: {
  pedidoId: string;
  estado: EstadoPedido;
}) {
  const [pendiente, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap gap-1.5">
      {ESTADOS.map((e) => {
        const activo = e.id === estado;
        return (
          <button
            key={e.id}
            disabled={pendiente}
            onClick={() => startTransition(() => cambiarEstado(pedidoId, e.id))}
            className={`text-[11px] font-medium px-3 py-1.5 rounded-full border transition-all disabled:opacity-50 ${
              activo
                ? `${e.color} border-transparent ring-2 ring-offset-1 ring-[#D4AF37]`
                : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
            }`}
          >
            {e.nombre}
          </button>
        );
      })}
      {pendiente && <Loader2 className="w-4 h-4 animate-spin text-gray-400 self-center" />}
    </div>
  );
}

/* ---------- Chip de estado (solo lectura) ---------- */

export function ChipEstado({ estado }: { estado: EstadoPedido }) {
  return (
    <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${colorEstado(estado)}`}>
      {nombreEstado(estado)}
    </span>
  );
}

/* ---------- Botón copiar (texto genérico) ---------- */

export function BotonCopiar({
  texto,
  etiqueta = "Copiar",
  className = "",
}: {
  texto: string;
  etiqueta?: string;
  className?: string;
}) {
  const [copiado, setCopiado] = useState(false);

  const copiar = async () => {
    await navigator.clipboard.writeText(texto);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  return (
    <button
      onClick={copiar}
      className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
        copiado
          ? "bg-emerald-50 border-emerald-300 text-emerald-700"
          : "bg-white border-gray-200 text-gray-600 hover:border-gray-400"
      } ${className}`}
    >
      {copiado ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {copiado ? "¡Copiado!" : etiqueta}
    </button>
  );
}

/* ---------- Copiar mensaje de WhatsApp (y marcar formulario enviado) ---------- */

export function BotonMensajeWhatsApp({
  pedidoId,
  mensaje,
  telefono,
}: {
  pedidoId: string;
  mensaje: string;
  telefono: string;
}) {
  const [copiado, setCopiado] = useState(false);
  const [, startTransition] = useTransition();

  const copiar = async () => {
    await navigator.clipboard.writeText(mensaje);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
    startTransition(() => marcarFormularioEnviado(pedidoId));
  };

  const urlWhatsApp = `https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}`;

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={copiar}
        className={`inline-flex items-center gap-2 text-xs font-semibold px-4 py-2.5 rounded-xl transition-all active:scale-95 ${
          copiado ? "bg-emerald-600 text-white" : "bg-[#0D0D0F] text-white hover:bg-black"
        }`}
      >
        {copiado ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        {copiado ? "¡Mensaje copiado!" : "Copiar mensaje para WhatsApp"}
      </button>
      <a
        href={urlWhatsApp}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => startTransition(() => marcarFormularioEnviado(pedidoId))}
        className="inline-flex items-center gap-2 text-xs font-semibold px-4 py-2.5 rounded-xl bg-[#25D366] text-white hover:opacity-90 transition-all active:scale-95"
      >
        <MessageCircle className="w-4 h-4" />
        Abrir chat de WhatsApp
      </a>
    </div>
  );
}

/* ---------- Eliminar pago ---------- */

export function BotonEliminarPago({ pagoId, pedidoId }: { pagoId: string; pedidoId: string }) {
  const [pendiente, startTransition] = useTransition();
  return (
    <button
      disabled={pendiente}
      onClick={() => {
        if (confirm("¿Eliminar este abono?")) {
          startTransition(() => eliminarPago(pagoId, pedidoId));
        }
      }}
      className="text-gray-300 hover:text-red-500 transition-colors p-1"
      aria-label="Eliminar abono"
    >
      {pendiente ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
    </button>
  );
}
