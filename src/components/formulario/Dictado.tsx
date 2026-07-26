"use client";

import { useEffect, useRef, useState, useCallback, useSyncExternalStore } from "react";
import { Mic, Square, Loader2 } from "lucide-react";

/**
 * DICTADO POR VOZ
 * ================
 * El cliente toca el micrófono, habla, y su voz se va escribiendo sola
 * en el campo. Usa el reconocimiento de voz del propio navegador
 * (Web Speech API): no cuesta nada y no requiere ninguna clave.
 *
 * Nota de privacidad: la transcripción la hace el servicio de voz del
 * navegador (Google en Chrome, Apple en Safari), no un servidor de
 * Invifty. El audio no se guarda en ningún momento: solo llega el texto.
 *
 * Compatible con Chrome, Edge y Safari (iPhone iOS 14.5+), que es
 * prácticamente todo el público que abre un enlace por WhatsApp.
 * Si el navegador no lo soporta, el micrófono simplemente no aparece
 * y el cliente escribe con el teclado como siempre.
 */

/* ---------- Tipos mínimos de la Web Speech API ---------- */

interface AlternativaVoz {
  transcript: string;
}
interface ResultadoVoz {
  isFinal: boolean;
  0: AlternativaVoz;
}
interface ListaResultadosVoz {
  length: number;
  [indice: number]: ResultadoVoz;
}
interface EventoVoz {
  resultIndex: number;
  results: ListaResultadosVoz;
}
interface EventoErrorVoz {
  error: string;
}
interface Reconocedor {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: EventoVoz) => void) | null;
  onerror: ((e: EventoErrorVoz) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}
interface ConstructorReconocedor {
  new (): Reconocedor;
}

declare global {
  interface Window {
    SpeechRecognition?: ConstructorReconocedor;
    webkitSpeechRecognition?: ConstructorReconocedor;
  }
}

function obtenerConstructor(): ConstructorReconocedor | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

function haySoporteDeVoz(): boolean {
  return !!obtenerConstructor();
}

/** El soporte del navegador no cambia durante la visita: nada a lo que suscribirse. */
function sinCambios(): () => void {
  return () => {};
}

/** Une el texto ya escrito con lo dictado, cuidando espacios y mayúscula inicial. */
function unir(base: string, dictado: string): string {
  const limpio = dictado.replace(/\s+/g, " ").trimStart();
  if (!limpio) return base;

  const previo = base.trimEnd();
  if (!previo) {
    return limpio.charAt(0).toUpperCase() + limpio.slice(1);
  }
  // Si la frase anterior terminó en punto, la nueva empieza en mayúscula
  const trasPunto = /[.!?]$/.test(previo);
  const texto = trasPunto ? limpio.charAt(0).toUpperCase() + limpio.slice(1) : limpio;
  return `${previo} ${texto}`;
}

/** Duración máxima de una toma, por seguridad (3 minutos). */
const LIMITE_MS = 3 * 60 * 1000;

