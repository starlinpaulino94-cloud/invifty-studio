"use client";

import { useEffect, useState, FormEvent, useCallback, useSyncExternalStore } from "react";
import {
  Check, Copy, MessageCircle, CalendarPlus, MapPin, Navigation, X,
  ChevronLeft, ChevronRight, Heart, Loader2,
} from "lucide-react";
import { fechaLarga } from "./Marco";
import { useInvitacion } from "./Contexto";
import { sumarHoras, fechaCompacta, HORAS_EVENTO, HORA_POR_DEFECTO, ZONA_HORARIA } from "@/lib/ics";
import { fechaVencida } from "@/lib/fechas";
import type { PreguntaRsvp } from "@/lib/rsvp";
import { FotoInvitacion } from "@/lib/tipos";

/* ============================================================
   CUENTA REGRESIVA
   ============================================================ */

/**
 * El paso del tiempo como fuente externa, para leerlo con
 * useSyncExternalStore. `leerReloj` devuelve el mismo valor durante todo un
 * segundo a propósito: React compara la lectura con la anterior y volvería
 * a renderizar sin parar si cambiara en cada llamada.
 */
function suscribirseAlReloj(alCambiar: () => void): () => void {
  const i = setInterval(alCambiar, 1000);
  return () => clearInterval(i);
}

function leerReloj(): number {
  return Math.floor(Date.now() / 1000) * 1000;
}

