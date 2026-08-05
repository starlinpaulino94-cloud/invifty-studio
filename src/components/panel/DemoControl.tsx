"use client";

import { useState, useTransition } from "react";
import { Loader2, Star, Globe, X } from "lucide-react";
import { marcarDemo, quitarDemo } from "@/lib/acciones-leads";
import { TIPOS_EVENTO, PLANES } from "@/lib/planes";
import type { Demo, Plan, TipoEvento } from "@/lib/tipos";

/** Controles de una invitación en /panel/demos: marcarla, destacarla, quitarla. */
export default function DemoControl({
  invitacionId,
  tipoEventoPedido,
  demo,
}: {
  invitacionId: string;
  tipoEventoPedido: TipoEvento;
  demo: Demo | null;
}) {
  const [pendiente, empezar] = useTransition();
  const [tipo, setTipo] = useState(demo?.tipo_evento ?? tipoEventoPedido);
  const [plan, setPlan] = useState<Plan>(demo?.plan_minimo ?? "esencial");
  const [destacada, setDestacada] = useState(demo?.destacada ?? false);

  const guardar = () =>
    empezar(async () => {
      await marcarDemo(invitacionId, { tipo_evento: tipo, plan_minimo: plan, destacada });
    });

  const quitar = () => empezar(async () => quitarDemo(invitacionId));

  const select =
    "text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:border-[#D4AF37]";

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={select}>
        {Object.entries(TIPOS_EVENTO).map(([id, nombre]) => (
          <option key={id} value={id}>{nombre}</option>
        ))}
      </select>
      <select value={plan} onChange={(e) => setPlan(e.target.value as Plan)} className={select}>
        {(Object.keys(PLANES) as Plan[]).map((id) => (
          <option key={id} value={id}>Desde {PLANES[id].nombre}</option>
        ))}
      </select>
      <button
        onClick={() => setDestacada(!destacada)}
        title="Destacada en la web"
        className={`p-1.5 rounded-lg border transition-colors ${
          destacada ? "border-[#D4AF37] text-[#D4AF37] bg-[#D4AF37]/10" : "border-gray-200 text-gray-300 hover:text-gray-500"
        }`}
      >
        <Star className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={guardar}
        disabled={pendiente}
        className="inline-flex items-center gap-1.5 text-xs font-semibold bg-[#0D0D0F] hover:bg-black text-white px-3.5 py-2 rounded-xl transition-colors disabled:opacity-60"
      >
        {pendiente ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
        {demo ? "Actualizar" : "Marcar demo"}
      </button>
      {demo && (
        <button
          onClick={quitar}
          disabled={pendiente}
          className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-red-600 px-2 py-2 transition-colors"
        >
          <X className="w-3.5 h-3.5" /> Quitar
        </button>
      )}
    </div>
  );
}
