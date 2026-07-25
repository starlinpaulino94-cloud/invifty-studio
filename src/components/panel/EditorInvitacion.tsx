"use client";

import { useState, useTransition } from "react";
import { DatosInvitacion, EstadoInvitacion } from "@/lib/tipos";
import { PALETAS_INVITACION } from "@/lib/invitacion";
import {
  guardarInvitacion, publicarInvitacion, despublicarInvitacion,
} from "@/lib/acciones-invitacion";
import {
  Save, Eye, Globe, Loader2, Plus, Trash2, CheckCircle2, EyeOff,
} from "lucide-react";

const input =
  "w-full bg-white border border-gray-200 focus:border-[#D4AF37] rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none";
const label = "block text-xs font-semibold text-gray-600 mb-1.5";

export default function EditorInvitacion({
  invitacionId,
  slugInicial,
  plantillaInicial,
  datosIniciales,
  estado,
  urlPublica,
}: {
  invitacionId: string;
  slugInicial: string;
  plantillaInicial: string;
  datosIniciales: DatosInvitacion;
  estado: EstadoInvitacion;
  urlPublica: string;
}) {
  const [datos, setDatos] = useState<DatosInvitacion>(datosIniciales);
  const [slug, setSlug] = useState(slugInicial);
  const [plantilla] = useState(plantillaInicial);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [guardando, startGuardar] = useTransition();
  const [publicando, startPublicar] = useTransition();

  const set = <K extends keyof DatosInvitacion>(campo: K, valor: DatosInvitacion[K]) =>
    setDatos({ ...datos, [campo]: valor });

  const guardar = () =>
    startGuardar(async () => {
      const res = await guardarInvitacion(invitacionId, datos, slug, plantilla);
      setMensaje(
        res.ok
          ? { tipo: "ok", texto: "Cambios guardados. Revisa la vista previa." }
          : { tipo: "error", texto: res.error ?? "Error al guardar" }
      );
      setTimeout(() => setMensaje(null), 4000);
    });

  const publicar = () =>
    startPublicar(async () => {
      const res = await guardarInvitacion(invitacionId, datos, slug, plantilla);
      if (!res.ok) {
        setMensaje({ tipo: "error", texto: res.error ?? "Error al guardar" });
        return;
      }
      await publicarInvitacion(invitacionId);
    });

  const despublicar = () => startPublicar(() => despublicarInvitacion(invitacionId));

  return (
    <div className="space-y-6">
      {/* Barra de acciones */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex flex-wrap items-center gap-3 sticky top-2 z-20">
        <button
          onClick={guardar}
          disabled={guardando}
          className="inline-flex items-center gap-2 bg-[#0D0D0F] text-white text-xs font-semibold px-5 py-2.5 rounded-xl hover:bg-black transition-colors disabled:opacity-60"
        >
          {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 text-[#D4AF37]" />}
          Guardar cambios
        </button>

        <a
          href={urlPublica}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-white border border-gray-200 hover:border-gray-900 text-gray-800 text-xs font-semibold px-5 py-2.5 rounded-xl transition-colors"
        >
          <Eye className="w-4 h-4 text-[#D4AF37]" />
          Vista previa
        </a>

        {estado === "publicada" ? (
          <>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-2 rounded-xl">
              <CheckCircle2 className="w-4 h-4" /> Publicada
            </span>
            <button
              onClick={despublicar}
              disabled={publicando}
              className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-600 font-medium ml-auto"
            >
              <EyeOff className="w-3.5 h-3.5" /> Despublicar
            </button>
          </>
        ) : (
          <button
            onClick={publicar}
            disabled={publicando}
            className="inline-flex items-center gap-2 bg-[#D4AF37] hover:bg-[#F2D06B] text-black text-xs font-bold px-5 py-2.5 rounded-xl transition-colors disabled:opacity-60 ml-auto"
          >
            {publicando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
            Publicar invitación
          </button>
        )}
      </div>

      {mensaje && (
        <p
          className={`text-xs font-medium px-4 py-3 rounded-xl ${
            mensaje.tipo === "ok"
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-red-50 text-red-600 border border-red-200"
          }`}
        >
          {mensaje.texto}
        </p>
      )}

      {/* Portada */}
      <Tarjeta titulo="Portada">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className={label}>Título principal</label>
            <input value={datos.titulo} onChange={(e) => set("titulo", e.target.value)} className={input} />
          </div>
          <div>
            <label className={label}>Subtítulo</label>
            <input value={datos.subtitulo} onChange={(e) => set("subtitulo", e.target.value)} className={input} />
          </div>
          <div>
            <label className={label}>Frase o versículo</label>
            <input value={datos.frase} onChange={(e) => set("frase", e.target.value)} className={input} />
          </div>
          <div>
            <label className={label}>Fecha del evento</label>
            <input type="date" value={datos.fechaEvento} onChange={(e) => set("fechaEvento", e.target.value)} className={input} />
          </div>
          <div>
            <label className={label}>Hora</label>
            <input type="time" value={datos.horaEvento} onChange={(e) => set("horaEvento", e.target.value)} className={input} />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>Dirección web (slug): tu-dominio/i/…</label>
            <input value={slug} onChange={(e) => setSlug(e.target.value)} className={`${input} font-mono`} />
          </div>
        </div>
      </Tarjeta>

      {/* Paleta */}
      <Tarjeta titulo="Paleta de colores">
        <div className="flex flex-wrap gap-2">
          {Object.entries(PALETAS_INVITACION).map(([id, p]) => (
            <button
              key={id}
              onClick={() => set("paleta", id)}
              className={`flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-medium transition-all ${
                datos.paleta === id
                  ? "border-[#D4AF37] ring-2 ring-[#D4AF37]/30 bg-[#D4AF37]/5"
                  : "border-gray-200 hover:border-gray-400"
              }`}
            >
              <span className="flex gap-1">
                {[p.fondo, p.acento, p.tarjeta].map((c) => (
                  <span key={c} className="w-4 h-4 rounded-full border border-gray-200" style={{ backgroundColor: c }} />
                ))}
              </span>
              {p.nombre}
            </button>
          ))}
        </div>
      </Tarjeta>

      {/* Lugares */}
      <Tarjeta titulo="Lugares">
        <ListaEditable
          items={datos.lugares}
          onChange={(v) => set("lugares", v as DatosInvitacion["lugares"])}
          campos={[
            { id: "nombre", placeholder: "Ej. Ceremonia" },
            { id: "detalle", placeholder: "Nombre del lugar y dirección" },
          ]}
          textoAgregar="Agregar lugar"
        />
        <div className="mt-4">
          <label className={label}>Código de vestimenta</label>
          <input value={datos.dressCode} onChange={(e) => set("dressCode", e.target.value)} className={input} placeholder="Ej. formal" />
        </div>
      </Tarjeta>

      {/* Historia */}
      <Tarjeta titulo="Historia" toggle={{ activo: datos.secciones.historia, onChange: (v) => set("secciones", { ...datos.secciones, historia: v }) }}>
        <textarea
          rows={4}
          value={datos.historia}
          onChange={(e) => set("historia", e.target.value)}
          className={`${input} resize-none`}
          placeholder="La historia de la pareja o del festejado…"
        />
      </Tarjeta>

      {/* Cronograma */}
      <Tarjeta titulo="Programa del día" toggle={{ activo: datos.secciones.cronograma, onChange: (v) => set("secciones", { ...datos.secciones, cronograma: v }) }}>
        <ListaEditable
          items={datos.cronograma}
          onChange={(v) => set("cronograma", v as DatosInvitacion["cronograma"])}
          campos={[
            { id: "hora", placeholder: "Hora", tipo: "time" },
            { id: "actividad", placeholder: "Actividad" },
          ]}
          textoAgregar="Agregar momento"
        />
      </Tarjeta>

      {/* Regalos */}
      <Tarjeta titulo="Mesa de regalos" toggle={{ activo: datos.secciones.regalos, onChange: (v) => set("secciones", { ...datos.secciones, regalos: v }) }}>
        <ListaEditable
          items={datos.regalos}
          onChange={(v) => set("regalos", v as DatosInvitacion["regalos"])}
          campos={[
            { id: "titulo", placeholder: "Ej. Cuenta Banreservas" },
            { id: "detalle", placeholder: "Número de cuenta o link" },
          ]}
          textoAgregar="Agregar opción de regalo"
        />
      </Tarjeta>

      {/* Galería */}
      <Tarjeta titulo="Galería de fotos" toggle={{ activo: datos.secciones.galeria, onChange: (v) => set("secciones", { ...datos.secciones, galeria: v }) }}>
        <p className="text-xs text-gray-400">
          Usa las fotos que el cliente subió en su formulario (la primera es la portada).
          Para cambiarlas, gestiónalas desde la ficha del pedido.
        </p>
      </Tarjeta>

      {/* RSVP */}
      <Tarjeta titulo="Confirmación de asistencia (RSVP)" toggle={{ activo: datos.secciones.rsvp, onChange: (v) => set("secciones", { ...datos.secciones, rsvp: v }) }}>
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className={label}>WhatsApp que recibe confirmaciones</label>
            <input
              value={datos.rsvp.whatsapp}
              onChange={(e) => set("rsvp", { ...datos.rsvp, whatsapp: e.target.value.replace(/\D/g, "") })}
              className={input}
              placeholder="18091234567"
            />
          </div>
          <div>
            <label className={label}>Fecha límite</label>
            <input
              type="date"
              value={datos.rsvp.fechaLimite}
              onChange={(e) => set("rsvp", { ...datos.rsvp, fechaLimite: e.target.value })}
              className={input}
            />
          </div>
          <div>
            <label className={label}>¿Permite acompañantes?</label>
            <select
              value={datos.rsvp.acompanantes ? "si" : "no"}
              onChange={(e) => set("rsvp", { ...datos.rsvp, acompanantes: e.target.value === "si" })}
              className={input}
            >
              <option value="si">Sí</option>
              <option value="no">No</option>
            </select>
          </div>
        </div>
      </Tarjeta>
    </div>
  );
}

/* ---------- Auxiliares ---------- */

function Tarjeta({
  titulo,
  toggle,
  children,
}: {
  titulo: string;
  toggle?: { activo: boolean; onChange: (v: boolean) => void };
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-serif text-lg text-gray-900">{titulo}</h2>
        {toggle && (
          <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
            <input
              type="checkbox"
              checked={toggle.activo}
              onChange={(e) => toggle.onChange(e.target.checked)}
              className="accent-[#D4AF37] w-4 h-4"
            />
            Mostrar sección
          </label>
        )}
      </div>
      <div className={toggle && !toggle.activo ? "opacity-40 pointer-events-none" : ""}>{children}</div>
    </section>
  );
}

function ListaEditable({
  items,
  onChange,
  campos,
  textoAgregar,
}: {
  items: Record<string, string>[];
  onChange: (v: Record<string, string>[]) => void;
  campos: { id: string; placeholder: string; tipo?: string }[];
  textoAgregar: string;
}) {
  const vacio = Object.fromEntries(campos.map((c) => [c.id, ""]));
  return (
    <div className="space-y-2.5">
      {items.map((item, idx) => (
        <div key={idx} className="flex flex-col sm:flex-row gap-2.5 items-stretch">
          {campos.map((campo) => (
            <input
              key={campo.id}
              type={campo.tipo ?? "text"}
              value={item[campo.id] ?? ""}
              onChange={(e) =>
                onChange(items.map((it, i) => (i === idx ? { ...it, [campo.id]: e.target.value } : it)))
              }
              placeholder={campo.placeholder}
              className={`bg-white border border-gray-200 focus:border-[#D4AF37] rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none ${
                campo.tipo === "time" ? "sm:w-32" : "flex-1"
              }`}
            />
          ))}
          <button
            type="button"
            onClick={() => onChange(items.filter((_, i) => i !== idx))}
            className="self-center text-gray-300 hover:text-red-500 p-1.5"
            aria-label="Eliminar"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, { ...vacio }])}
        className="w-full rounded-xl border border-dashed border-gray-300 hover:border-[#D4AF37] text-gray-500 hover:text-[#B08D2A] py-2.5 flex items-center justify-center gap-1.5 text-xs font-medium transition-colors"
      >
        <Plus className="w-3.5 h-3.5" /> {textoAgregar}
      </button>
    </div>
  );
}