export default function BotonDictado({
  valor,
  onChange,
  etiqueta = "Dictar respuesta",
  compacto = false,
}: {
  valor: string;
  onChange: (v: string) => void;
  etiqueta?: string;
  compacto?: boolean;
}) {
  /**
   * Si el navegador reconoce voz no cambia nunca, así que se lee con
   * useSyncExternalStore en lugar de un efecto que actualice estado. En el
   * servidor devuelve false: el botón aparece al hidratar, sin desajuste.
   */
  const soportado = useSyncExternalStore(sinCambios, haySoporteDeVoz, () => false);
  const [escuchando, setEscuchando] = useState(false);
  const [preparando, setPreparando] = useState(false);
  const [aviso, setAviso] = useState("");

  const reconocedorRef = useRef<Reconocedor | null>(null);
  const baseRef = useRef("");          // texto que había antes de empezar
  const finalRef = useRef("");         // todo lo dictado ya confirmado
  const detenerRef = useRef(false);    // el usuario pidió detener
  const temporizadorRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const detener = useCallback(() => {
    detenerRef.current = true;
    if (temporizadorRef.current) clearTimeout(temporizadorRef.current);
    reconocedorRef.current?.stop();
    setEscuchando(false);
    setPreparando(false);
  }, []);

  // Limpieza al desmontar (cambio de pregunta en el asistente)
  useEffect(() => {
    return () => {
      detenerRef.current = true;
      if (temporizadorRef.current) clearTimeout(temporizadorRef.current);
      reconocedorRef.current?.abort();
    };
  }, []);

  const iniciar = () => {
    const Constructor = obtenerConstructor();
    if (!Constructor) return;

    setAviso("");
    setPreparando(true);
    detenerRef.current = false;
    baseRef.current = valor;
    finalRef.current = "";

    const reconocedor = new Constructor();
    reconocedor.lang = "es-DO";
    reconocedor.continuous = true;
    reconocedor.interimResults = true;
    reconocedor.maxAlternatives = 1;

    reconocedor.onstart = () => {
      setPreparando(false);
      setEscuchando(true);
    };

    reconocedor.onresult = (evento) => {
      let confirmado = "";
      let provisional = "";

      for (let i = evento.resultIndex; i < evento.results.length; i++) {
        const resultado = evento.results[i];
        const texto = resultado[0]?.transcript ?? "";
        if (resultado.isFinal) confirmado += texto;
        else provisional += texto;
      }

      if (confirmado) finalRef.current += confirmado;

      // Lo provisional se muestra en vivo pero aún puede cambiar
      onChange(unir(baseRef.current, finalRef.current + provisional));
    };

    reconocedor.onerror = (evento) => {
      setPreparando(false);
      if (evento.error === "not-allowed" || evento.error === "service-not-allowed") {
        setAviso("Necesitamos permiso para usar el micrófono. Actívalo en tu navegador y vuelve a intentar.");
        detenerRef.current = true;
      } else if (evento.error === "no-speech") {
        setAviso("No escuchamos nada. Acerca el teléfono y habla con claridad.");
      } else if (evento.error === "network") {
        setAviso("Sin conexión para transcribir. Revisa tus datos e inténtalo de nuevo.");
        detenerRef.current = true;
      } else if (evento.error !== "aborted") {
        setAviso("No pudimos continuar con el dictado. Intenta otra vez.");
      }
    };

    reconocedor.onend = () => {
      // En iPhone el reconocimiento se corta solo tras una pausa:
      // si el cliente no pidió detener, lo reanudamos.
      if (!detenerRef.current) {
        try {
          reconocedor.start();
          return;
        } catch {
          /* si no se puede reanudar, terminamos abajo */
        }
      }
      setEscuchando(false);
      setPreparando(false);
      onChange(unir(baseRef.current, finalRef.current));
    };

    reconocedorRef.current = reconocedor;

    try {
      reconocedor.start();
      temporizadorRef.current = setTimeout(detener, LIMITE_MS);
    } catch {
      setPreparando(false);
      setAviso("No pudimos abrir el micrófono. Intenta otra vez.");
    }
  };

  if (!soportado) return null;

  return (
    <div className={compacto ? "" : "mt-3"}>
      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={escuchando || preparando ? detener : iniciar}
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-semibold transition-all active:scale-95 border ${
            escuchando
              ? "bg-[#D4AF37] text-black border-[#D4AF37]"
              : "bg-white/5 text-[#D4AF37] border-[#D4AF37]/40 hover:border-[#D4AF37]"
          }`}
          aria-pressed={escuchando}
          aria-label={escuchando ? "Detener dictado" : etiqueta}
        >
          {preparando ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : escuchando ? (
            <Square className="w-3.5 h-3.5 fill-current" />
          ) : (
            <Mic className="w-4 h-4" />
          )}
          {preparando ? "Preparando…" : escuchando ? "Detener" : etiqueta}
        </button>

        {escuchando && (
          <span className="inline-flex items-center gap-2 text-[11px] text-white/60">
            <span className="flex items-end gap-0.5 h-4" aria-hidden>
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className="w-0.5 bg-[#D4AF37] rounded-full animate-pulse"
                  style={{
                    height: `${[9, 15, 6, 12][i]}px`,
                    animationDelay: `${i * 140}ms`,
                    animationDuration: "900ms",
                  }}
                />
              ))}
            </span>
            Te escuchamos… habla con naturalidad
          </span>
        )}

        {!escuchando && !preparando && !aviso && (
          <span className="text-[11px] text-white/35">o escribe con el teclado</span>
        )}
      </div>

      {aviso && (
        <p className="text-[11px] text-[#F2D06B] mt-2 leading-snug">{aviso}</p>
      )}
    </div>
  );
}
