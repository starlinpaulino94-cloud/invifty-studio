"use client";

import { useEffect, useState, FormEvent, useCallback } from "react";
import {
  Check, Copy, MessageCircle, CalendarPlus, MapPin, Navigation, X,
  ChevronLeft, ChevronRight, Heart, Loader2,
} from "lucide-react";
import { fechaLarga } from "./Marco";
import { useInvitacion } from "./Contexto";
import { FotoInvitacion } from "@/lib/tipos";

/* ============================================================
   CUENTA REGRESIVA
   ============================================================ */

export function Contador({
  fecha,
  hora,
  variante = "tarjetas",
}: {
  fecha: string;
  hora: string;
  variante?: "tarjetas" | "lineal" | "circulos";
}) {
  const objetivo = new Date(`${fecha}T${hora || "18:00"}:00`).getTime();
  const [t, setT] = useState({ d: 0, h: 0, m: 0, s: 0 });
  const [montado, setMontado] = useState(false);
  const [llego, setLlego] = useState(false);

  useEffect(() => {
    const tick = () => {
      const diff = objetivo - Date.now();
      if (diff <= 0) {
        setLlego(true);
        setT({ d: 0, h: 0, m: 0, s: 0 });
        return;
      }
      setT({
        d: Math.floor(diff / 86400000),
        h: Math.floor((diff % 86400000) / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000),
      });
    };
    tick();
    setMontado(true);
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, [objetivo]);

  if (llego) {
    return (
      <p
        className="text-center text-xl sm:text-2xl"
        style={{ fontFamily: "var(--inv-script)", color: "var(--inv-acento)" }}
      >
        ¡Hoy es el gran día!
      </p>
    );
  }

  const unidades = [
    { v: t.d, e: "Días" },
    { v: t.h, e: "Horas" },
    { v: t.m, e: "Min" },
    { v: t.s, e: "Seg" },
  ];
  const valor = (v: number) => (montado ? String(v).padStart(2, "0") : "––");

  if (variante === "lineal") {
    return (
      <div className="flex items-end justify-center gap-5 sm:gap-8" suppressHydrationWarning>
        {unidades.map((u, i) => (
          <div key={u.e} className="flex items-end gap-5 sm:gap-8">
            <div className="text-center">
              <span
                className="block text-4xl sm:text-6xl leading-none tabular-nums"
                style={{ fontFamily: "var(--inv-display)", color: "var(--inv-texto)" }}
              >
                {valor(u.v)}
              </span>
              <span
                className="text-[9px] uppercase tracking-[0.35em] mt-2 block"
                style={{ color: "var(--inv-texto-suave)" }}
              >
                {u.e}
              </span>
            </div>
            {i < unidades.length - 1 && (
              <span className="text-2xl sm:text-4xl pb-6 opacity-30" style={{ color: "var(--inv-acento)" }}>
                ·
              </span>
            )}
          </div>
        ))}
      </div>
    );
  }

  if (variante === "circulos") {
    return (
      <div className="grid grid-cols-4 gap-3 sm:gap-5 max-w-md mx-auto" suppressHydrationWarning>
        {unidades.map((u) => (
          <div key={u.e} className="text-center">
            <div
              className="aspect-square rounded-full flex items-center justify-center mx-auto"
              style={{ border: "1px solid var(--inv-linea)", backgroundColor: "var(--inv-tarjeta)" }}
            >
              <span
                className="text-2xl sm:text-3xl tabular-nums"
                style={{ fontFamily: "var(--inv-display)", color: "var(--inv-acento)" }}
              >
                {valor(u.v)}
              </span>
            </div>
            <span
              className="text-[9px] uppercase tracking-[0.3em] mt-2 block"
              style={{ color: "var(--inv-texto-suave)" }}
            >
              {u.e}
            </span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-4 gap-2.5 sm:gap-3 max-w-md mx-auto" suppressHydrationWarning>
      {unidades.map((u) => (
        <div
          key={u.e}
          className="rounded-lg py-4 sm:py-5"
          style={{ backgroundColor: "var(--inv-tarjeta)", border: "1px solid var(--inv-linea)" }}
        >
          <span
            className="block text-2xl sm:text-3xl tabular-nums leading-none"
            style={{ fontFamily: "var(--inv-display)", color: "var(--inv-acento)" }}
          >
            {valor(u.v)}
          </span>
          <span
            className="text-[9px] uppercase tracking-[0.25em] mt-2 block"
            style={{ color: "var(--inv-texto-suave)" }}
          >
            {u.e}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ============================================================
   BOTONES DE UBICACIÓN Y CALENDARIO
   ============================================================ */

export function BotonesMapa({ direccion }: { direccion: string }) {
  const q = encodeURIComponent(direccion);
  return (
    <div className="flex items-center justify-center gap-2.5 flex-wrap">
      <a
        href={`https://maps.google.com/?q=${q}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[11px] uppercase tracking-[0.18em] transition-opacity hover:opacity-75"
        style={{ border: "1px solid var(--inv-linea)", color: "var(--inv-acento)" }}
      >
        <MapPin className="w-3.5 h-3.5" /> Google Maps
      </a>
      <a
        href={`https://waze.com/ul?q=${q}&navigate=yes`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[11px] uppercase tracking-[0.18em] transition-opacity hover:opacity-75"
        style={{ border: "1px solid var(--inv-linea)", color: "var(--inv-acento)" }}
      >
        <Navigation className="w-3.5 h-3.5" /> Waze
      </a>
    </div>
  );
}

export function BotonCalendario({
  titulo,
  fecha,
  hora,
  lugar,
}: {
  titulo: string;
  fecha: string;
  hora: string;
  lugar: string;
}) {
  if (!fecha) return null;
  const inicio = `${fecha.replace(/-/g, "")}T${(hora || "18:00").replace(":", "")}00`;
  const finHora = String(Number((hora || "18:00").slice(0, 2)) + 5).padStart(2, "0");
  const fin = `${fecha.replace(/-/g, "")}T${finHora}${(hora || "18:00").slice(3, 5)}00`;
  const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
    titulo
  )}&dates=${inicio}/${fin}&location=${encodeURIComponent(lugar)}`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.25em] transition-opacity hover:opacity-70"
      style={{ color: "var(--inv-acento)" }}
    >
      <CalendarPlus className="w-4 h-4" />
      Guardar la fecha
    </a>
  );
}

/* ============================================================
   COPIAR (cuentas bancarias, links de regalo)
   ============================================================ */

export function CopiarDetalle({ detalle }: { detalle: string }) {
  const [copiado, setCopiado] = useState(false);
  const esLink = /^https?:\/\//i.test(detalle);

  if (esLink) {
    return (
      <a
        href={detalle}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[11px] uppercase tracking-[0.15em]"
        style={{ border: "1px solid var(--inv-linea)", color: "var(--inv-acento)" }}
      >
        Abrir
      </a>
    );
  }

  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(detalle);
        setCopiado(true);
        setTimeout(() => setCopiado(false), 2000);
      }}
      className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[11px] uppercase tracking-[0.15em] transition-opacity hover:opacity-75"
      style={{ border: "1px solid var(--inv-linea)", color: "var(--inv-acento)" }}
    >
      {copiado ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {copiado ? "Copiado" : "Copiar"}
    </button>
  );
}

/* ============================================================
   GALERÍA CON VISOR
   ============================================================ */

export function Galeria({
  fotos,
  disposicion = "mosaico",
}: {
  fotos: FotoInvitacion[];
  disposicion?: "mosaico" | "rejilla" | "tira";
}) {
  const [abierta, setAbierta] = useState<number | null>(null);

  const cerrar = useCallback(() => setAbierta(null), []);
  const mover = useCallback(
    (dir: number) =>
      setAbierta((i) => (i === null ? null : (i + dir + fotos.length) % fotos.length)),
    [fotos.length]
  );

  useEffect(() => {
    if (abierta === null) return;
    const teclas = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrar();
      if (e.key === "ArrowRight") mover(1);
      if (e.key === "ArrowLeft") mover(-1);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", teclas);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", teclas);
    };
  }, [abierta, cerrar, mover]);

  if (!fotos.length) return null;

  const clasesContenedor =
    disposicion === "tira"
      ? "flex gap-3 overflow-x-auto pb-3 snap-x"
      : disposicion === "rejilla"
      ? "grid grid-cols-2 sm:grid-cols-3 gap-2.5"
      : "columns-2 sm:columns-3 gap-2.5 [column-fill:_balance]";

  return (
    <>
      <div className={clasesContenedor}>
        {fotos.map((foto, i) => (
          <button
            key={foto.nombre}
            onClick={() => setAbierta(i)}
            className={
              disposicion === "tira"
                ? "shrink-0 w-48 aspect-[3/4] snap-center overflow-hidden rounded-sm"
                : disposicion === "rejilla"
                ? "aspect-square overflow-hidden rounded-sm w-full"
                : "mb-2.5 block w-full overflow-hidden rounded-sm break-inside-avoid"
            }
            style={{ border: "1px solid var(--inv-linea)" }}
            aria-label={`Ampliar foto ${i + 1}`}
          >
            {/* La cuadrícula usa la miniatura; la foto grande solo se
                descarga al abrir el visor. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={foto.urlMiniatura ?? foto.url}
              alt=""
              loading="lazy"
              decoding="async"
              className={`w-full transition-transform duration-700 hover:scale-105 ${
                disposicion === "mosaico" ? "h-auto" : "h-full object-cover"
              }`}
            />
          </button>
        ))}
      </div>

      {/* Visor */}
      {abierta !== null && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/92 backdrop-blur-sm animate-aparecer"
          onClick={cerrar}
        >
          <button
            onClick={cerrar}
            className="absolute top-5 right-5 text-white/70 hover:text-white p-2"
            aria-label="Cerrar"
          >
            <X className="w-7 h-7" />
          </button>

          {fotos.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); mover(-1); }}
                className="absolute left-2 sm:left-6 text-white/60 hover:text-white p-3"
                aria-label="Anterior"
              >
                <ChevronLeft className="w-8 h-8" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); mover(1); }}
                className="absolute right-2 sm:right-6 text-white/60 hover:text-white p-3"
                aria-label="Siguiente"
              >
                <ChevronRight className="w-8 h-8" />
              </button>
            </>
          )}

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={fotos[abierta].url}
            alt=""
            className="max-h-[85dvh] max-w-[92vw] object-contain"
            onClick={(e) => e.stopPropagation()}
          />

          <span className="absolute bottom-6 text-white/50 text-xs tracking-[0.2em]">
            {abierta + 1} / {fotos.length}
          </span>
        </div>
      )}
    </>
  );
}

/* ============================================================
   CONFIRMACIÓN DE ASISTENCIA (RSVP)
   ============================================================ */

export function Rsvp({
  titulo,
  whatsapp,
  fechaLimite,
  acompanantes,
}: {
  titulo: string;
  whatsapp: string;
  fechaLimite: string;
  acompanantes: boolean;
}) {
  const { slug, esBorrador } = useInvitacion();
  const [nombre, setNombre] = useState("");
  const [asiste, setAsiste] = useState<"si" | "no">("si");
  const [cantidad, setCantidad] = useState(1);
  const [nota, setNota] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorGuardado, setErrorGuardado] = useState("");

  const mensajeWhatsApp = [
    "💌 *CONFIRMACIÓN DE ASISTENCIA*",
    `Evento: *${titulo}*`,
    "--------------------------------",
    `👤 *Nombre:* ${nombre}`,
    `📌 *Asistencia:* ${asiste === "si" ? "CONFIRMADO ✓" : "No podré asistir"}`,
    asiste === "si" && acompanantes ? `👥 *Total de personas:* ${cantidad}` : "",
    nota ? `📝 *Nota:* ${nota}` : "",
    "--------------------------------",
    "Enviado desde la invitación digital.",
  ]
    .filter(Boolean)
    .join("\n");

  const urlWhatsApp = `https://wa.me/${whatsapp}?text=${encodeURIComponent(mensajeWhatsApp)}`;

  /**
   * Primero se guarda la confirmación y luego se ofrece avisar por WhatsApp
   * como un enlace aparte. Antes se abría WhatsApp directamente y no se
   * guardaba nada: quien no llegaba a pulsar "enviar" desaparecía sin rastro.
   *
   * El aviso por WhatsApp es un <a> que el invitado pulsa él mismo, y no un
   * window.open después de un await, porque los navegadores móviles bloquean
   * las ventanas que no salen de un gesto directo.
   */
  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || guardando) return;

    // En la vista previa del equipo no se guardan confirmaciones de prueba.
    if (esBorrador) {
      setEnviado(true);
      return;
    }

    setGuardando(true);
    setErrorGuardado("");
    try {
      const res = await fetch(`/api/invitacion/${slug}/rsvp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, asiste: asiste === "si", cantidad, nota }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setErrorGuardado(json.error ?? "No pudimos registrar tu confirmación.");
      }
    } catch {
      setErrorGuardado("No pudimos registrar tu confirmación. Revisa tu conexión.");
    } finally {
      setGuardando(false);
      setEnviado(true);
    }
  };

  const estiloCampo: React.CSSProperties = {
    backgroundColor: "color-mix(in srgb, var(--inv-fondo) 60%, transparent)",
    borderColor: "var(--inv-linea)",
    color: "var(--inv-texto)",
    fontFamily: "var(--inv-cuerpo)",
  };
  const campo = "w-full rounded-lg px-4 py-3.5 text-sm focus:outline-none border transition-colors";

  if (enviado) {
    const guardada = !errorGuardado;
    return (
      <div
        className="rounded-lg p-8 text-center"
        style={{ backgroundColor: "var(--inv-tarjeta)", border: "1px solid var(--inv-acento)" }}
      >
        <Heart className="w-8 h-8 mx-auto mb-3" style={{ color: "var(--inv-acento)" }} />
        <p className="text-2xl mb-2" style={{ fontFamily: "var(--inv-script)", color: "var(--inv-acento)" }}>
          {guardada ? "¡Gracias por confirmar!" : "Casi listo"}
        </p>

        <p className="text-xs leading-relaxed" style={{ color: "var(--inv-texto-suave)" }}>
          {esBorrador
            ? "Vista previa: en la invitación publicada esta confirmación quedaría registrada."
            : guardada
            ? "Tu respuesta quedó registrada. Si quieres, avísale también por WhatsApp."
            : `${errorGuardado} Puedes avisar por WhatsApp para que tu confirmación no se pierda.`}
        </p>

        {!esBorrador && (
          <a
            href={urlWhatsApp}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 w-full rounded-lg py-3.5 text-xs uppercase tracking-[0.22em] flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
            style={
              guardada
                ? { border: "1px solid var(--inv-acento)", color: "var(--inv-acento)" }
                : { backgroundColor: "var(--inv-acento)", color: "var(--inv-fondo)" }
            }
          >
            <MessageCircle className="w-4 h-4" />
            {guardada ? "Avisar por WhatsApp" : "Enviar por WhatsApp"}
          </a>
        )}

        <button
          onClick={() => {
            setEnviado(false);
            setErrorGuardado("");
            setNombre("");
            setNota("");
            setCantidad(1);
          }}
          className="mt-5 text-[11px] uppercase tracking-[0.2em] underline underline-offset-4"
          style={{ color: "var(--inv-acento)" }}
        >
          Confirmar otra persona
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={enviar}
      className="rounded-lg p-6 sm:p-8 space-y-4"
      style={{ backgroundColor: "var(--inv-tarjeta)", border: "1px solid var(--inv-linea)" }}
    >
      {fechaLimite && (
        <p className="text-xs text-center mb-2" style={{ color: "var(--inv-texto-suave)" }}>
          Confirma tu asistencia antes del{" "}
          <strong style={{ color: "var(--inv-acento)" }}>{fechaLarga(fechaLimite)}</strong>
        </p>
      )}

      <input
        type="text"
        required
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        placeholder="Tu nombre completo"
        className={campo}
        style={estiloCampo}
      />

      <div className="grid grid-cols-2 gap-3">
        {([
          { v: "si", e: "Sí, asistiré" },
          { v: "no", e: "No podré ir" },
        ] as const).map((op) => (
          <button
            key={op.v}
            type="button"
            onClick={() => setAsiste(op.v)}
            className="rounded-lg py-3.5 text-sm border transition-all active:scale-[0.98]"
            style={
              asiste === op.v
                ? { backgroundColor: "var(--inv-acento)", color: "var(--inv-fondo)", borderColor: "var(--inv-acento)" }
                : estiloCampo
            }
          >
            {op.e}
          </button>
        ))}
      </div>

      {asiste === "si" && acompanantes && (
        <div>
          <label className="block text-xs mb-1.5" style={{ color: "var(--inv-texto-suave)" }}>
            ¿Cuántas personas asistirán en total (incluyéndote)?
          </label>
          <input
            type="number" min={1} max={20}
            value={cantidad}
            onChange={(e) => setCantidad(Number(e.target.value))}
            className={campo}
            style={estiloCampo}
          />
        </div>
      )}

      <textarea
        rows={2}
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        placeholder="Mensaje para los anfitriones (opcional)"
        className={`${campo} resize-none`}
        style={estiloCampo}
      />

      <button
        type="submit"
        disabled={guardando}
        className="w-full rounded-lg py-4 text-xs uppercase tracking-[0.25em] flex items-center justify-center gap-2 transition-transform active:scale-[0.98] disabled:opacity-70"
        style={{ backgroundColor: "var(--inv-acento)", color: "var(--inv-fondo)" }}
      >
        {guardando ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Enviando…
          </>
        ) : (
          <>
            <Check className="w-4 h-4" />
            Confirmar asistencia
          </>
        )}
      </button>
    </form>
  );
}
