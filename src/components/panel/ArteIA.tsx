"use client";

import { useState, useTransition } from "react";
import { Loader2, PenTool, AlertTriangle, RefreshCw, Trash2, Check } from "lucide-react";
import { generarArteIA, type PiezaPropuesta } from "@/lib/acciones-arte";
import { aplicarArte, quitarPieza, PIEZAS_ARTE, type PiezaArteId } from "@/lib/ia/arte";
import { prefijarIds } from "@/lib/ia/svg";
import type { DatosInvitacion } from "@/lib/tipos";

/**
 * ARTE A MEDIDA EN EL EDITOR
 * ===========================
 * Las tres piezas que dejan de ser plantilla: monograma trazado, divisor
 * y esquina, dibujadas para ESTE evento con su paleta.
 *
 * Mismo contrato que los conceptos: "Aplicar" cambia el ESTADO LOCAL, la
 * vista previa en vivo enseña el antes y el después, y nada llega a la
 * base hasta el "Guardar cambios" de siempre. Deshacer es no guardar.
 *
 * Y lo que se enseña aquí es la verdad: si una pieza se rechazó, se dice
 * por qué. Un rechazo callado hace creer que el modelo no sabe dibujar
 * cuando lo que pasó es que se pasó de nodos.
 */

const PREVISTA: Record<PiezaArteId, string> = {
  monograma: "w-24 h-24",
  divisor: "w-full h-10",
  esquina: "w-16 h-16",
};

/** Pinta una pieza propuesta. El SVG ya pasó la aduana en el servidor. */
function Muestra({ pieza, svg }: { pieza: PiezaArteId; svg: string }) {
  const meta = PIEZAS_ARTE.find((p) => p.id === pieza)!;
  const abre = svg.indexOf(">");
  const cierra = svg.lastIndexOf("</svg>");
  const interior = abre !== -1 && cierra > abre ? svg.slice(abre + 1, cierra) : "";
  return (
    <svg
      viewBox={meta.viewBox}
      fill="none"
      className={`${PREVISTA[pieza]} text-[#D4AF37]`}
      aria-hidden
      dangerouslySetInnerHTML={{ __html: prefijarIds(interior, `muestra-${pieza}`) }}
    />
  );
}

