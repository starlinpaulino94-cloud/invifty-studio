"use client";

import { useEffect, useState, FormEvent } from "react";
import { Check, Copy, MessageCircle, Send } from "lucide-react";

/* ============================================================
   Piezas interactivas de la invitación pública.
   Los colores llegan por variables CSS (--inv-*) definidas por
   la plantilla según la paleta elegida.
   ============================================================ */

/* ---------- Cuenta regresiva en vivo ---------- */

export function CuentaRegresiva({ fecha, hora }: { fecha: string; hora: string }) {
  const objetivo = new Date(`${fecha}T${hora || "18:00"}:00`).getTime();
  const [restante, setRestante] = useState({ d: 0, h: 0, m: 0, s: 0 });
  const [listo, setListo] = useState(false);

  useEffect(() => {
    const actualizar = () => {
      const diff = objetivo - Date.now();
      if (diff <= 0) {
        setRestante({ d: 0, h: 0, m: 0, s: 0 });
        return;
      }
      setRestante({
        d: Math.floor(diff / 86400000),
        h: Math.floor((diff % 86400000) / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000),
      });
    };
    actualizar();
    setListo(true);
    const t = setInterval(actualizar, 1000);
    return () => clearInterval(t);
  }, [objetivo]);

  const unidades = [
    { v: restante.d, e: "Días" },
    { v: restante.h, e: "Horas" },
    { v: restante.m, e: "Min" },
    { v: restante.s, e: "Seg" },
  ];

  return (
    <div className="grid grid-cols-4 gap-3 max-w-sm mx-auto" suppressHydrationWarning>
      {unidades.map((u) => (
        <div
          key={u.e}
          className="rounded-2xl py-4 border"
          style={{ backgroundColor: "var(--inv-tarjeta)", borderColor: "var(--inv-acento)" }}
        >
          <span className="block text-3xl font-serif" style={{ color: "var(--inv-acento)" }}>
            {listo ? u.v : "–"}
          </span>
          <span
            className="text-[10px] uppercase tracking-[0.25em]"
            style={{ color: "var(--inv-texto-suave)" }}
          >
            {u.e}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ---------- Copiar cuenta / link de regalo ---------- */

export function CopiarDetalle({ detalle }: { detalle: string }) {
  const [copiado, setCopiado] = useState(false);
  const esLink = /^https?:\/\//i.test(detalle);

  if (esLink) {
    return (
      <a
        href={detalle}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs font-semibold underline underline-offset-4"
        style={{ color: "var(--inv-acento)" }}
      >
        Abrir enlace
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
      className="inline-flex items-center gap-1.5 text-xs font-semibold"
      style={{ color: "var(--inv-acento)" }}
    >
      {copiado ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {copiado ? "¡Copiado!" : "Copiar"}
    </button>
  );
}

/* ---------- Confirmación de asistencia → WhatsApp del anfitrión ---------- */

export function RsvpInvitacion({
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
  const [nombre, setNombre] = useState("");
  const [asiste, setAsiste] = useState<"si" | "no">("si");
  const [cantidad, setCantidad] = useState(1);
  const [nota, setNota] = useState("");
  const [enviado, setEnviado] = useState(false);

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) return;
    const mensaje = [
      `💌 *CONFIRMACIÓN DE ASISTENCIA*`,
      `Evento: *${titulo}*`,
      `--------------------------------`,
      `👤 *Nombre:* ${nombre}`,
      `📌 *Asistencia:* ${asiste === "si" ? "CONFIRMADO ✓" : "No podré asistir"}`,
      asiste === "si" && acompanantes ? `👥 *Total de personas:* ${cantidad}` : "",
      nota ? `📝 *Nota:* ${nota}` : "",
      `--------------------------------`,
      `Enviado desde la invitación digital.`,
    ]
      .filter(Boolean)
      .join("\n");

    window.open(
      `https://wa.me/${whatsapp}?text=${encodeURIComponent(mensaje)}`,
      "_blank",
      "noopener,noreferrer"
    );
    setEnviado(true);
  };

  const campo =
    "w-full rounded-xl px-4 py-3.5 text-sm focus:outline-none border transition-colors";
  const estiloCampo = {
    backgroundColor: "var(--inv-fondo)",
    borderColor: "color-mix(in srgb, var(--inv-acento) 40%, transparent)",
    color: "var(--inv-texto)",
  } as React.CSSProperties;

  if (enviado) {
    return (
      <div
        className="rounded-2xl border p-8 text-center"
        style={{ backgroundColor: "var(--inv-tarjeta)", borderColor: "var(--inv-acento)" }}
      >
        <Check className="w-8 h-8 mx-auto mb-3" style={{ color: "var(--inv-acento)" }} />
        <p className="font-serif text-xl mb-1" style={{ color: "var(--inv-texto)" }}>
          ¡Gracias por confirmar!
        </p>
        <p className="text-xs" style={{ color: "var(--inv-texto-suave)" }}>
          Tu confirmación se abrió en WhatsApp. Si no se envió, vuelve a intentarlo.
        </p>
        <button
          onClick={() => setEnviado(false)}
          className="mt-4 text-xs underline underline-offset-4"
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
      className="rounded-2xl border p-6 sm:p-8 space-y-4"
      style={{
        backgroundColor: "var(--inv-tarjeta)",
        borderColor: "color-mix(in srgb, var(--inv-acento) 40%, transparent)",
      }}
    >
      {fechaLimite && (
        <p className="text-xs text-center italic" style={{ color: "var(--inv-texto-suave)" }}>
          Por favor confirma antes del{" "}
          {new Date(fechaLimite + "T12:00:00").toLocaleDateString("es-DO", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
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
        {(
          [
            { v: "si", e: "✓ Asistiré" },
            { v: "no", e: "No podré ir" },
          ] as const
        ).map((op) => (
          <button
            key={op.v}
            type="button"
            onClick={() => setAsiste(op.v)}
            className="rounded-xl py-3.5 text-sm font-semibold border transition-all active:scale-[0.98]"
            style={
              asiste === op.v
                ? { backgroundColor: "var(--inv-acento)", color: "var(--inv-fondo)", borderColor: "var(--inv-acento)" }
                : { ...estiloCampo }
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
            type="number"
            min={1}
            max={15}
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
        placeholder="Mensaje o nota para los anfitriones (opcional)"
        className={`${campo} resize-none`}
        style={estiloCampo}
      />

      <button
        type="submit"
        className="w-full rounded-xl py-4 text-sm font-bold uppercase tracking-[0.2em] flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
        style={{ backgroundColor: "var(--inv-acento)", color: "var(--inv-fondo)" }}
      >
        <MessageCircle className="w-4 h-4" />
        Confirmar por WhatsApp
      </button>
    </form>
  );
}

/* ---------- Botón agregar al calendario ---------- */

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
  const inicio = `${fecha.replace(/-/g, "")}T${(hora || "18:00").replace(":", "")}00`;
  const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
    titulo
  )}&dates=${inicio}/${inicio}&location=${encodeURIComponent(lugar)}`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 text-xs font-semibold underline underline-offset-4"
      style={{ color: "var(--inv-acento)" }}
    >
      <Send className="w-3.5 h-3.5" />
      Agregar a Google Calendar
    </a>
  );
}
