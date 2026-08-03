"use client";

import { useCallback, useEffect, useRef, useState, ReactNode } from "react";
import { Music, Volume2, VolumeX } from "lucide-react";
import { Monograma } from "./Ornamentos";

/* ============================================================
   SOBRE LACRADO — la primera impresión
   El invitado ve un sobre cerrado con lacre; al tocarlo, la solapa
   se abre y la invitación emerge. Es el momento "wow".
   ============================================================ */

export function SobreApertura({
  iniciales,
  etiqueta,
  onAbrir,
}: {
  iniciales: string;
  etiqueta: string;
  onAbrir: () => void;
}) {
  const [abriendo, setAbriendo] = useState(false);

  const abrir = () => {
    if (abriendo) return;
    setAbriendo(true);
    setTimeout(onAbrir, 1500);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center px-6 cursor-pointer select-none"
      style={{ backgroundColor: "var(--inv-fondo)" }}
      onClick={abrir}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && abrir()}
      aria-label="Abrir invitación"
    >
      <div
        className={`relative transition-all duration-[1200ms] ease-[cubic-bezier(.22,1,.36,1)] ${
          abriendo ? "scale-125 opacity-0 -translate-y-6" : "scale-100 opacity-100"
        }`}
      >
        {/* Cuerpo del sobre */}
        <div
          className="relative w-[280px] h-[190px] sm:w-[340px] sm:h-[230px] rounded-sm shadow-2xl"
          style={{
            backgroundColor: "var(--inv-tarjeta)",
            border: "1px solid var(--inv-linea)",
          }}
        >
          {/* Solapa que se abre */}
          <div
            className="absolute inset-x-0 top-0 origin-top transition-transform duration-1000 ease-in-out"
            style={{
              height: "58%",
              transform: abriendo ? "rotateX(180deg)" : "rotateX(0deg)",
              transformStyle: "preserve-3d",
              zIndex: abriendo ? 0 : 3,
            }}
          >
            <svg viewBox="0 0 340 134" className="w-full h-full" preserveAspectRatio="none" aria-hidden>
              <polygon
                points="0,0 340,0 170,134"
                fill="var(--inv-tarjeta)"
                stroke="var(--inv-linea)"
                strokeWidth="1"
              />
            </svg>
          </div>

          {/* Interior visible al abrir */}
          <div
            className="absolute inset-2 rounded-sm"
            style={{ backgroundColor: "color-mix(in srgb, var(--inv-acento) 8%, var(--inv-fondo))" }}
          />

          {/* Líneas laterales del sobre */}
          <svg viewBox="0 0 340 230" className="absolute inset-0 w-full h-full" preserveAspectRatio="none" aria-hidden>
            <path d="M0 0l170 134L340 0M0 230l130-96M340 230l-130-96"
              stroke="var(--inv-linea)" strokeWidth="1" fill="none" />
          </svg>

          {/* Lacre con monograma */}
          <div
            className={`absolute left-1/2 top-[58%] -translate-x-1/2 -translate-y-1/2 z-10 transition-all duration-500 ${
              abriendo ? "scale-0 opacity-0" : "scale-100"
            }`}
            style={{ color: "var(--inv-acento)" }}
          >
            <div
              className="w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-full flex items-center justify-center shadow-lg"
              style={{
                background: "radial-gradient(circle at 35% 30%, var(--inv-acento-claro), var(--inv-acento))",
              }}
            >
              <span
                className="text-lg sm:text-xl tracking-[0.1em]"
                style={{ fontFamily: "var(--inv-display)", color: "var(--inv-fondo)" }}
              >
                {iniciales}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Llamado a tocar */}
      <div
        className={`mt-10 text-center transition-opacity duration-500 ${abriendo ? "opacity-0" : "opacity-100"}`}
        style={{ color: "var(--inv-texto-suave)" }}
      >
        <p
          className="text-[10px] uppercase tracking-[0.45em] mb-2 animate-pulse"
          style={{ color: "var(--inv-acento)" }}
        >
          Toca para abrir
        </p>
        <p className="text-sm" style={{ fontFamily: "var(--inv-script)", fontSize: "1.35rem" }}>
          {etiqueta}
        </p>
      </div>
    </div>
  );
}

/* ============================================================
   REVELAR AL DESPLAZAR
   Cada bloque entra con un fundido suave cuando aparece en pantalla.
   ============================================================ */

