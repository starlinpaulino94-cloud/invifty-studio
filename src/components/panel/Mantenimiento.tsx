"use client";

import { useRef, useState } from "react";
import {
  sumarAvance, seAtasco, TOTAL_VACIO, type AvanceFotos, type TotalFotos,
} from "@/lib/mantenimiento";
import {
  AlertTriangle, CalendarClock, Check, ImageDown, Loader2, Play, RefreshCw, Sparkles,
} from "lucide-react";

/**
 * LOS DOS TRABAJOS DE MANTENIMIENTO, COMO BOTONES
 * ================================================
 * Antes solo se podían lanzar desde la terminal (`npm run …`). Los scripts
 * siguen ahí y hacen exactamente lo mismo — comparten la lógica en
 * src/lib/ —, pero esto se puede usar desde el celular.
 *
 * Los dos siguen el mismo guion: primero MIRAR, después DECIDIR. Ninguno de
 * los dos botones de arriba escribe nada; el que escribe aparece solo cuando
 * ya hay algo que enseñar.
 */

const CAJA = "bg-white border border-gray-100 rounded-2xl shadow-sm p-6 space-y-4";
const PRIMARIO =
  "inline-flex items-center gap-2 text-xs font-semibold px-4 py-2.5 rounded-xl bg-[#0D0D0F] text-white hover:bg-black transition-all active:scale-95 disabled:opacity-40 disabled:active:scale-100";
const SECUNDARIO =
  "inline-flex items-center gap-2 text-xs font-semibold px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-700 hover:border-gray-400 transition-all active:scale-95 disabled:opacity-40";
const PELIGRO =
  "inline-flex items-center gap-2 text-xs font-semibold px-4 py-2.5 rounded-xl bg-[#B08D2A] text-white hover:bg-[#96771f] transition-all active:scale-95 disabled:opacity-40";

function Aviso({ texto }: { texto: string }) {
  return (
    <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2 flex items-start gap-2">
      <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
      {texto}
    </p>
  );
}

/* ============================================================
   1. RECALCULAR VENCIMIENTOS
   ============================================================ */

interface FilaCambio {
  id: string;
  cliente: string;
  plan: string;
  antes: string | null;
  despues: string;
  revive: boolean;
}

interface Simulacro {
  politica: { nombre: string; meses: number }[];
  revisados: number;
  aAlargar: FilaCambio[];
  seRespetan: FilaCambio[];
  reviven: number;
  guardados?: number;
  fallos?: string[];
}

const RUTA_VENCIMIENTOS = "/api/panel/mantenimiento/vencimientos";

