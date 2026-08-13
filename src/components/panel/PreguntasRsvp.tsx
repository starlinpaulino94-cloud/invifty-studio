"use client";

import { Plus, X } from "lucide-react";
import {
  MAX_PREGUNTAS, MAX_TEXTO_PREGUNTA, MAX_TEXTO_OPCION,
  PREGUNTAS_PREDEFINIDAS, idDePregunta, type PreguntaRsvp,
} from "@/lib/rsvp";

/**
 * LAS PREGUNTAS EXTRA DEL RSVP — el lado del editor
 * ==================================================
 * "No pedir información innecesaria" hecho interfaz: el RSVP nace solo
 * con nombre/asistencia/acompañantes, y aquí el equipo añade ÚNICAMENTE
 * lo que este evento necesita. Menú, alergias y transporte son atajos
 * de un mismo mecanismo genérico; una pregunta propia es una línea más.
 *
 * Muta el estado local del editor (como todo aquí): nada llega a la
 * base hasta «Guardar cambios», y el guardado sanea la configuración
 * (lib/rsvp.ts) por si acaso.
 */

export default function PreguntasRsvp({
  preguntas,
  onChange,
}: {
  preguntas: PreguntaRsvp[];
  onChange: (preguntas: PreguntaRsvp[]) => void;
}) {
  const usados = new Set(preguntas.map((p) => p.id));
  const atajosLibres = PREGUNTAS_PREDEFINIDAS.filter((p) => !usados.has(p.id));
  const llena = preguntas.length >= MAX_PREGUNTAS;

  const cambiar = (i: number, cambios: Partial<PreguntaRsvp>) => {
    onChange(preguntas.map((p, j) => (j === i ? { ...p, ...cambios } : p)));
  };

  const anadirPropia = () => {
    const texto = "¿…?";
    onChange([
      ...preguntas,
      { id: `${idDePregunta(texto)}_${preguntas.length + 1}`, texto: "", tipo: "texto" },
    ]);
  };

  return (
    <div className="mt-4 border-t border-gray-100 pt-4">
      <p className="text-xs font-semibold text-gray-600 mb-1">Preguntas extra (opcionales)</p>
      <p className="text-[11px] text-gray-400 mb-3">
        Solo pregunta lo que este evento necesita: cada campo de más espanta una confirmación.
      </p>

      {preguntas.length > 0 && (
        <ul className="space-y-2 mb-3">
          {preguntas.map((p, i) => (
            <li key={p.id} className="border border-gray-100 rounded-xl p-3 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  value={p.texto}
                  onChange={(e) => cambiar(i, { texto: e.target.value.slice(0, MAX_TEXTO_PREGUNTA) })}
                  placeholder="La pregunta, tal como la verá el invitado"
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-xs"
                />
                <select
                  value={p.tipo}
                  onChange={(e) =>
                    cambiar(
                      i,
                      e.target.value === "opciones"
                        ? { tipo: "opciones", opciones: p.opciones?.length ? p.opciones : ["Sí", "No"] }
                        : { tipo: "texto", opciones: undefined }
                    )
                  }
                  className="border border-gray-200 rounded-lg px-2 py-2 text-xs text-gray-600"
                >
                  <option value="texto">Respuesta libre</option>
                  <option value="opciones">Opciones</option>
                </select>
                <button
                  onClick={() => onChange(preguntas.filter((_, j) => j !== i))}
                  aria-label="Quitar pregunta"
                  className="text-gray-300 hover:text-red-500 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {p.tipo === "opciones" && (
                <input
                  value={(p.opciones ?? []).join(", ")}
                  onChange={(e) =>
                    cambiar(i, {
                      opciones: e.target.value
                        .split(",")
                        .map((o) => o.trimStart().slice(0, MAX_TEXTO_OPCION)),
                    })
                  }
                  placeholder="Opciones separadas por coma: Res, Pollo, Vegetariano"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[11px] text-gray-600"
                />
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-1.5">
        {atajosLibres.map((atajo) => (
          <button
            key={atajo.id}
            onClick={() => onChange([...preguntas, { ...atajo }])}
            disabled={llena}
            className="inline-flex items-center gap-1 text-[11px] text-gray-600 border border-gray-200 hover:border-[#D4AF37] px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-40"
          >
            <Plus className="w-3 h-3" />
            {atajo.id === "menu" ? "Menú" : atajo.id === "alergias" ? "Alergias" : "Transporte"}
          </button>
        ))}
        <button
          onClick={anadirPropia}
          disabled={llena}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#B08D2A] border border-[#D4AF37]/40 hover:bg-[#D4AF37]/10 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-40"
        >
          <Plus className="w-3 h-3" /> Pregunta propia
        </button>
        {llena && (
          <span className="text-[11px] text-gray-400 self-center">
            Máximo {MAX_PREGUNTAS}: más preguntas, menos confirmaciones.
          </span>
        )}
      </div>
    </div>
  );
}
