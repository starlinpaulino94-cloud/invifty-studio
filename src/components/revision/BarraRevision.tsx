"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2, MessageSquare, PenLine, Loader2, X, ChevronDown, ChevronUp, ImagePlus, Paperclip,
} from "lucide-react";
import {
  NOMBRE_SECCION, SECCIONES_COMENTABLES, type EstadoRevision,
} from "@/lib/revision";
import { fechaLarga } from "@/lib/fechas";

/**
 * LA BARRA DE REVISIÓN — lo único que se superpone a la invitación
 * =================================================================
 * El cliente está viendo su invitación tal cual; esta barra es el margen
 * donde opina. Tres caminos: comentar por sección (tantas veces como
 * quiera), pedir cambios (cierra la ronda y avisa al equipo), o aprobar
 * escribiendo su nombre — la firma que queda como evidencia junto a la
 * versión exacta que estaba viendo.
 *
 * Cada ronda es UNA decisión: después de aprobar o pedir cambios, la
 * barra lo dice y no ofrece botones que ya no harían nada (la API los
 * rechazaría igual: la pantalla nunca es la puerta de verdad).
 */

export interface ComentarioCliente {
  seccion: string;
  texto: string;
  estado: string;
  creado_en: string;
  /** true si el comentario llevó una imagen de referencia adjunta. */
  tieneImagen?: boolean;
}

type Modo = "cerrado" | "comentar" | "cambios" | "aprobar";