export function RecalculoVencimientos() {
  const [cargando, setCargando] = useState<"simular" | "aplicar" | null>(null);
  const [simulacro, setSimulacro] = useState<Simulacro | null>(null);
  const [aplicado, setAplicado] = useState(false);
  const [error, setError] = useState("");

  const llamar = async (metodo: "GET" | "POST") => {
    setError("");
    setCargando(metodo === "GET" ? "simular" : "aplicar");
    try {
      const res = await fetch(RUTA_VENCIMIENTOS, { method: metodo });
      const datos = await res.json();
      if (!res.ok) throw new Error(datos?.error ?? `Error ${res.status}`);
      setSimulacro(datos);
      setAplicado(metodo === "POST");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo conectar");
    } finally {
      setCargando(null);
    }
  };

  const aplicar = () => {
    const n = simulacro?.aAlargar.length ?? 0;
    if (confirm(`Se van a alargar ${n} pedido(s). ¿Continuar?`)) llamar("POST");
  };

  return (
    <section className={CAJA}>
      <header className="flex items-start gap-3">
        <CalendarClock className="w-5 h-5 text-[#D4AF37] shrink-0 mt-0.5" />
        <div>
          <h2 className="font-semibold text-gray-900">Recalcular vencimientos</h2>
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">
            Los pedidos ya entregados llevan su fecha congelada con la política que
            hubiera ese día. Esto les aplica la de ahora.{" "}
            <strong className="text-gray-700">Solo alarga, nunca acorta:</strong> si la
            política nueva diera una fecha anterior, ese pedido se deja intacto.
          </p>
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => llamar("GET")} disabled={!!cargando} className={PRIMARIO}>
          {cargando === "simular" ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          Ver qué cambiaría
        </button>

        {simulacro && !aplicado && simulacro.aAlargar.length > 0 && (
          <button onClick={aplicar} disabled={!!cargando} className={PELIGRO}>
            {cargando === "aplicar" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            Aplicar los {simulacro.aAlargar.length} cambios
          </button>
        )}
      </div>

      {error && <Aviso texto={error} />}

      {simulacro && (
        <div className="space-y-4 pt-2">
          <p className="text-[11px] text-gray-400">
            Política actual:{" "}
            {simulacro.politica.map((p) => `${p.nombre} ${p.meses} meses`).join(" · ")} ·{" "}
            {simulacro.revisados} pedido(s) revisados
          </p>

          {aplicado && (
            <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2 flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              Listo: {simulacro.guardados ?? 0} pedido(s) actualizados.
              {simulacro.reviven > 0 &&
                ` ${simulacro.reviven} invitación(es) volvieron a publicarse.`}
            </p>
          )}

          {!!simulacro.fallos?.length && <Aviso texto={simulacro.fallos.join(" · ")} />}

          {simulacro.aAlargar.length === 0 ? (
            <p className="text-xs text-gray-500">
              No hay nada que alargar: todos los pedidos ya reflejan la política actual.
            </p>
          ) : (
            <Tabla
              titulo={
                aplicado
                  ? `Alargados — ${simulacro.aAlargar.length}`
                  : `Se alargarían — ${simulacro.aAlargar.length}`
              }
              filas={simulacro.aAlargar}
            />
          )}

          {simulacro.seRespetan.length > 0 && (
            <Tabla
              titulo={`Se dejan como están, la política nueva los acortaría — ${simulacro.seRespetan.length}`}
              filas={simulacro.seRespetan}
              apagada
            />
          )}
        </div>
      )}
    </section>
  );
}

function Tabla({
  titulo,
  filas,
  apagada = false,
}: {
  titulo: string;
  filas: FilaCambio[];
  apagada?: boolean;
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">
        {titulo}
      </p>
      <div className="border border-gray-100 rounded-xl divide-y divide-gray-50 max-h-72 overflow-y-auto">
        {filas.map((f) => (
          <div
            key={f.id}
            className={`flex items-center justify-between gap-3 px-3 py-2 text-xs flex-wrap ${
              apagada ? "text-gray-400" : "text-gray-700"
            }`}
          >
            <span className="font-medium min-w-0 truncate">
              {f.cliente} <span className="text-gray-400 font-normal">· {f.plan}</span>
            </span>
            <span className="tabular-nums shrink-0">
              {apagada ? (
                <>conserva {f.antes}</>
              ) : (
                <>
                  {f.antes ?? "sin fecha"} → <strong>{f.despues}</strong>
                  {f.revive && (
                    <span className="ml-2 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                      vuelve a estar activa
                    </span>
                  )}
                </>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   2. VERSIONES LIGERAS DE LAS FOTOS
   ============================================================ */

const RUTA_FOTOS = "/api/panel/mantenimiento/fotos";
/** Si una tanda falla por red, se reintenta esto antes de rendirse. */
const REINTENTOS = 2;

interface Conteo {
  pedidos: number;
  fotos: number;
  pendientes: number;
}

export function FotosLigeras() {
  const [contando, setContando] = useState(false);
  const [conteo, setConteo] = useState<Conteo | null>(null);
  const [corriendo, setCorriendo] = useState(false);
  const [total, setTotal] = useState<TotalFotos>(TOTAL_VACIO);
  const [terminado, setTerminado] = useState(false);
  const [error, setError] = useState("");
  const cancelar = useRef(false);

  /**
   * `reiniciar` distingue las dos veces que se cuenta: al pulsar "Revisar"
   * se empieza de cero, pero el recuento de después de procesar tiene que
   * dejar en pantalla lo que acaba de pasar — si no, el resumen del trabajo
   * desaparece en el mismo instante en que termina.
   */
  const contar = async (reiniciar = true) => {
    setError("");
    setContando(true);
    if (reiniciar) {
      setTerminado(false);
      setTotal(TOTAL_VACIO);
    }
    try {
      const res = await fetch(RUTA_FOTOS);
      const datos = await res.json();
      if (!res.ok) throw new Error(datos?.error ?? `Error ${res.status}`);
      setConteo(datos);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo conectar");
    } finally {
      setContando(false);
    }
  };

  /** Una tanda, con reintentos: un corte de red no debe tirar todo el trabajo. */
  const tanda = async (cursor: string | null): Promise<AvanceFotos> => {
    let ultimo: unknown;
    for (let intento = 0; intento <= REINTENTOS; intento++) {
      try {
        const res = await fetch(RUTA_FOTOS, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cursor }),
        });
        const datos = await res.json();
        if (!res.ok) throw new Error(datos?.error ?? `Error ${res.status}`);
        return datos as AvanceFotos;
      } catch (e) {
        ultimo = e;
      }
    }
    throw ultimo instanceof Error ? ultimo : new Error("No se pudo conectar");
  };

  const procesar = async () => {
    setError("");
    setCorriendo(true);
    setTerminado(false);
    cancelar.current = false;

    let acumulado = TOTAL_VACIO;
    let cursor: string | null = null;

    try {
      // El bucle vive aquí, en el navegador: cada tanda es una llamada corta
      // que cabe de sobra en el tiempo máximo de una función de servidor.
      for (;;) {
        if (cancelar.current) break;

        const avance = await tanda(cursor);
        acumulado = sumarAvance(acumulado, avance);
        setTotal(acumulado);

        if (seAtasco(cursor, avance)) {
          throw new Error("El proceso dejó de avanzar. Vuelve a revisar y reinténtalo.");
        }

        cursor = avance.cursor;
        if (avance.terminado) {
          setTerminado(true);
          break;
        }
      }
      // Recuento final para confirmar que ya no queda ninguna pendiente.
      await contar(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo conectar");
    } finally {
      setCorriendo(false);
    }
  };

  const pendientes = conteo?.pendientes ?? 0;
  const hechas = total.procesadas + total.fallidas;
  const porcentaje = pendientes > 0 ? Math.min(100, Math.round((hechas / pendientes) * 100)) : 0;

  return (
    <section className={CAJA}>
      <header className="flex items-start gap-3">
        <ImageDown className="w-5 h-5 text-[#D4AF37] shrink-0 mt-0.5" />
        <div>
          <h2 className="font-semibold text-gray-900">Versiones ligeras de las fotos</h2>
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">
            Las fotos que subes hoy generan solas su versión ligera. Las de antes se
            siguen sirviendo desde el original, de 3 a 6 MB cada una, y el invitado las
            descarga con sus datos móviles. Esto se pone al día con ellas.{" "}
            <strong className="text-gray-700">El original nunca se toca</strong> y puedes
            cortar a mitad: al volver, sigue donde iba.
          </p>
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => contar()} disabled={contando || corriendo} className={PRIMARIO}>
          {contando ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          Revisar fotos
        </button>

        {conteo && pendientes > 0 && !corriendo && (
          <button onClick={procesar} className={PELIGRO}>
            <Play className="w-4 h-4" />
            Procesar {pendientes} foto{pendientes === 1 ? "" : "s"}
          </button>
        )}

        {corriendo && (
          <button onClick={() => (cancelar.current = true)} className={SECUNDARIO}>
            Detener
          </button>
        )}
      </div>

      {error && <Aviso texto={error} />}

      {conteo && (
        <p className="text-[11px] text-gray-400">
          {conteo.pedidos} pedido(s) · {conteo.fotos} foto(s) en total ·{" "}
          {pendientes === 0 ? (
            <span className="text-emerald-600 font-medium">
              todas tienen su versión ligera
            </span>
          ) : (
            <span className="text-amber-600 font-medium">{pendientes} sin procesar</span>
          )}
        </p>
      )}

      {(corriendo || total.tandas > 0) && (
        <div className="space-y-2">
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#D4AF37] transition-[width] duration-300"
              style={{ width: `${terminado ? 100 : porcentaje}%` }}
            />
          </div>
          <p className="text-xs text-gray-600 flex items-center gap-2">
            {corriendo && <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />}
            {terminado && <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />}
            {total.procesadas} procesada{total.procesadas === 1 ? "" : "s"}
            {total.fallidas > 0 && ` · ${total.fallidas} sin procesar`}
            {terminado && " · listo"}
          </p>
        </div>
      )}

      {total.fallos.length > 0 && (
        <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 space-y-0.5">
          <p className="font-semibold">Estas se quedaron sin versión ligera:</p>
          {total.fallos.map((f, i) => (
            <p key={i} className="truncate">
              · {f}
            </p>
          ))}
          <p className="text-amber-600 pt-1">
            Se siguen viendo desde el original; la invitación no se rompe.
          </p>
        </div>
      )}
    </section>
  );
}