export function Revelar({
  children,
  retraso = 0,
  desde = "abajo",
  className = "",
}: {
  children: ReactNode;
  retraso?: number;
  desde?: "abajo" | "izquierda" | "derecha" | "escala";
  className?: string;
}) {
  const [visible, setVisible] = useState(false);

  /**
   * Se observa desde la propia referencia en lugar de un efecto: React 19
   * admite que un callback de ref devuelva su limpieza, y así el observador
   * se crea justo cuando el nodo existe, sin renders en cascada.
   */
  const referencia = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;

    // Si el navegador no soporta el observador, mostramos sin animación
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }

    const obs = new IntersectionObserver(
      ([entrada]) => {
        if (entrada.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const oculto: Record<string, string> = {
    abajo: "translateY(28px)",
    izquierda: "translateX(-28px)",
    derecha: "translateX(28px)",
    escala: "scale(0.94)",
  };

  return (
    <div
      ref={referencia}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "none" : oculto[desde],
        transition: `opacity .9s ease-out ${retraso}ms, transform 1s cubic-bezier(.22,1,.36,1) ${retraso}ms`,
        willChange: "opacity, transform",
      }}
    >
      {children}
    </div>
  );
}

/* ============================================================
   TEXTURA DE PAPEL
   Grano sutil sobre toda la invitación: le quita el aspecto "plano
   de pantalla" y la acerca a una pieza impresa.
   ============================================================ */

export function TexturaPapel({ intensidad = 0.05 }: { intensidad?: number }) {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-[60] mix-blend-overlay"
      style={{
        opacity: intensidad,
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)'/%3E%3C/svg%3E\")",
      }}
      aria-hidden
    />
  );
}

/** Viñeta suave en los bordes, como una fotografía revelada. */
export function Vineta({ oscura }: { oscura: boolean }) {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-[55]"
      style={{
        background: oscura
          ? "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,.45) 100%)"
          : "radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,.10) 100%)",
      }}
      aria-hidden
    />
  );
}

/* ============================================================
   MÚSICA DE FONDO
   Botón flotante discreto. Respeta el bloqueo de autoplay:
   arranca cuando el invitado abre el sobre o toca el botón.
   ============================================================ */

export function Musica({ url, autoIniciar }: { url: string; autoIniciar?: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [sonando, setSonando] = useState(false);

  useEffect(() => {
    if (!autoIniciar || !audioRef.current) return;
    audioRef.current
      .play()
      .then(() => setSonando(true))
      .catch(() => setSonando(false)); // el navegador puede bloquearlo
  }, [autoIniciar]);

  const alternar = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (sonando) {
      audio.pause();
      setSonando(false);
    } else {
      audio.play().then(() => setSonando(true)).catch(() => {});
    }
  };

  if (!url) return null;

  return (
    <>
      <audio ref={audioRef} src={url} loop preload="none" />
      <button
        onClick={alternar}
        className="fixed bottom-5 right-5 z-[70] w-12 h-12 rounded-full flex items-center justify-center shadow-xl transition-transform active:scale-90 backdrop-blur-sm"
        style={{
          backgroundColor: "color-mix(in srgb, var(--inv-tarjeta) 85%, transparent)",
          border: "1px solid var(--inv-linea)",
          color: "var(--inv-acento)",
        }}
        aria-label={sonando ? "Silenciar música" : "Reproducir música"}
        title={sonando ? "Silenciar música" : "Reproducir música"}
        aria-pressed={sonando}
      >
        {sonando ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
        {sonando && (
          <span
            className="absolute inset-0 rounded-full animate-ping opacity-30"
            style={{ border: "1px solid var(--inv-acento)" }}
          />
        )}
      </button>
    </>
  );
}

/** Aviso sutil de que la invitación tiene música (aparece al abrir). */
export function AvisoMusica() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 5000);
    return () => clearTimeout(t);
  }, []);
  if (!visible) return null;
  return (
    <div
      className="fixed bottom-20 right-5 z-[70] px-3.5 py-2 rounded-full text-[11px] shadow-lg backdrop-blur-sm animate-aparecer"
      style={{
        backgroundColor: "color-mix(in srgb, var(--inv-tarjeta) 90%, transparent)",
        border: "1px solid var(--inv-linea)",
        color: "var(--inv-texto-suave)",
      }}
    >
      <span className="inline-flex items-center gap-1.5">
        <Music className="w-3 h-3" style={{ color: "var(--inv-acento)" }} />
        Activa el sonido
      </span>
    </div>
  );
}

/* ============================================================
   MONOGRAMA FLOTANTE (marca de agua de portada)
   ============================================================ */

export function MonogramaPortada({ iniciales }: { iniciales: string }) {
  return (
    <div className="animate-aparecer" style={{ color: "var(--inv-acento)" }}>
      <Monograma iniciales={iniciales} className="w-24 h-24 sm:w-28 sm:h-28" />
    </div>
  );
}
