"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bloque, Pregunta } from "@/config/formularios";
import { CampoTexto, CampoSeleccion, CampoLista, CampoRsvp, CampoFotos } from "./Campos";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Sparkles } from "lucide-react";

interface DatosFormulario {
  estado: string;
  respuestas: Record<string, unknown>;
  bloques: Bloque[];
  limiteFotos: number | null;
  plan: string;
  tipoEvento: string;
  nombreCliente: string;
  fotos: { nombre: string; ruta: string; url?: string }[];
}

type Paso = { bloque: Bloque; pregunta: Pregunta };

export default function Asistente({ token }: { token: string }) {
  const [datos, setDatos] = useState<DatosFormulario | null>(null);
  const [cargando, setCargando] = useState(true);
  const [noEncontrado, setNoEncontrado] = useState(false);

  const [respuestas, setRespuestas] = useState<Record<string, unknown>>({});
  const [fotos, setFotos] = useState<{ nombre: string; ruta: string; url?: string }[]>([]);
  const [indice, setIndice] = useState(-1); // -1 = pantalla de bienvenida
  const [completado, setCompletado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [errorPaso, setErrorPaso] = useState("");
  const [guardado, setGuardado] = useState<"idle" | "guardando" | "ok">("idle");

  // ---------- Carga inicial ----------
  useEffect(() => {
    fetch(`/api/formulario/${token}`)
      .then(async (r) => {
        if (!r.ok) throw new Error();
        const d: DatosFormulario = await r.json();
        setDatos(d);
        setRespuestas(d.respuestas ?? {});
        setCompletado(d.estado === "completado");
        // Vistas previas de fotos existentes
        const conUrl = await Promise.all(
          d.fotos.map(async (f) => {
            const res = await fetch(
              `/api/formulario/${token}/fotos?ruta=${encodeURIComponent(f.ruta)}`
            ).then((x) => x.json());
            return { ...f, url: res.url as string };
          })
        );
        setFotos(conUrl);
      })
      .catch(() => setNoEncontrado(true))
      .finally(() => setCargando(false));
  }, [token]);

  const pasos: Paso[] = useMemo(() => {
    if (!datos) return [];
    return datos.bloques.flatMap((bloque) =>
      bloque.preguntas.map((pregunta) => ({ bloque, pregunta }))
    );
  }, [datos]);

  // Retomar donde quedó: primer paso sin respuesta
  const primerPendiente = useMemo(() => {
    const idx = pasos.findIndex(({ pregunta }) => {
      if (pregunta.tipo === "fotos") return false; // las fotos no bloquean
      const v = respuestas[pregunta.id];
      return v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
    });
    return idx === -1 ? pasos.length - 1 : idx;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pasos.length, datos]);

  // ---------- Autosave (800 ms tras el último cambio) ----------
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const guardar = useCallback(
    (r: Record<string, unknown>) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setGuardado("guardando");
      timerRef.current = setTimeout(async () => {
        try {
          await fetch(`/api/formulario/${token}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ respuestas: r }),
          });
          setGuardado("ok");
        } catch {
          setGuardado("idle");
        }
      }, 800);
    },
    [token]
  );

  const responder = (id: string, valor: unknown) => {
    const nuevas = { ...respuestas, [id]: valor };
    setRespuestas(nuevas);
    setErrorPaso("");
    guardar(nuevas);
  };

  // ---------- Navegación ----------
  const pasoActual = indice >= 0 && indice < pasos.length ? pasos[indice] : null;
  const respondidas = pasos.filter(({ pregunta }) => {
    if (pregunta.tipo === "fotos") return fotos.length > 0;
    const v = respuestas[pregunta.id];
    return v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0);
  }).length;
  const progreso = pasos.length ? Math.round((respondidas / pasos.length) * 100) : 0;

  const validarActual = (): boolean => {
    if (!pasoActual) return true;
    const { pregunta } = pasoActual;
    if (!pregunta.requerida) return true;
    const v = respuestas[pregunta.id];
    const vacio = v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
    if (vacio) {
      setErrorPaso("Este dato es importante para tu invitación 💛");
      return false;
    }
    return true;
  };

  const siguiente = () => {
    if (!validarActual()) return;
    setErrorPaso("");
    if (indice < pasos.length - 1) setIndice(indice + 1);
    else finalizar();
  };

  const atras = () => {
    setErrorPaso("");
    if (indice > -1) setIndice(indice - 1);
  };

  const finalizar = async () => {
    setEnviando(true);
    try {
      const res = await fetch(`/api/formulario/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ respuestas }),
      });
      if (res.ok) setCompletado(true);
    } finally {
      setEnviando(false);
    }
  };

  // Enter para avanzar (excepto en textarea)
  useEffect(() => {
    const manejar = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey && pasoActual && pasoActual.pregunta.tipo !== "textarea") {
        e.preventDefault();
        siguiente();
      }
    };
    window.addEventListener("keydown", manejar);
    return () => window.removeEventListener("keydown", manejar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indice, respuestas, pasoActual]);

  // ---------- Pantallas ----------

  if (cargando) {
    return (
      <Pantalla>
        <Loader2 className="w-8 h-8 text-[#D4AF37] animate-spin mx-auto" />
      </Pantalla>
    );
  }

  if (noEncontrado || !datos) {
    return (
      <Pantalla>
        <div className="text-center max-w-sm mx-auto">
          <h1 className="font-serif text-3xl text-white mb-3">Enlace no válido</h1>
          <p className="text-white/50 text-sm">
            Este formulario no existe o el enlace está incompleto. Verifica el link que
            recibiste por WhatsApp o escríbenos para enviarte uno nuevo.
          </p>
        </div>
      </Pantalla>
    );
  }

  if (completado) {
    return (
      <Pantalla>
        <div className="text-center max-w-md mx-auto animate-aparecer">
          <div className="w-20 h-20 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37] flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-[#D4AF37]" />
          </div>
          <span className="text-[11px] uppercase tracking-[0.4em] text-[#D4AF37] block mb-3 font-semibold">
            ¡Todo listo!
          </span>
          <h1 className="font-serif text-3xl sm:text-4xl text-white mb-4">
            Gracias, {datos.nombreCliente.split(" ")[0]} ✨
          </h1>
          <p className="text-white/60 text-sm leading-relaxed mb-8">
            Recibimos toda la información de tu evento. Nuestro equipo comienza ahora el
            diseño de tu invitación: la recibirás por WhatsApp en un máximo de{" "}
            <strong className="text-white">48 horas laborales</strong>. Si olvidaste algún
            detalle, escríbenos por WhatsApp y lo agregamos sin problema.
          </p>
          <p className="text-[11px] uppercase tracking-[0.3em] text-white/30">
            Invifty · Invitaciones digitales premium
          </p>
        </div>
      </Pantalla>
    );
  }

  // Bienvenida
  if (indice === -1) {
    return (
      <Pantalla>
        <div className="text-center max-w-md mx-auto animate-aparecer">
          <Sparkles className="w-8 h-8 text-[#D4AF37] mx-auto mb-6" />
          <span className="text-[11px] uppercase tracking-[0.4em] text-[#D4AF37] block mb-3 font-semibold">
            Invifty · Plan {datos.plan}
          </span>
          <h1 className="font-serif text-3xl sm:text-5xl text-white mb-4 leading-tight">
            ¡Hola, {datos.nombreCliente.split(" ")[0]}!
          </h1>
          <p className="text-white/60 text-base leading-relaxed mb-3">
            Vamos a crear la invitación de tu evento. Te haremos algunas preguntas — la
            mayoría se responden con un toque.
          </p>
          <p className="text-white/40 text-sm mb-10">
            Tu progreso se guarda automáticamente: puedes salir y volver con este mismo
            link cuando quieras.
          </p>
          <button
            onClick={() => setIndice(primerPendiente)}
            className="bg-[#D4AF37] hover:bg-[#F2D06B] text-black font-semibold text-sm uppercase tracking-[0.2em] px-10 py-4 rounded-full transition-all active:scale-95 shadow-[0_10px_40px_-10px_rgba(212,175,55,0.6)]"
          >
            {respondidas > 0 ? "Continuar donde quedé" : "Comenzar"}
          </button>
          <p className="text-white/30 text-xs mt-5">{pasos.length} preguntas · 5-10 minutos</p>
        </div>
      </Pantalla>
    );
  }

  // Pregunta actual
  const { bloque, pregunta } = pasoActual!;
  const valor = respuestas[pregunta.id];

  return (
    <div className="min-h-dvh bg-[#0D0D0F] flex flex-col">
      {/* Barra de progreso */}
      <div className="fixed top-0 left-0 right-0 z-20">
        <div className="h-1 bg-white/5">
          <div
            className="h-full bg-gradient-to-r from-[#D4AF37] to-[#F2D06B] transition-all duration-500"
            style={{ width: `${progreso}%` }}
          />
        </div>
        <div className="flex items-center justify-between px-5 py-3 text-[10px] uppercase tracking-[0.25em] text-white/40 bg-[#0D0D0F]/80 backdrop-blur-sm">
          <span className="text-[#D4AF37] font-semibold">{bloque.titulo}</span>
          <span>
            {guardado === "guardando" ? "Guardando…" : guardado === "ok" ? "Guardado ✓" : ""}
            <span className="ml-3">{Math.min(indice + 1, pasos.length)} / {pasos.length}</span>
          </span>
        </div>
      </div>

      {/* Contenido */}
      <div className="flex-1 flex items-center justify-center px-5 pt-24 pb-32">
        <div key={pregunta.id} className="w-full max-w-xl animate-aparecer">
          <h2 className="font-serif text-2xl sm:text-3xl text-white leading-snug mb-2">
            {pregunta.titulo}
            {pregunta.requerida && <span className="text-[#D4AF37]"> *</span>}
          </h2>
          {pregunta.subtitulo && (
            <p className="text-white/45 text-sm leading-relaxed mb-6">{pregunta.subtitulo}</p>
          )}
          {!pregunta.subtitulo && <div className="mb-6" />}

          {["texto", "textarea", "fecha", "hora"].includes(pregunta.tipo) && (
            <CampoTexto
              pregunta={pregunta}
              valor={(valor as string) ?? ""}
              onChange={(v) => responder(pregunta.id, v)}
            />
          )}

          {pregunta.tipo === "seleccion" && (
            <CampoSeleccion
              pregunta={pregunta}
              valor={(valor as string | string[]) ?? (pregunta.multiple ? [] : "")}
              onChange={(v) => responder(pregunta.id, v)}
            />
          )}

          {pregunta.tipo === "lista" && (
            <CampoLista
              pregunta={pregunta}
              valor={(valor as Record<string, string>[]) ?? []}
              onChange={(v) => responder(pregunta.id, v)}
            />
          )}

          {pregunta.tipo === "rsvp" && (
            <CampoRsvp
              valor={(valor as { fecha_limite?: string; acompanantes?: "si" | "no" }) ?? {}}
              onChange={(v) => responder(pregunta.id, v)}
            />
          )}

          {pregunta.tipo === "fotos" && (
            <CampoFotos
              pregunta={pregunta}
              token={token}
              fotos={fotos}
              setFotos={setFotos}
              limitePlan={datos.limiteFotos}
            />
          )}

          {errorPaso && (
            <p className="text-[#F2D06B] text-sm mt-4 animate-aparecer">{errorPaso}</p>
          )}
        </div>
      </div>

      {/* Navegación inferior */}
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-[#0D0D0F] via-[#0D0D0F]/95 to-transparent pt-8 pb-6 px-5 z-20">
        <div className="max-w-xl mx-auto flex items-center gap-3">
          <button
            onClick={atras}
            className="rounded-full border border-white/15 text-white/60 hover:text-white hover:border-white/40 p-4 transition-colors active:scale-95"
            aria-label="Pregunta anterior"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <button
            onClick={siguiente}
            disabled={enviando}
            className="flex-1 bg-[#D4AF37] hover:bg-[#F2D06B] disabled:opacity-60 text-black font-semibold text-sm uppercase tracking-[0.2em] py-4 rounded-full transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-[0_10px_40px_-10px_rgba(212,175,55,0.5)]"
          >
            {enviando ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : indice === pasos.length - 1 ? (
              <>Enviar mis respuestas <CheckCircle2 className="w-4 h-4" /></>
            ) : (
              <>Continuar <ArrowRight className="w-4 h-4" /></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function Pantalla({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-[#0D0D0F] flex items-center justify-center px-5 py-16">
      {children}
    </div>
  );
}
