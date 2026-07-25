"use client";

import { useRef, useState } from "react";
import { Pregunta } from "@/config/formularios";
import { Check, Plus, Trash2, Upload, Loader2, X, PencilLine } from "lucide-react";

/* ============================================================
   Campos del asistente — todos oscuros/dorados, pensados para celular
   ============================================================ */

const inputBase =
  "w-full bg-white/5 border border-white/15 focus:border-[#D4AF37] rounded-2xl px-5 py-4 text-lg text-white placeholder-white/25 focus:outline-none transition-colors";

export function CampoTexto({
  pregunta,
  valor,
  onChange,
}: {
  pregunta: Pregunta;
  valor: string;
  onChange: (v: string) => void;
}) {
  if (pregunta.tipo === "textarea") {
    return (
      <textarea
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder={pregunta.placeholder}
        rows={5}
        autoFocus
        className={`${inputBase} resize-none leading-relaxed`}
      />
    );
  }
  const tipo = pregunta.tipo === "fecha" ? "date" : pregunta.tipo === "hora" ? "time" : "text";
  return (
    <input
      type={tipo}
      value={valor}
      onChange={(e) => onChange(e.target.value)}
      placeholder={pregunta.placeholder}
      autoFocus={tipo === "text"}
      className={`${inputBase} [color-scheme:dark]`}
    />
  );
}

/* ---------- Selección visual con tarjetas + "Otro" ---------- */