function leerRelojEnServidor(): null {
  return null;
}

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

  // El reloj es un dato externo a React, así que se lee con
  // useSyncExternalStore en vez de meter setState dentro de un efecto.
  // En el servidor devuelve null y se pinta "––": el HTML del servidor y el
  // del navegador coinciden y no hay salto al hidratar.
  const ahora = useSyncExternalStore(suscribirseAlReloj, leerReloj, leerRelojEnServidor);
  const montado = ahora !== null;
  const diff = montado ? objetivo - ahora : 0;
  const llego = montado && diff <= 0;

  const t = {
    d: Math.max(Math.floor(diff / 86400000), 0),
    h: Math.max(Math.floor((diff % 86400000) / 3600000), 0),
    m: Math.max(Math.floor((diff % 3600000) / 60000), 0),
    s: Math.max(Math.floor((diff % 60000) / 1000), 0),
  };

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
  const { slug } = useInvitacion();
  if (!fecha) return null;

  /**
   * Dos calendarios porque los invitados viven en dos mundos: Android abre
   * Google Calendar, y el iPhone con calendario de iCloud —que aquí son
   * muchísimos— solo entiende el archivo .ics. Antes ese invitado no tenía
   * cómo guardarse la fecha.
   */
  const horaInicio = hora || HORA_POR_DEFECTO;
  const fin = sumarHoras(fecha, horaInicio, HORAS_EVENTO);
  const urlGoogle =
    `https://calendar.google.com/calendar/render?action=TEMPLATE` +
    `&text=${encodeURIComponent(titulo)}` +
    `&dates=${fechaCompacta(fecha, horaInicio)}/${fechaCompacta(fin.fecha, fin.hora)}` +
    // Sin la zona, Google lee "17:30" en la del que mira: un invitado que
    // viene de Madrid guardaría el evento seis horas corrido.
    `&ctz=${ZONA_HORARIA}` +
    `&location=${encodeURIComponent(lugar)}`;

  const enlace =
    "inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.2em] transition-opacity hover:opacity-70";

  return (
    <div className="flex items-center justify-center gap-5 flex-wrap" style={{ color: "var(--inv-acento)" }}>
      <a href={urlGoogle} target="_blank" rel="noopener noreferrer" className={enlace}>
        <CalendarPlus className="w-4 h-4" />
        Google Calendar
      </a>
      {/* En la página de muestra no hay invitación real detrás del archivo. */}
      {slug && (
        <a href={`/api/invitacion/${slug}/ics`} download="evento.ics" className={enlace}>
          <CalendarPlus className="w-4 h-4" />
          Apple · Outlook
        </a>
      )}
    </div>
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
  preguntas = [],
}: {
  titulo: string;
  whatsapp: string;
  fechaLimite: string;
  acompanantes: boolean;
  /** Preguntas extra que ESTE evento activó en el editor (lib/rsvp.ts). */
  preguntas?: PreguntaRsvp[];
}) {
  const { slug, esBorrador, hogar } = useInvitacion();
  // El enlace personal trae el nombre del hogar puesto (editable: quien
  // confirma puede ser "Juan, de la familia Pérez") y su cupo como tope.
  const [nombre, setNombre] = useState(hogar?.nombre ?? "");
  const [asiste, setAsiste] = useState<"si" | "no">("si");
  const [cantidad, setCantidad] = useState(1);
  const [nota, setNota] = useState("");
  const [respuestas, setRespuestas] = useState<Record<string, string>>({});
  const [enviado, setEnviado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorGuardado, setErrorGuardado] = useState("");
  const maxPersonas = hogar?.cupo ?? 20;

  const mensajeWhatsApp = [
    "💌 *CONFIRMACIÓN DE ASISTENCIA*",
    `Evento: *${titulo}*`,
    "--------------------------------",
    `👤 *Nombre:* ${nombre}`,
    `📌 *Asistencia:* ${asiste === "si" ? "CONFIRMADO ✓" : "No podré asistir"}`,
    asiste === "si" && acompanantes ? `👥 *Total de personas:* ${cantidad}` : "",
    // Las respuestas a las preguntas extra también viajan en el aviso.
    ...(asiste === "si"
      ? preguntas
          .filter((p) => respuestas[p.id])
          .map((p) => `▪ *${p.texto}* ${respuestas[p.id]}`)
      : []),
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
        body: JSON.stringify({
          nombre,
          asiste: asiste === "si",
          cantidad,
          nota,
          hogar: hogar?.token,
          respuestas,
        }),
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

  /**
   * Pasada la fecha límite, el formulario se retira. La puerta de verdad
   * está en la API (la pantalla se la salta cualquiera); esto es para que
   * el invitado tardío no rellene un formulario que va a ser rechazado, y
   * en su lugar tenga el camino que sí funciona: escribirle al anfitrión,
   * que es quien decide si todavía cabe.
   *
   * En la vista previa del equipo se enseña igual: es lo que verían los
   * invitados, y ocultarlo haría publicar una invitación "sin RSVP" sin
   * que nadie entienda por qué.
   */
  if (fechaVencida(fechaLimite)) {
    const mensajeTardio = encodeURIComponent(
      `Hola, soy invitado a "${titulo}". Se me pasó la fecha para confirmar, ¿aún estoy a tiempo?`
    );
    return (
      <div
        className="rounded-lg p-8 text-center"
        style={{ backgroundColor: "var(--inv-tarjeta)", border: "1px solid var(--inv-linea)" }}
      >
        <p className="text-2xl mb-2" style={{ fontFamily: "var(--inv-script)", color: "var(--inv-acento)" }}>
          El período de confirmación ha finalizado
        </p>
        <p className="text-xs leading-relaxed" style={{ color: "var(--inv-texto-suave)" }}>
          La fecha límite era el {fechaLarga(fechaLimite)}. Si aún quieres
          acompañarnos, escríbenos y vemos qué se puede hacer.
        </p>
        {whatsapp && (
          <a
            href={`https://wa.me/${whatsapp}?text=${mensajeTardio}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 w-full rounded-lg py-3.5 text-xs uppercase tracking-[0.22em] flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
            style={{ border: "1px solid var(--inv-acento)", color: "var(--inv-acento)" }}
          >
            <MessageCircle className="w-4 h-4" />
            Escribir a los anfitriones
          </a>
        )}
        {esBorrador && (
          <p className="mt-5 text-[11px]" style={{ color: "var(--inv-texto-suave)" }}>
            Vista previa: los invitados ven esto porque la fecha límite ya pasó.
            Cámbiala en la tarjeta RSVP del editor si no debe estar cerrado.
          </p>
        )}
      </div>
    );
  }

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
      {hogar && (
        <p
          className="text-xs text-center rounded-lg py-2 px-3"
          style={{
            color: "var(--inv-acento)",
            border: "1px solid var(--inv-linea)",
            backgroundColor: "color-mix(in srgb, var(--inv-acento) 8%, transparent)",
          }}
        >
          Invitación para <strong>{hogar.nombre}</strong> · hasta {hogar.cupo}{" "}
          {hogar.cupo === 1 ? "persona" : "personas"}
        </p>
      )}

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
            type="number" min={1} max={maxPersonas}
            value={cantidad}
            onChange={(e) => setCantidad(Number(e.target.value))}
            className={campo}
            style={estiloCampo}
          />
        </div>
      )}

      {/* Las preguntas extra que ESTE evento activó: solo si asiste (a
          quien no viene no se le pregunta el menú), y siempre opcionales
          — una pregunta sin responder no bloquea la confirmación. */}
      {asiste === "si" &&
        preguntas.map((p) => (
          <div key={p.id}>
            <label className="block text-xs mb-1.5" style={{ color: "var(--inv-texto-suave)" }}>
              {p.texto}
            </label>
            {p.tipo === "opciones" ? (
              <select
                value={respuestas[p.id] ?? ""}
                onChange={(e) => setRespuestas({ ...respuestas, [p.id]: e.target.value })}
                className={campo}
                style={estiloCampo}
              >
                <option value="">Elige…</option>
                {(p.opciones ?? []).map((opcion) => (
                  <option key={opcion} value={opcion}>{opcion}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                maxLength={200}
                value={respuestas[p.id] ?? ""}
                onChange={(e) => setRespuestas({ ...respuestas, [p.id]: e.target.value })}
                className={campo}
                style={estiloCampo}
              />
            )}
          </div>
        ))}

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