export default function ArteIA({
  invitacionId,
  datos,
  onAplicar,
  generador = generarArteIA,
}: {
  invitacionId: string;
  datos: DatosInvitacion;
  onAplicar: (datos: DatosInvitacion) => void;
  /** Quién dibuja. Inyectable para probar la tarjeta sin base de datos. */
  generador?: typeof generarArteIA;
}) {
  const [pendiente, empezar] = useTransition();
  const [propuestas, setPropuestas] = useState<PiezaPropuesta[]>([]);
  const [rechazos, setRechazos] = useState<{ pieza: string; motivo: string }[]>([]);
  const [error, setError] = useState("");
  const [intento, setIntento] = useState(1);
  const [aviso, setAviso] = useState("");
  const [seleccion, setSeleccion] = useState<PiezaArteId[]>(["monograma", "divisor", "esquina"]);

  const dibujar = (siguiente: number) =>
    empezar(async () => {
      setError("");
      setAviso("");
      try {
        const r = await generador(invitacionId, seleccion, siguiente);
        setRechazos(r.rechazos ?? []);
        if (!r.ok) {
          setError(r.error ?? "No se pudo dibujar.");
          return;
        }
        setPropuestas(r.piezas ?? []);
        setIntento(siguiente);
      } catch {
        setError("No se pudo dibujar. Inténtalo de nuevo.");
      }
    });

  const aplicar = (piezas: PiezaPropuesta[]) => {
    const arte = aplicarArte(
      datos.arte,
      piezas.map((p) => ({ ok: true as const, pieza: p.pieza, svg: p.svg, idea: p.idea })),
      new Date().toISOString()
    );
    onAplicar({ ...datos, arte });
    setAviso(
      piezas.length === 1
        ? `${piezas[0].pieza} aplicado. Míralo en la vista previa y guarda para que quede.`
        : "Arte aplicado. Míralo en la vista previa y guarda para que quede."
    );
  };

  const quitar = (pieza: PiezaArteId) => {
    onAplicar({ ...datos, arte: quitarPieza(datos.arte, pieza) });
    setAviso(`Se quitó el ${pieza}: vuelve el ornamento de la plantilla. Guarda para que quede.`);
  };

  const puestas = PIEZAS_ARTE.filter((p) => datos.arte?.[p.id]?.svg);

  return (
    <div className="space-y-4">
      {/* Lo que ya lleva puesto esta invitación */}
      {puestas.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-600">Arte propio de esta invitación</p>
          <div className="grid sm:grid-cols-3 gap-3">
            {puestas.map((p) => (
              <div key={p.id} className="border border-[#D4AF37]/40 bg-[#D4AF37]/5 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-center min-h-20 bg-white rounded-lg">
                  <Muestra pieza={p.id} svg={datos.arte![p.id]!.svg} />
                </div>
                <p className="text-[11px] text-gray-500 leading-snug">{datos.arte![p.id]!.idea}</p>
                <button
                  type="button"
                  onClick={() => quitar(p.id)}
                  className="inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-red-600"
                >
                  <Trash2 className="w-3 h-3" /> Quitar y volver al de la plantilla
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Qué piezas pedir */}
      <div className="flex flex-wrap gap-2">
        {PIEZAS_ARTE.map((p) => {
          const activa = seleccion.includes(p.id);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() =>
                setSeleccion((s) => (activa ? s.filter((x) => x !== p.id) : [...s, p.id]))
              }
              className={`text-xs font-medium px-3 py-2 rounded-xl border transition-colors ${
                activa
                  ? "border-[#D4AF37] bg-[#D4AF37]/10 text-gray-900"
                  : "border-gray-200 text-gray-500 hover:border-gray-300"
              }`}
            >
              {activa && <Check className="w-3 h-3 inline mr-1" />}
              {p.nombre}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => dibujar(propuestas.length ? intento + 1 : 1)}
        disabled={pendiente || seleccion.length === 0}
        className="inline-flex items-center gap-2 bg-[#0D0D0F] text-white text-xs font-semibold px-5 py-3 rounded-xl hover:bg-black disabled:opacity-50 transition-all active:scale-[0.98]"
      >
        {pendiente ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : propuestas.length ? (
          <RefreshCw className="w-4 h-4 text-[#D4AF37]" />
        ) : (
          <PenTool className="w-4 h-4 text-[#D4AF37]" />
        )}
        {pendiente
          ? "Dibujando…"
          : propuestas.length
            ? "Dibujar otra versión"
            : "Dibujar el arte de este evento"}
      </button>

      {pendiente && (
        <p className="text-[11px] text-gray-400">
          Trazar tres piezas tarda; no cierres esta pestaña.
        </p>
      )}

      {error && (
        <p className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
          <span>{error}</span>
        </p>
      )}

      {aviso && (
        <p className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
          {aviso}
        </p>
      )}

      {/* Lo propuesto en esta tanda */}
      {propuestas.length > 0 && (
        <div className="space-y-3">
          <div className="grid sm:grid-cols-3 gap-3">
            {propuestas.map((p) => (
              <div key={p.pieza} className="border border-gray-200 rounded-xl p-3 space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                  {PIEZAS_ARTE.find((x) => x.id === p.pieza)?.nombre}
                </p>
                <div className="flex items-center justify-center min-h-20 bg-white rounded-lg border border-gray-100">
                  <Muestra pieza={p.pieza} svg={p.svg} />
                </div>
                <p className="text-[11px] text-gray-500 leading-snug">{p.idea}</p>
                <button
                  type="button"
                  onClick={() => aplicar([p])}
                  className="w-full text-[11px] font-semibold text-gray-900 border border-gray-200 hover:border-[#D4AF37] rounded-lg py-2 transition-colors"
                >
                  Aplicar solo esta
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => aplicar(propuestas)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#D4AF37] hover:bg-[#F2D06B] text-black text-xs font-semibold px-5 py-3 rounded-xl transition-all active:scale-[0.98]"
          >
            <Check className="w-4 h-4" /> Aplicar las {propuestas.length}
          </button>
        </div>
      )}

      {/* Lo rechazado, con su motivo: callarlo haría creer que el modelo no sabe */}
      {rechazos.length > 0 && (
        <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 space-y-1">
          <p className="font-semibold">Piezas que no pasaron la validación:</p>
          {rechazos.map((r) => (
            <p key={r.pieza}>
              <span className="font-medium">{r.pieza}</span>: {r.motivo}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
