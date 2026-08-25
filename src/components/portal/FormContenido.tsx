"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { guardarContenidoInvitacion } from "@/lib/acciones-portal";
import { CAMPOS_CONTENIDO } from "@/lib/edicion";
import { Loader2, Save, Check } from "lucide-react";

/**
 * El formulario de los textos. Solo pinta lo que la lista blanca de
 * lib/edicion.ts declara — un campo nuevo se agrega allí, no aquí — y
 * la acción del servidor vuelve a validar todo (permiso, pertenencia,
 * candado y topes) pase lo que pase en este navegador.
 */
export default function FormContenido({
  invitacionId,
  valores,
}: {
  invitacionId: string;
  valores: Record<string, string>;
}) {
  const router = useRouter();
  const [campos, setCampos] = useState(valores);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const [guardado, setGuardado] = useState(false);

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setGuardado(false);
    setCargando(true);
    try {
      await guardarContenidoInvitacion(invitacionId, campos);
      setGuardado(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setCargando(false);
    }
  };

  return (
    <form
      onSubmit={guardar}
      className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-5"
    >
      {CAMPOS_CONTENIDO.map((campo) => (
        <div key={campo.id}>
          <label
            htmlFor={campo.id}
            className="block text-xs text-white/60 mb-1.5 font-medium"
          >
            {campo.etiqueta}
            <span className="text-white/25 font-normal">
              {" "}· {(campos[campo.id] ?? "").length}/{campo.max}
            </span>
          </label>
          {campo.multilinea ? (
            <textarea
              id={campo.id}
              rows={4}
              maxLength={campo.max}
              value={campos[campo.id] ?? ""}
              onChange={(e) => setCampos({ ...campos, [campo.id]: e.target.value })}
              className="w-full bg-black/30 border border-white/15 focus:border-[#D4AF37] rounded-xl px-4 py-3 text-white text-sm focus:outline-none resize-y"
            />
          ) : (
            <input
              id={campo.id}
              type="text"
              maxLength={campo.max}
              value={campos[campo.id] ?? ""}
              onChange={(e) => setCampos({ ...campos, [campo.id]: e.target.value })}
              className="w-full bg-black/30 border border-white/15 focus:border-[#D4AF37] rounded-xl px-4 py-3 text-white text-sm focus:outline-none"
            />
          )}
          {campo.nota && <p className="text-white/25 text-[11px] mt-1">{campo.nota}</p>}
        </div>
      ))}

      {error && (
        <p className="text-red-300 text-xs bg-red-950/40 border border-red-500/30 rounded-xl py-2 px-3">
          {error}
        </p>
      )}
      {guardado && !error && (
        <p className="text-emerald-300 text-xs bg-emerald-950/40 border border-emerald-500/30 rounded-xl py-2 px-3 flex items-center gap-2">
          <Check className="w-3.5 h-3.5" /> Guardado. Tus textos ya están en la invitación.
        </p>
      )}

      <button
        type="submit"
        disabled={cargando}
        className="bg-[#D4AF37] hover:bg-[#F2D06B] disabled:opacity-60 text-black font-semibold text-xs uppercase tracking-[0.2em] py-3 px-5 rounded-xl flex items-center gap-2"
      >
        {cargando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Guardar mis textos
      </button>
    </form>
  );
}
