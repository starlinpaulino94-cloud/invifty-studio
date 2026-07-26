"use client";

import { useState, useTransition } from "react";
import { EFECTOS_POR_DEFECTO } from "@/lib/tipos";
import type { DatosInvitacion, EstadoInvitacion, FotoInvitacion } from "@/lib/tipos";
import GestorFotos from "./GestorFotos";
import VistaPreviaEnVivo from "./VistaPreviaEnVivo";
import { PALETAS, TIPOGRAFIAS, DENSIDADES, DENSIDAD_POR_DEFECTO } from "@/config/diseno";
import { PLANTILLAS } from "@/config/plantillas";
import {
  PLANTILLA_CODIGO, esInvitacionDeCodigo, revisarCodigo, MARCADORES_DISPONIBLES,
} from "@/lib/codigo";
import {
  guardarInvitacion, publicarInvitacion, despublicarInvitacion,
} from "@/lib/acciones-invitacion";
import {
  Save, Eye, Globe, Loader2, Plus, Trash2, CheckCircle2, EyeOff, Mail, Sparkles, Music,
  ClipboardList, Code2, AlertTriangle,
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
  fotos,
  codigoInicial,
}: {
  invitacionId: string;
  slugInicial: string;
  plantillaInicial: string;
  datosIniciales: DatosInvitacion;
  estado: EstadoInvitacion;
  urlPublica: string;
  /** Fotos que subió el cliente, sin ordenar ni filtrar. */
  fotos: FotoInvitacion[];
  /** HTML guardado si la invitación se hizo fuera del sistema. */
  codigoInicial: string | null;
}) {
  const [datos, setDatos] = useState<DatosInvitacion>({
    ...datosIniciales,
    padrinos: datosIniciales.padrinos ?? [],
    notas: datosIniciales.notas ?? [],
    notasEquipo: datosIniciales.notasEquipo ?? [],
    ordenFotos: datosIniciales.ordenFotos ?? [],
    fotosOcultas: datosIniciales.fotosOcultas ?? [],
    efectos: { ...EFECTOS_POR_DEFECTO, ...(datosIniciales.efectos ?? {}) },
    secciones: {
      padrinos: false,
      notas: false,
      ...datosIniciales.secciones,
    },
  });
  const [slug, setSlug] = useState(slugInicial);
  const [plantilla, setPlantilla] = useState(
    plantillaInicial === "clasica" ? "editorial" : plantillaInicial
  );
  const [codigoHtml, setCodigoHtml] = useState(codigoInicial ?? "");
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [guardando, startGuardar] = useTransition();
  const [publicando, startPublicar] = useTransition();

  const set = <K extends keyof DatosInvitacion>(campo: K, valor: DatosInvitacion[K]) =>
    setDatos((d) => ({ ...d, [campo]: valor }));

  const setSeccion = (clave: keyof DatosInvitacion["secciones"], valor: boolean) =>
    setDatos((d) => ({ ...d, secciones: { ...d.secciones, [clave]: valor } }));

  const setEfecto = (clave: "sobre" | "textura" | "musica", valor: boolean) =>
    setDatos((d) => ({
      ...d,
      efectos: { ...EFECTOS_POR_DEFECTO, ...(d.efectos ?? {}), [clave]: valor },
    }));

  /** Al cambiar de plantilla se sugieren su paleta y tipografía. */
  const cambiarPlantilla = (id: string) => {
    setPlantilla(id);
    if (id === PLANTILLA_CODIGO) return; // el diseño viene del código pegado
    const meta = PLANTILLAS.find((p) => p.id === id);
    if (meta) {
      setDatos((d) => ({ ...d, paleta: meta.paletaSugerida, tipografia: meta.tipografiaSugerida }));
    }
  };

  const guardar = () =>
    startGuardar(async () => {
      const res = await guardarInvitacion(invitacionId, datos, slug, plantilla, codigoHtml);
      setMensaje(
        res.ok
          ? { tipo: "ok", texto: "Cambios guardados. Abre la vista previa para verlos." }
          : { tipo: "error", texto: res.error ?? "Error al guardar" }
      );
      setTimeout(() => setMensaje(null), 4000);
    });

  const publicar = () =>
    startPublicar(async () => {
      const res = await guardarInvitacion(invitacionId, datos, slug, plantilla, codigoHtml);
      if (!res.ok) {
        setMensaje({ tipo: "error", texto: res.error ?? "Error al guardar" });
        return;
      }
      await publicarInvitacion(invitacionId);
    });

  const despublicar = () => startPublicar(() => despublicarInvitacion(invitacionId));

  /**
   * Qué tarjeta del editor controla cada bloque de la invitación. Los
   * bloques se marcan en Secciones.tsx, común a las diez plantillas.
   */
  const TARJETA_DE_CAMPO: Record<string, string> = {
    portada: "portada",
    lugares: "lugares",
    dresscode: "lugares", // el código de vestimenta se edita junto a los lugares
    historia: "historia",
    cronograma: "cronograma",
    padrinos: "padrinos",
    galeria: "galeria",
    regalos: "regalos",
    notas: "notas",
    rsvp: "rsvp",
    cierre: "cierre",
  };

  /** Tarjeta a la que saltó la vista previa; se resalta un momento. */
  const [resaltada, setResaltada] = useState<string | null>(null);

  const irACampo = (campo: string) => {
    const id = TARJETA_DE_CAMPO[campo] ?? "portada";
    document.getElementById(`tarjeta-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    setResaltada(id);
    setTimeout(() => setResaltada((actual) => (actual === id ? null : actual)), 2000);
  };
  const efectos = { ...EFECTOS_POR_DEFECTO, ...(datos.efectos ?? {}) };
  const esCodigo = esInvitacionDeCodigo(plantilla);
  const avisosCodigo = esCodigo ? revisarCodigo(codigoHtml) : [];

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

      {/* En pantallas anchas el formulario va a la izquierda y la vista
          previa fija a la derecha; en pantallas estrechas se apila. */}
      <div className="grid xl:grid-cols-[minmax(0,1fr)_auto] gap-6 items-start">
        <div className="space-y-6 min-w-0">

      {/* ---------- LO QUE PIDIÓ EL CLIENTE ----------
          Respuestas del formulario que el sistema no puede aplicar solo.
          No se publican: son instrucciones para el equipo. */}
      {(datos.notasEquipo?.length ?? 0) > 0 && (
        <div className="bg-[#FFFBF0] border border-[#E8D9A8] rounded-2xl p-5">
          <h3 className="text-sm font-bold text-[#8A6D1F] flex items-center gap-2 mb-1">
            <ClipboardList className="w-4 h-4" />
            Lo que pidió el cliente
          </h3>
          <p className="text-xs text-[#A08A4F] mb-4">
            Esto no se publica. Son los detalles que hay que aplicar a mano antes de publicar.
          </p>
          <ul className="space-y-3">
            {datos.notasEquipo!.map((nota, i) => (
              <li key={i} className="border-l-2 border-[#D4AF37] pl-3">
                <p className="text-xs font-semibold text-gray-800">{nota.titulo}</p>
                <p className="text-sm text-gray-600 whitespace-pre-line mt-0.5">{nota.texto}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ---------- DISEÑO ---------- */}
      <Tarjeta titulo="Plantilla" subtitulo="Cada una tiene su propia portada, ornamentos y ritmo.">
        <div className="grid sm:grid-cols-2 gap-3">
          {PLANTILLAS.map((p) => {
            const activa = plantilla === p.id;
            const pal = PALETAS[p.paletaSugerida];
            return (
              <button
                key={p.id}
                onClick={() => cambiarPlantilla(p.id)}
                className={`text-left rounded-2xl border p-4 transition-all ${
                  activa
                    ? "border-[#D4AF37] ring-2 ring-[#D4AF37]/25 bg-[#D4AF37]/5"
                    : "border-gray-200 hover:border-gray-400"
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Miniatura de la paleta sugerida */}
                  <span
                    className="w-12 h-16 rounded-lg shrink-0 flex flex-col items-center justify-center gap-1 border"
                    style={{ backgroundColor: pal.fondo, borderColor: pal.acento }}
                  >
                    <span className="w-6 h-px" style={{ backgroundColor: pal.acento }} />
                    <span className="text-[9px]" style={{ color: pal.acento }}>Aa</span>
                    <span className="w-4 h-px" style={{ backgroundColor: pal.acento }} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-gray-900">{p.nombre}</span>
                    <span className="block text-[11px] text-gray-500 leading-snug mt-0.5">{p.descripcion}</span>
                    <span className="block text-[10px] text-[#B08D2A] mt-1.5">{p.ideal}</span>
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Invitación hecha fuera del sistema */}
        <button
          onClick={() => cambiarPlantilla(PLANTILLA_CODIGO)}
          className={`mt-3 w-full text-left rounded-xl border-2 p-4 transition-all flex items-start gap-3 ${
            esCodigo
              ? "border-[#D4AF37] bg-[#FFFBF0]"
              : "border-dashed border-gray-200 hover:border-gray-400"
          }`}
        >
          <Code2 className={`w-5 h-5 shrink-0 mt-0.5 ${esCodigo ? "text-[#B08D2A]" : "text-gray-400"}`} />
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-gray-900">Código propio</span>
            <span className="block text-[11px] text-gray-500 leading-snug mt-0.5">
              Para invitaciones hechas fuera del sistema, por ejemplo con IA. Pegas el
              HTML y se publica igual que las demás: misma dirección, misma vista previa
              al compartir y mismo contador de visitas.
            </span>
          </span>
        </button>
      </Tarjeta>

      {esCodigo && (
        <Tarjeta
          titulo="Código de la invitación"
          subtitulo="Pega aquí el HTML completo. Se guarda al pulsar «Guardar cambios»."
          id="codigo"
          resaltada={resaltada === "codigo"}
        >
          <textarea
            value={codigoHtml}
            onChange={(e) => setCodigoHtml(e.target.value)}
            rows={14}
            spellCheck={false}
            placeholder={"<!doctype html>\n<html>\n  …\n</html>"}
            className={`${input} font-mono text-xs leading-relaxed resize-y`}
          />

          {avisosCodigo.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {avisosCodigo.map((aviso, i) => (
                <li
                  key={i}
                  className={`text-xs flex items-start gap-1.5 ${
                    aviso.tipo === "error" ? "text-red-600" : "text-amber-700"
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
                  {aviso.texto}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 rounded-xl bg-gray-50 p-4">
            <p className="text-xs font-semibold text-gray-700 mb-2">
              Marcadores: escríbelos en el código y el sistema pone el dato real
            </p>
            <ul className="space-y-1">
              {MARCADORES_DISPONIBLES.map((m) => (
                <li key={m.marcador} className="text-[11px] text-gray-500">
                  <code className="text-[#B08D2A] font-mono">{m.marcador}</code> — {m.descripcion}
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-gray-400 mt-3 leading-relaxed">
              El código se muestra aislado del resto del sistema por seguridad, así que
              no puede usar rutas relativas: las direcciones tienen que ir completas.
              El título y la fecha de la tarjeta «Portada» siguen usándose para la vista
              previa al compartir por WhatsApp.
            </p>
          </div>

          <div className="mt-3 rounded-xl bg-gray-50 p-4">
            <p className="text-xs font-semibold text-gray-700 mb-2">
              Confirmaciones: para que lleguen al panel como las demás
            </p>
            <p className="text-[11px] text-gray-500 leading-relaxed mb-2">
              Marca el formulario con <code className="text-[#B08D2A] font-mono">data-invifty-rsvp</code> y
              nombra sus campos <code className="font-mono">nombre</code>,{" "}
              <code className="font-mono">asiste</code>, <code className="font-mono">cantidad</code> y{" "}
              <code className="font-mono">nota</code>. No hace falta escribir JavaScript.
            </p>
            <pre className="text-[10px] font-mono text-gray-600 bg-white rounded-lg p-3 overflow-x-auto leading-relaxed">{`<form data-invifty-rsvp>
  <input name="nombre" required>
  <select name="asiste">
    <option value="si">Sí asistiré</option>
    <option value="no">No podré ir</option>
  </select>
  <input name="cantidad" type="number" value="1">
  <textarea name="nota"></textarea>
  <button>Confirmar</button>
  <p data-invifty-mensaje></p>
</form>`}</pre>
            <p className="text-[11px] text-gray-400 mt-2 leading-relaxed">
              El aviso aparece dentro del elemento con{" "}
              <code className="font-mono">data-invifty-mensaje</code>. Para flujos propios,
              también existe <code className="font-mono">invifty.confirmar({"{…}"})</code>,
              que devuelve una promesa.
            </p>
          </div>
        </Tarjeta>
      )}

      {!esCodigo && (<>
      <Tarjeta titulo="Paleta de colores">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {Object.entries(PALETAS).map(([id, p]) => (
            <button
              key={id}
              onClick={() => set("paleta", id)}
              className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all ${
                datos.paleta === id
                  ? "border-[#D4AF37] ring-2 ring-[#D4AF37]/25"
                  : "border-gray-200 hover:border-gray-400"
              }`}
            >
              <span className="flex shrink-0">
                {[p.fondo, p.acento, p.tarjeta].map((c, i) => (
                  <span
                    key={i}
                    className="w-5 h-8 border border-gray-200"
                    style={{ backgroundColor: c, marginLeft: i ? -6 : 0, borderRadius: 4 }}
                  />
                ))}
              </span>
              <span className="text-[11px] font-medium text-gray-700 leading-tight">{p.nombre}</span>
            </button>
          ))}
        </div>
      </Tarjeta>

      <Tarjeta
        titulo="Cuánto adorno"
        subtitulo="El mismo diseño puede salir limpio o cargado de flores."
      >
        <div className="grid sm:grid-cols-3 gap-3">
          {DENSIDADES.map((d) => {
            const activa = (datos.densidad ?? DENSIDAD_POR_DEFECTO) === d.id;
            return (
              <button
                key={d.id}
                onClick={() => set("densidad", d.id)}
                className={`text-left rounded-xl border-2 p-4 transition-all ${
                  activa ? "border-[#D4AF37] bg-[#FFFBF0]" : "border-gray-200 hover:border-gray-400"
                }`}
              >
                <span className="text-xl block mb-1.5">{d.emoji}</span>
                <span className="block text-sm font-semibold text-gray-900">{d.nombre}</span>
                <span className="block text-[11px] text-gray-500 leading-snug mt-0.5">
                  {d.descripcion}
                </span>
              </button>
            );
          })}
        </div>
      </Tarjeta>

      <Tarjeta titulo="Tipografía">
        <div className="grid sm:grid-cols-2 gap-2.5">
          {Object.entries(TIPOGRAFIAS).map(([id, t]) => (
            <button
              key={id}
              onClick={() => set("tipografia", id)}
              className={`text-left rounded-xl border px-4 py-3 transition-all ${
                (datos.tipografia ?? "clasica_real") === id
                  ? "border-[#D4AF37] ring-2 ring-[#D4AF37]/25 bg-[#D4AF37]/5"
                  : "border-gray-200 hover:border-gray-400"
              }`}
            >
              <span className="block text-sm font-semibold text-gray-900">{t.nombre}</span>
              <span className="block text-[11px] text-gray-500 mt-0.5">{t.descripcion}</span>
            </button>
          ))}
        </div>
      </Tarjeta>

      <Tarjeta titulo="Experiencia de apertura">
        <div className="space-y-3">
          <Interruptor
            icono={<Mail className="w-4 h-4 text-[#D4AF37]" />}
            titulo="Sobre lacrado"
            detalle="El invitado ve un sobre cerrado con el monograma y lo toca para abrir la invitación."
            activo={efectos.sobre}
            onChange={(v) => setEfecto("sobre", v)}
          />
          <Interruptor
            icono={<Sparkles className="w-4 h-4 text-[#D4AF37]" />}
            titulo="Textura de papel"
            detalle="Grano sutil y viñeta que dan sensación de pieza impresa."
            activo={efectos.textura}
            onChange={(v) => setEfecto("textura", v)}
          />
          <Interruptor
            icono={<Music className="w-4 h-4 text-[#D4AF37]" />}
            titulo="Música de fondo"
            detalle="Botón flotante para activar el sonido. Requiere el enlace del audio."
            activo={efectos.musica}
            onChange={(v) => setEfecto("musica", v)}
          />
          {efectos.musica && (
            <div className="pl-1">
              <label className={label}>Enlace directo al audio (.mp3)</label>
              <input
                value={datos.musicaUrl ?? ""}
                onChange={(e) => set("musicaUrl", e.target.value)}
                className={input}
                placeholder="https://…/cancion.mp3"
              />
              <p className="text-[11px] text-gray-400 mt-1.5">
                Sube el archivo a Supabase Storage (o a cualquier hosting) y pega aquí el enlace directo.
              </p>
            </div>
          )}
        </div>
      </Tarjeta>

      {/* ---------- CONTENIDO ---------- */}
      </>)}

      {/* La portada sigue visible con código propio: de aquí salen el
          título y la fecha de la vista previa al compartir, y la
          dirección web de la invitación. */}
      <Tarjeta titulo="Portada" id="portada" resaltada={resaltada === "portada"}>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className={label}>Título principal</label>
            <input value={datos.titulo} onChange={(e) => set("titulo", e.target.value)} className={input} />
          </div>
          <div>
            <label className={label}>Subtítulo</label>
            <input
              value={datos.subtitulo}
              onChange={(e) => set("subtitulo", e.target.value)}
              className={input}
              placeholder="Ej. Nos casamos"
            />
          </div>
          <div>
            <label className={label}>Monograma (iniciales)</label>
            <input
              value={datos.monograma ?? ""}
              onChange={(e) => set("monograma", e.target.value)}
              className={input}
              placeholder="Se calcula solo: C & L"
            />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>Frase o versículo de portada</label>
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

      {!esCodigo && (<>
      <Tarjeta titulo="Lugares" id="lugares" resaltada={resaltada === "lugares"}>
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

      <Tarjeta
        titulo="Historia" id="historia" resaltada={resaltada === "historia"}
        toggle={{ activo: datos.secciones.historia, onChange: (v) => setSeccion("historia", v) }}
      >
        <textarea
          rows={5}
          value={datos.historia}
          onChange={(e) => set("historia", e.target.value)}
          className={`${input} resize-none`}
          placeholder="La historia de la pareja o del festejado…"
        />
      </Tarjeta>

      <Tarjeta
        titulo="Programa del día" id="cronograma" resaltada={resaltada === "cronograma"}
        toggle={{ activo: datos.secciones.cronograma, onChange: (v) => setSeccion("cronograma", v) }}
      >
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

      <Tarjeta
        titulo="Personas especiales" id="padrinos" resaltada={resaltada === "padrinos"}
        subtitulo="Padrinos, corte de honor, damas, ponentes…"
        toggle={{ activo: !!datos.secciones.padrinos, onChange: (v) => setSeccion("padrinos", v) }}
      >
        <ListaEditable
          items={datos.padrinos ?? []}
          onChange={(v) => set("padrinos", v as DatosInvitacion["padrinos"])}
          campos={[
            { id: "rol", placeholder: "Ej. Padrinos de anillos" },
            { id: "nombre", placeholder: "Nombres" },
          ]}
          textoAgregar="Agregar persona"
        />
      </Tarjeta>

      <Tarjeta
        titulo="Mesa de regalos" id="regalos" resaltada={resaltada === "regalos"}
        toggle={{ activo: datos.secciones.regalos, onChange: (v) => setSeccion("regalos", v) }}
      >
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

      <Tarjeta
        titulo="Detalles a tener en cuenta" id="notas" resaltada={resaltada === "notas"}
        subtitulo="Parqueo, hospedaje, si es solo adultos, indicaciones especiales…"
        toggle={{ activo: !!datos.secciones.notas, onChange: (v) => setSeccion("notas", v) }}
      >
        <ListaEditable
          items={datos.notas ?? []}
          onChange={(v) => set("notas", v as DatosInvitacion["notas"])}
          campos={[
            { id: "titulo", placeholder: "Ej. Parqueo" },
            { id: "texto", placeholder: "Ej. Valet parking disponible sin costo" },
          ]}
          textoAgregar="Agregar detalle"
        />
      </Tarjeta>

      <Tarjeta
        titulo="Fotos, portada y orden" id="galeria" resaltada={resaltada === "galeria"}
        subtitulo="Elige cuál es la portada, en qué orden se ven y cuáles no salen."
        toggle={{ activo: datos.secciones.galeria, onChange: (v) => setSeccion("galeria", v) }}
      >
        <GestorFotos
          fotos={fotos}
          orden={datos.ordenFotos ?? []}
          ocultas={datos.fotosOcultas ?? []}
          onCambiar={(orden, ocultas) =>
            setDatos((d) => ({ ...d, ordenFotos: orden, fotosOcultas: ocultas }))
          }
        />
        <p className="text-[11px] text-gray-400 mt-4">
          Las fotos las sube el cliente desde su formulario. Para añadir o borrar
          archivos, ve a la ficha del pedido.
        </p>
      </Tarjeta>

      <Tarjeta
        titulo="Confirmación de asistencia (RSVP)" id="rsvp" resaltada={resaltada === "rsvp"}
        toggle={{ activo: datos.secciones.rsvp, onChange: (v) => setSeccion("rsvp", v) }}
      >
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

      <Tarjeta titulo="Cierre" id="cierre" resaltada={resaltada === "cierre"}>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={label}>Mensaje final</label>
            <input
              value={datos.mensajeFinal ?? ""}
              onChange={(e) => set("mensajeFinal", e.target.value)}
              className={input}
              placeholder="Nos hará muy felices contar contigo"
            />
          </div>
          <div>
            <label className={label}>Hashtag del evento</label>
            <input
              value={datos.hashtag ?? ""}
              onChange={(e) => set("hashtag", e.target.value)}
              className={input}
              placeholder="#CamilaYLucas2026"
            />
          </div>
        </div>
      </Tarjeta>
      </>)}

        </div>

        <VistaPreviaEnVivo
          plantilla={plantilla}
          datos={datos}
          fotos={fotos}
          codigoHtml={codigoHtml}
          onSenalarCampo={irACampo}
        />
      </div>
    </div>
  );
}

/* ---------- Auxiliares ---------- */

function Tarjeta({
  titulo,
  subtitulo,
  toggle,
  children,
  id,
  resaltada,
}: {
  titulo: string;
  subtitulo?: string;
  toggle?: { activo: boolean; onChange: (v: boolean) => void };
  children: React.ReactNode;
  /** Destino al que salta la vista previa cuando se señala su bloque. */
  id?: string;
  resaltada?: boolean;
}) {
  return (
    <section
      id={id ? `tarjeta-${id}` : undefined}
      className={`bg-white border rounded-2xl p-6 shadow-sm transition-colors scroll-mt-24 ${
        resaltada ? "border-[#D4AF37] ring-2 ring-[#D4AF37]/40" : "border-gray-100"
      }`}
    >
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="font-serif text-lg text-gray-900">{titulo}</h2>
          {subtitulo && <p className="text-[11px] text-gray-400 mt-0.5">{subtitulo}</p>}
        </div>
        {toggle && (
          <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={toggle.activo}
              onChange={(e) => toggle.onChange(e.target.checked)}
              className="accent-[#D4AF37] w-4 h-4"
            />
            Mostrar
          </label>
        )}
      </div>
      <div className={toggle && !toggle.activo ? "opacity-40 pointer-events-none" : ""}>{children}</div>
    </section>
  );
}

function Interruptor({
  icono,
  titulo,
  detalle,
  activo,
  onChange,
}: {
  icono: React.ReactNode;
  titulo: string;
  detalle: string;
  activo: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      className={`flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition-colors ${
        activo ? "border-[#D4AF37] bg-[#D4AF37]/5" : "border-gray-200 hover:border-gray-300"
      }`}
    >
      <input
        type="checkbox"
        checked={activo}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-[#D4AF37] w-4 h-4 mt-0.5"
      />
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
          {icono} {titulo}
        </span>
        <span className="block text-[11px] text-gray-500 mt-0.5 leading-snug">{detalle}</span>
      </span>
    </label>
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