export function CampoSeleccion({
  pregunta,
  valor,
  onChange,
}: {
  pregunta: Pregunta;
  valor: string | string[];
  onChange: (v: string | string[]) => void;
}) {
  const opciones = pregunta.opciones ?? [];
  const multiple = !!pregunta.multiple;
  const valores = multiple ? (Array.isArray(valor) ? valor : []) : [];
  const valorSimple = !multiple && typeof valor === "string" ? valor : "";
  const esOtro =
    !multiple && valorSimple !== "" && !opciones.some((o) => o.valor === valorSimple);
  const [modoOtro, setModoOtro] = useState(esOtro);

  const alternar = (v: string) => {
    if (multiple) {
      onChange(valores.includes(v) ? valores.filter((x) => x !== v) : [...valores, v]);
    } else {
      setModoOtro(false);
      onChange(v);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {opciones.map((op) => {
          const activa = multiple ? valores.includes(op.valor) : valorSimple === op.valor;
          return (
            <button
              key={op.valor}
              type="button"
              onClick={() => alternar(op.valor)}
              className={`text-left rounded-2xl border p-4 transition-all active:scale-[0.98] flex items-start gap-3 min-h-[64px] ${
                activa
                  ? "border-[#D4AF37] bg-[#D4AF37]/10 shadow-[0_0_20px_-8px_rgba(212,175,55,0.5)]"
                  : "border-white/15 bg-white/5 hover:border-white/30"
              }`}
            >
              {op.colores ? (
                <span className="flex gap-1 mt-1 shrink-0">
                  {op.colores.map((c) => (
                    <span
                      key={c}
                      className="w-5 h-5 rounded-full border border-white/20"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </span>
              ) : (
                <span className="text-2xl leading-none mt-0.5">{op.emoji ?? "•"}</span>
              )}
              <span className="flex-1">
                <span className="block text-white font-medium text-[15px]">{op.etiqueta}</span>
                {op.descripcion && (
                  <span className="block text-white/40 text-xs mt-0.5">{op.descripcion}</span>
                )}
              </span>
              {activa && <Check className="w-5 h-5 text-[#D4AF37] shrink-0 mt-1" />}
            </button>
          );
        })}

        {/* Otro / Prefiero escribirlo yo */}
        {!multiple && (
          <button
            type="button"
            onClick={() => {
              setModoOtro(true);
              if (!esOtro) onChange("");
            }}
            className={`text-left rounded-2xl border p-4 transition-all active:scale-[0.98] flex items-start gap-3 min-h-[64px] ${
              modoOtro
                ? "border-[#D4AF37] bg-[#D4AF37]/10"
                : "border-dashed border-white/20 bg-transparent hover:border-white/40"
            }`}
          >
            <PencilLine className="w-5 h-5 text-[#D4AF37] mt-1 shrink-0" />
            <span className="text-white/80 font-medium text-[15px]">
              Otro / Prefiero escribirlo yo
            </span>
          </button>
        )}
      </div>

      {modoOtro && !multiple && (
        <input
          type="text"
          autoFocus
          value={esOtro || modoOtro ? valorSimple : ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Escríbelo aquí con tus palabras…"
          className={inputBase}
        />
      )}
    </div>
  );
}

/* ---------- Constructor de listas (cronograma, regalos, ponentes) ---------- */

type Item = Record<string, string>;

export function CampoLista({
  pregunta,
  valor,
  onChange,
}: {
  pregunta: Pregunta;
  valor: Item[];
  onChange: (v: Item[]) => void;
}) {
  const items = Array.isArray(valor) ? valor : [];
  const campos = pregunta.campos ?? [];

  const vacio = Object.fromEntries(campos.map((c) => [c.id, ""]));
  const agregar = () => onChange([...items, { ...vacio }]);
  const actualizar = (idx: number, campoId: string, v: string) => {
    const copia = items.map((it, i) => (i === idx ? { ...it, [campoId]: v } : it));
    onChange(copia);
  };
  const eliminar = (idx: number) => onChange(items.filter((_, i) => i !== idx));

  return (
    <div className="space-y-3">
      {items.map((item, idx) => (
        <div
          key={idx}
          className="rounded-2xl border border-white/15 bg-white/5 p-4 flex flex-col sm:flex-row gap-3 items-stretch"
        >
          {campos.map((campo) => (
            <input
              key={campo.id}
              type={campo.tipo === "hora" ? "time" : "text"}
              value={item[campo.id] ?? ""}
              onChange={(e) => actualizar(idx, campo.id, e.target.value)}
              placeholder={campo.placeholder ?? campo.etiqueta}
              className={`bg-black/30 border border-white/10 focus:border-[#D4AF37] rounded-xl px-4 py-3 text-white text-sm focus:outline-none [color-scheme:dark] ${
                campo.tipo === "hora" ? "sm:w-32" : "flex-1"
              }`}
            />
          ))}
          <button
            type="button"
            onClick={() => eliminar(idx)}
            className="self-center text-white/30 hover:text-red-400 p-2 transition-colors"
            aria-label="Eliminar"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={agregar}
        className="w-full rounded-2xl border border-dashed border-[#D4AF37]/40 text-[#D4AF37] py-4 flex items-center justify-center gap-2 text-sm font-medium hover:bg-[#D4AF37]/5 transition-colors"
      >
        <Plus className="w-4 h-4" />
        {pregunta.textoAgregar ?? "Agregar"}
      </button>
    </div>
  );
}

/* ---------- Configuración de RSVP ---------- */

interface ValorRsvp {
  fecha_limite?: string;
  acompanantes?: "si" | "no";
}

export function CampoRsvp({
  valor,
  onChange,
}: {
  valor: ValorRsvp;
  onChange: (v: ValorRsvp) => void;
}) {
  const v = valor ?? {};
  return (
    <div className="space-y-6">
      <div>
        <label className="block text-white/70 text-sm mb-2 font-medium">
          ¿Hasta qué fecha pueden confirmar tus invitados?
        </label>
        <input
          type="date"
          value={v.fecha_limite ?? ""}
          onChange={(e) => onChange({ ...v, fecha_limite: e.target.value })}
          className={`${inputBase} [color-scheme:dark]`}
        />
      </div>
      <div>
        <label className="block text-white/70 text-sm mb-2 font-medium">
          ¿Los invitados pueden indicar acompañantes al confirmar?
        </label>
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              { valor: "si", etiqueta: "Sí, con acompañantes", emoji: "👥" },
              { valor: "no", etiqueta: "No, solo el invitado", emoji: "👤" },
            ] as const
          ).map((op) => (
            <button
              key={op.valor}
              type="button"
              onClick={() => onChange({ ...v, acompanantes: op.valor })}
              className={`rounded-2xl border p-4 text-center transition-all active:scale-[0.98] ${
                v.acompanantes === op.valor
                  ? "border-[#D4AF37] bg-[#D4AF37]/10"
                  : "border-white/15 bg-white/5 hover:border-white/30"
              }`}
            >
              <span className="text-2xl block mb-1">{op.emoji}</span>
              <span className="text-white text-sm font-medium">{op.etiqueta}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- Subida de fotos / video ---------- */

interface Foto {
  nombre: string;
  ruta: string;
  url?: string;
}

export function CampoFotos({
  pregunta,
  token,
  fotos,
  setFotos,
  limitePlan,
}: {
  pregunta: Pregunta;
  token: string;
  fotos: Foto[];
  setFotos: (f: Foto[]) => void;
  limitePlan: number | null; // null = ilimitado
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState("");

  const esVideo = !!pregunta.aceptaVideo;
  const soloImagenes = fotos.filter((f) => !f.nombre.startsWith("video-"));
  const limite = pregunta.maxArchivos ?? limitePlan;
  const alcanzado = !esVideo && limite !== null && soloImagenes.length >= limite;

  const subir = async (archivos: FileList | null) => {
    if (!archivos?.length) return;
    setError("");
    setSubiendo(true);
    for (const archivo of Array.from(archivos)) {
      const data = new FormData();
      data.append("archivo", archivo);
      try {
        const res = await fetch(`/api/formulario/${token}/fotos`, { method: "POST", body: data });
        const json = await res.json();
        if (!res.ok) {
          setError(json.error ?? "No se pudo subir el archivo.");
          break;
        }
        // Obtener vista previa firmada
        const prev = await fetch(
          `/api/formulario/${token}/fotos?ruta=${encodeURIComponent(json.foto.ruta)}`
        ).then((r) => r.json());
        setFotos([...fotos, { ...json.foto, url: prev.url }]);
        fotos = [...fotos, { ...json.foto, url: prev.url }];
      } catch {
        setError("Error de conexión. Intenta de nuevo.");
        break;
      }
    }
    setSubiendo(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const eliminar = async (foto: Foto) => {
    await fetch(`/api/formulario/${token}/fotos?ruta=${encodeURIComponent(foto.ruta)}`, {
      method: "DELETE",
    });
    setFotos(fotos.filter((f) => f.ruta !== foto.ruta));
  };

  const visibles = esVideo ? fotos.filter((f) => f.nombre.startsWith("video-")) : soloImagenes;

  return (
    <div className="space-y-4">
      {visibles.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {visibles.map((foto) => (
            <div key={foto.ruta} className="relative group aspect-square">
              {foto.nombre.startsWith("video-") ? (
                <video
                  src={foto.url}
                  className="w-full h-full object-cover rounded-xl border border-white/10"
                  muted
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={foto.url}
                  alt=""
                  className="w-full h-full object-cover rounded-xl border border-white/10"
                />
              )}
              <button
                type="button"
                onClick={() => eliminar(foto)}
                className="absolute -top-2 -right-2 bg-black border border-white/30 rounded-full p-1.5 text-white/70 hover:text-red-400 hover:border-red-400 transition-colors"
                aria-label="Eliminar archivo"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        multiple={!esVideo}
        accept={esVideo ? "video/*,image/*" : "image/*"}
        onChange={(e) => subir(e.target.files)}
        className="hidden"
      />

      <button
        type="button"
        disabled={subiendo || alcanzado}
        onClick={() => inputRef.current?.click()}
        className="w-full rounded-2xl border border-dashed border-[#D4AF37]/50 py-8 flex flex-col items-center justify-center gap-2 text-[#D4AF37] hover:bg-[#D4AF37]/5 transition-colors disabled:opacity-40"
      >
        {subiendo ? (
          <Loader2 className="w-6 h-6 animate-spin" />
        ) : (
          <Upload className="w-6 h-6" />
        )}
        <span className="text-sm font-medium">
          {subiendo
            ? "Subiendo…"
            : alcanzado
            ? `Límite alcanzado (${limite} fotos de tu plan)`
            : esVideo
            ? "Toca para subir tu video o imagen"
            : "Toca para subir tus fotos"}
        </span>
        {!esVideo && limite !== null && (
          <span className="text-xs text-white/40">
            {soloImagenes.length} de {limite} fotos de tu plan
          </span>
        )}
      </button>

      {error && (
        <p className="text-red-300 text-sm text-center bg-red-950/40 border border-red-500/30 rounded-xl py-2 px-3">
          {error}
        </p>
      )}
    </div>
  );
}
