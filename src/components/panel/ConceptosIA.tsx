"use client";

import { useState, useTransition } from "react";
import { Loader2, Sparkles, Wand2, Palette, Type, AlertTriangle, RefreshCw } from "lucide-react";
import { generarConceptosIA } from "@/lib/acciones-ia";
import { aplicarConcepto, type ModoAplicar } from "@/lib/ia/aplicar";
import { PALETAS, TIPOGRAFIAS } from "@/config/diseno";
import { plantillaMeta } from "@/config/plantillas";
import type { ConceptoCreativo } from "@/lib/ia/tipos";
import type { DatosInvitacion } from "@/lib/tipos";

/**
 * CONCEPTOS EN EL EDITOR
 * =======================
 * La IA propone; la mano que guarda es humana. "Aplicar" cambia el ESTADO
 * LOCAL del editor —la vista previa en vivo enseña el antes y el después
 * al instante— y nada llega a la base hasta el "Guardar cambios" de
 * siempre. Deshacer es no guardar.
 *
 * Cada concepto ofrece aplicarse entero, solo el estilo o solo los
 * textos: la regeneración parcial que necesita el trabajo real, donde el
 * cliente ya aprobó los textos pero la paleta no, o al revés.
 */

export default function ConceptosIA({
  invitacionId,
  datos,
  onAplicar,
  generador = generarConceptosIA,
}: {
  invitacionId: string;
  datos: DatosInvitacion;
  onAplicar: (datos: DatosInvitacion, plantilla?: string) => void;
  /** Quién genera. Por defecto la acción del servidor; inyectable para probar la tarjeta sin base de datos. */
  generador?: typeof generarConceptosIA;
}) {
  const [pendiente, empezar] = useTransition();
  const [conceptos, setConceptos] = useState<ConceptoCreativo[]>([]);
  const [avisos, setAvisos] = useState<string[]>([]);
  const [proveedor, setProveedor] = useState("");
  const [intento, setIntento] = useState(1);
  const [error, setError] = useState("");
  const [aplicado, setAplicado] = useState("");

  const generar = (siguienteIntento: number) =>
    empezar(async () => {
      setError("");
      setAplicado("");
      try {
        const r = await generador(invitacionId, siguienteIntento);
        if (!r.ok) {
          setError(r.error ?? "No se pudo generar.");
          return;
        }
        setConceptos(r.conceptos ?? []);
        setAvisos(r.avisos ?? []);
        setProveedor(r.proveedor ?? "");
        setIntento(siguienteIntento);
      } catch {
        setError("No se pudo generar. Inténtalo de nuevo.");
      }
    });

  const aplicar = (concepto: ConceptoCreativo, modo: ModoAplicar) => {
    const resultado = aplicarConcepto(datos, concepto, modo);
    onAplicar(resultado.datos, resultado.plantilla);
    setAplicado(`${concepto.nombre} (${modo === "todo" ? "completo" : modo})`);
  };

  return (
    <div>
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => generar(conceptos.length > 0 ? intento + 1 : intento)}
          disabled={pendiente}
          className="inline-flex items-center gap-2 bg-[#0D0D0F] hover:bg-black text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-colors disabled:opacity-60"
        >
          {pendiente ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : conceptos.length > 0 ? (
            <RefreshCw className="w-4 h-4 text-[#D4AF37]" />
          ) : (
            <Sparkles className="w-4 h-4 text-[#D4AF37]" />
          )}
          {conceptos.length > 0 ? "Proponer otros tres" : "Proponer 3 conceptos"}
        </button>
        {proveedor && (
          <span className="text-[11px] text-gray-400">
            propuesta {intento} · proveedor: {proveedor}
          </span>
        )}
      </div>

      {error && <p className="text-xs text-red-600 mt-3">{error}</p>}

      {avisos.map((aviso, i) => (
        <p key={i} className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3 flex items-start gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" /> {aviso}
        </p>
      ))}

      {aplicado && (
        <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 mt-3">
          Aplicado: {aplicado}. Míralo en la vista previa — nada se guarda hasta «Guardar cambios».
        </p>
      )}

      {conceptos.length > 0 && (
        <div className="grid sm:grid-cols-3 gap-3 mt-4">
          {conceptos.map((c) => {
            const paleta = PALETAS[c.paleta];
            return (
              <div key={c.nombre} className="border border-gray-200 rounded-xl p-4 flex flex-col">
                {/* La paleta se enseña, no se describe */}
                <div className="flex items-center gap-1.5 mb-2">
                  {paleta &&
                    [paleta.fondo, paleta.tarjeta, paleta.acento, paleta.texto].map((color) => (
                      <span
                        key={color}
                        className="w-4 h-4 rounded-full border border-black/10"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                </div>
                <p className="text-sm font-bold text-gray-900">{c.nombre}</p>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed flex-1">{c.idea}</p>
                <p className="text-[11px] text-gray-400 mt-2">
                  {plantillaMeta(c.plantilla).nombre} · {paleta?.nombre ?? c.paleta} ·{" "}
                  {TIPOGRAFIAS[c.tipografia]?.nombre ?? c.tipografia}
                </p>
                {c.copy.frase && (
                  <p className="text-xs italic text-gray-600 mt-2 border-l-2 border-[#D4AF37] pl-2">
                    “{c.copy.frase}”
                  </p>
                )}
                {c.riesgo && (
                  <p className="text-[11px] text-amber-700 mt-2">⚠ {c.riesgo}</p>
                )}
                <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                  <button
                    onClick={() => aplicar(c, "todo")}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold bg-[#D4AF37] hover:bg-[#F2D06B] text-black px-2.5 py-1.5 rounded-lg transition-colors"
                  >
                    <Wand2 className="w-3 h-3" /> Aplicar
                  </button>
                  <button
                    onClick={() => aplicar(c, "estilo")}
                    title="Solo plantilla, paleta y tipografía"
                    className="inline-flex items-center gap-1 text-[11px] text-gray-600 border border-gray-200 hover:border-gray-400 px-2.5 py-1.5 rounded-lg transition-colors"
                  >
                    <Palette className="w-3 h-3" /> Estilo
                  </button>
                  <button
                    onClick={() => aplicar(c, "textos")}
                    title="Solo subtítulo, frase y despedida"
                    className="inline-flex items-center gap-1 text-[11px] text-gray-600 border border-gray-200 hover:border-gray-400 px-2.5 py-1.5 rounded-lg transition-colors"
                  >
                    <Type className="w-3 h-3" /> Textos
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