export default function BarraRevision({
  token,
  numeroVersion,
  estado,
  expiraEn,
  aprobadaPor,
  aprobadaEn,
  comentariosPrevios,
}: {
  token: string;
  numeroVersion: number;
  estado: EstadoRevision;
  expiraEn: string;
  aprobadaPor: string | null;
  aprobadaEn: string | null;
  comentariosPrevios: ComentarioCliente[];
}) {
  const router = useRouter();
  const [modo, setModo] = useState<Modo>("cerrado");
  const [seccion, setSeccion] = useState("general");
  const [texto, setTexto] = useState("");
  const [imagen, setImagen] = useState<File | null>(null);
  const [nombre, setNombre] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [comentarios, setComentarios] = useState(comentariosPrevios);
  const [verComentarios, setVerComentarios] = useState(false);

  const llamar = async (ruta: string, cuerpo: object): Promise<boolean> => {
    setEnviando(true);
    setError("");
    try {
      const res = await fetch(`/api/revision/${token}/${ruta}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "No se pudo enviar. Inténtalo de nuevo.");
        return false;
      }
      return true;
    } catch {
      setError("No se pudo enviar. Revisa tu conexión.");
      return false;
    } finally {
      setEnviando(false);
    }
  };

  const comentar = async () => {
    if (texto.trim().length < 2 && !imagen) return;

    // Con imagen va como multipart; sin ella, el JSON de siempre.
    let exito: boolean;
    if (imagen) {
      setEnviando(true);
      setError("");
      try {
        const cuerpo = new FormData();
        cuerpo.set("seccion", seccion);
        cuerpo.set("texto", texto);
        cuerpo.set("imagen", imagen);
        const res = await fetch(`/api/revision/${token}/comentario`, {
          method: "POST",
          body: cuerpo,
        });
        const json = await res.json().catch(() => ({}));
        exito = res.ok;
        if (!res.ok) setError(json.error ?? "No se pudo enviar. Inténtalo de nuevo.");
      } catch {
        exito = false;
        setError("No se pudo enviar. Revisa tu conexión.");
      } finally {
        setEnviando(false);
      }
    } else {
      exito = await llamar("comentario", { seccion, texto });
    }

    if (exito) {
      setComentarios([
        ...comentarios,
        {
          seccion,
          texto: texto.trim() || "(imagen de referencia)",
          estado: "abierto",
          creado_en: new Date().toISOString(),
          tieneImagen: imagen !== null,
        },
      ]);
      setTexto("");
      setImagen(null);
      setModo("cerrado");
    }
  };

  const decidir = async (decision: "aprobar" | "cambios") => {
    const cuerpo =
      decision === "aprobar" ? { decision, nombre } : { decision, comentario: texto };
    if (await llamar("decidir", cuerpo)) {
      router.refresh();
      setModo("cerrado");
    }
  };

  /* ---------- Rondas ya decididas: solo se informa ---------- */

  if (estado === "aprobada") {
    return (
      <Banda tono="verde">
        <CheckCircle2 className="w-4 h-4 shrink-0" />
        <span>
          Aprobaste la <b>versión {numeroVersion}</b>
          {aprobadaPor ? ` como ${aprobadaPor}` : ""}
          {aprobadaEn ? ` el ${fechaLarga(aprobadaEn.slice(0, 10))}` : ""}. ¡Gracias! El equipo se
          encarga del resto.
        </span>
      </Banda>
    );
  }

  if (estado === "cambios_solicitados") {
    return (
      <Banda tono="ambar">
        <PenLine className="w-4 h-4 shrink-0" />
        <span>
          Pediste cambios sobre la versión {numeroVersion}. El equipo los está trabajando y te
          enviará un enlace nuevo cuando estén listos.
        </span>
      </Banda>
    );
  }

  /* ---------- Ronda abierta ---------- */

  return (
    <div className="fixed bottom-0 inset-x-0 z-50">
      {modo !== "cerrado" && (
        <div className="mx-auto max-w-lg bg-white rounded-t-2xl shadow-2xl border border-b-0 border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold text-gray-900">
              {modo === "comentar" && "Comentar una sección"}
              {modo === "cambios" && "Pedir cambios"}
              {modo === "aprobar" && `Aprobar la versión ${numeroVersion}`}
            </p>
            <button onClick={() => { setModo("cerrado"); setError(""); }} aria-label="Cerrar">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>

          {modo === "comentar" && (
            <div className="space-y-3">
              <select
                value={seccion}
                onChange={(e) => setSeccion(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              >
                {SECCIONES_COMENTABLES.map((s) => (
                  <option key={s} value={s}>{NOMBRE_SECCION[s]}</option>
                ))}
              </select>
              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                rows={3}
                maxLength={1000}
                placeholder="Ej: En la portada, ¿pueden poner primero el nombre de ella?"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
              {/* "Quiero algo así" necesita un así: una imagen de referencia */}
              <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
                <ImagePlus className="w-4 h-4 text-gray-400 shrink-0" />
                {imagen ? (
                  <span className="flex items-center gap-1.5 text-gray-700">
                    {imagen.name}
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); setImagen(null); }}
                      aria-label="Quitar imagen"
                      className="text-gray-400 hover:text-red-500"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ) : (
                  "Adjuntar una imagen de referencia (opcional)"
                )}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => setImagen(e.target.files?.[0] ?? null)}
                />
              </label>
              <BotonPrincipal
                onClick={comentar}
                cargando={enviando}
                texto="Enviar comentario"
                deshabilitado={texto.trim().length < 2 && !imagen}
              />
            </div>
          )}

          {modo === "cambios" && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500">
                Cuéntanos en una línea qué quieres cambiar (tus comentarios por sección también
                cuentan). El equipo preparará una versión nueva.
              </p>
              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                rows={3}
                maxLength={1000}
                placeholder="Ej: Los colores me encantan pero la foto de portada no."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
              <BotonPrincipal onClick={() => decidir("cambios")} cargando={enviando} texto="Pedir cambios" />
            </div>
          )}

          {modo === "aprobar" && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500">
                Al aprobar confirmas que revisaste <b>esta versión</b> (nombres, fechas, lugares y
                textos) y que está lista para publicarse. Escribe tu nombre como firma.
              </p>
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                maxLength={80}
                placeholder="Tu nombre completo"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
              <BotonPrincipal
                onClick={() => decidir("aprobar")}
                cargando={enviando}
                texto="Aprobar mi invitación"
                deshabilitado={nombre.trim().length < 2}
              />
            </div>
          )}

          {error && <p className="text-xs text-red-600 mt-2">{error}</p>}

          {comentarios.length > 0 && modo === "comentar" && (
            <div className="mt-3 border-t border-gray-100 pt-2">
              <button
                onClick={() => setVerComentarios(!verComentarios)}
                className="text-[11px] text-gray-400 flex items-center gap-1"
              >
                {verComentarios ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
                {comentarios.length} comentario{comentarios.length === 1 ? "" : "s"} enviado{comentarios.length === 1 ? "" : "s"}
              </button>
              {verComentarios && (
                <ul className="mt-2 space-y-1.5 max-h-32 overflow-y-auto">
                  {comentarios.map((c, i) => (
                    <li key={i} className="text-[11px] text-gray-600">
                      <b className="text-gray-400">{NOMBRE_SECCION[c.seccion as keyof typeof NOMBRE_SECCION] ?? c.seccion}:</b>{" "}
                      {c.texto}
                      {c.tieneImagen && (
                        <Paperclip className="w-3 h-3 inline ml-1 text-gray-400" aria-label="Con imagen" />
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      <div className="bg-[#0D0D0F] text-white">
        <div className="mx-auto max-w-lg px-4 py-3 flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate">Revisa tu invitación · versión {numeroVersion}</p>
            <p className="text-[10px] text-gray-400 truncate">
              Enlace válido hasta el {fechaLarga(expiraEn.slice(0, 10))}
            </p>
          </div>
          <button
            onClick={() => { setModo(modo === "comentar" ? "cerrado" : "comentar"); setError(""); }}
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold border border-white/25 hover:border-white/60 px-3 py-2 rounded-lg transition-colors"
          >
            <MessageSquare className="w-3.5 h-3.5" /> Comentar
          </button>
          <button
            onClick={() => { setModo(modo === "cambios" ? "cerrado" : "cambios"); setError(""); }}
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold border border-white/25 hover:border-white/60 px-3 py-2 rounded-lg transition-colors"
          >
            <PenLine className="w-3.5 h-3.5" /> Cambios
          </button>
          <button
            onClick={() => { setModo(modo === "aprobar" ? "cerrado" : "aprobar"); setError(""); }}
            className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-[#D4AF37] hover:bg-[#F2D06B] text-black px-3 py-2 rounded-lg transition-colors"
          >
            <CheckCircle2 className="w-3.5 h-3.5" /> Aprobar
          </button>
        </div>
      </div>
    </div>
  );
}

function Banda({ tono, children }: { tono: "verde" | "ambar"; children: React.ReactNode }) {
  const estilos =
    tono === "verde"
      ? "bg-emerald-600 text-white"
      : "bg-amber-500 text-black";
  return (
    <div className={`fixed bottom-0 inset-x-0 z-50 ${estilos}`}>
      <div className="mx-auto max-w-lg px-4 py-3 flex items-center gap-2 text-xs font-medium">
        {children}
      </div>
    </div>
  );
}

function BotonPrincipal({
  onClick, cargando, texto, deshabilitado,
}: {
  onClick: () => void;
  cargando: boolean;
  texto: string;
  deshabilitado?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={cargando || deshabilitado}
      className="w-full inline-flex items-center justify-center gap-2 bg-[#0D0D0F] hover:bg-black text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50"
    >
      {cargando && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
      {texto}
    </button>
  );
}
