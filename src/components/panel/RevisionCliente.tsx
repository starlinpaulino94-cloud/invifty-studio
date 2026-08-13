"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2, Copy, Loader2, Lock, LockOpen, Send, Ban, MessageSquare, Check,
} from "lucide-react";
import {
  enviarARevision, revocarRevision, desbloquearInvitacion, actualizarComentario,
} from "@/lib/acciones-revision";
import {
  estadoDeRevision, NOMBRE_ESTADO_REVISION, NOMBRE_SECCION,
  type RevisionVigencia, type SeccionComentable,
} from "@/lib/revision";
import { fechaLarga } from "@/lib/fechas";

/**
 * LA TARJETA DE REVISIÓN — el lado del equipo
 * ============================================
 * Aquí vive el ciclo completo con el cliente: congelar una versión y
 * mandarle el enlace, ver qué contestó (comentarios con su estado), y el
 * candado de la aprobación — que se enseña grande, porque explica por
 * qué "Guardar cambios" está diciendo que no.
 */

export interface ComentarioPanel {
  id: string;
  seccion: string;
  texto: string;
  estado: string;
  creado_en: string;
  /** URL firmada de la imagen de referencia, si el cliente adjuntó una. */
  imagenUrl?: string;
}

export interface RevisionPanel {
  id: string;
  estado: "abierta" | "cambios_solicitados" | "aprobada";
  expira_en: string;
  revocada_en: string | null;
  aprobada_en: string | null;
  aprobada_por: string | null;
  creado_en: string;
  token: string;
  numeroVersion: number;
  comentarios: ComentarioPanel[];
}

export default function RevisionCliente({
  invitacionId,
  bloqueadaEn,
  revisiones,
  urlBase,
}: {
  invitacionId: string;
  bloqueadaEn: string | null;
  revisiones: RevisionPanel[];
  urlBase: string;
}) {
  const router = useRouter();
  const [pendiente, empezar] = useTransition();
  const [motivo, setMotivo] = useState("");
  const [motivoDesbloqueo, setMotivoDesbloqueo] = useState("");
  const [error, setError] = useState("");
  const [urlNueva, setUrlNueva] = useState("");
  const [copiado, setCopiado] = useState("");

  const ahora = new Date();
  const ultima = revisiones[0] ?? null;

  const copiar = (texto: string, etiqueta: string) => {
    navigator.clipboard?.writeText(texto).then(() => {
      setCopiado(etiqueta);
      setTimeout(() => setCopiado(""), 1500);
    });
  };

  const enviar = () =>
    empezar(async () => {
      setError("");
      const r = await enviarARevision(invitacionId, motivo);
      if (!r.ok) return setError(r.error ?? "No se pudo enviar.");
      setUrlNueva(r.url ?? "");
      setMotivo("");
      router.refresh();
    });

  const revocar = (id: string) =>
    empezar(async () => {
      setError("");
      const r = await revocarRevision(id);
      if (!r.ok) return setError(r.error ?? "No se pudo revocar.");
      setUrlNueva("");
      router.refresh();
    });

  const desbloquear = () =>
    empezar(async () => {
      setError("");
      const r = await desbloquearInvitacion(invitacionId, motivoDesbloqueo);
      if (!r.ok) return setError(r.error ?? "No se pudo desbloquear.");
      setMotivoDesbloqueo("");
      router.refresh();
    });

  const marcarComentario = (id: string, estado: string) =>
    empezar(async () => {
      setError("");
      const r = await actualizarComentario(id, estado);
      if (!r.ok) return setError(r.error ?? "No se pudo actualizar.");
      router.refresh();
    });

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-sm font-bold text-gray-900">Revisión del cliente</h2>
        {revisiones.length > 0 && (
          <span className="text-[11px] text-gray-400">
            {revisiones.length} revisión{revisiones.length === 1 ? "" : "es"} enviada{revisiones.length === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {/* El candado */}
      {bloqueadaEn && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3">
          <p className="text-xs text-emerald-800 flex items-start gap-2">
            <Lock className="w-4 h-4 shrink-0" />
            <span>
              <b>Aprobada y bloqueada</b>
              {ultima?.aprobada_por ? ` por ${ultima.aprobada_por}` : ""} el{" "}
              {fechaLarga(bloqueadaEn.slice(0, 10))}. El editor no guardará cambios: lo que el
              cliente aprobó no se toca por descuido. Publicar sí está permitido.
            </span>
          </p>
          <div className="flex gap-2">
            <input
              value={motivoDesbloqueo}
              onChange={(e) => setMotivoDesbloqueo(e.target.value)}
              maxLength={300}
              placeholder="Motivo del desbloqueo (queda en auditoría)"
              className="flex-1 border border-emerald-200 rounded-lg px-3 py-2 text-xs"
            />
            <button
              onClick={desbloquear}
              disabled={pendiente || motivoDesbloqueo.trim().length < 5}
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold border border-emerald-300 hover:bg-emerald-100 text-emerald-800 px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              <LockOpen className="w-3.5 h-3.5" /> Desbloquear
            </button>
          </div>
        </div>
      )}

      {/* Enviar a revisión */}
      {!bloqueadaEn && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500">
            Congela la invitación tal como está (versión {(revisiones[0]?.numeroVersion ?? 0) + 1})
            y genera el enlace para que el cliente comente, pida cambios o apruebe. El enlace
            anterior queda revocado.
          </p>
          <div className="flex gap-2">
            <input
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              maxLength={300}
              placeholder="Nota para el historial (ej. primera propuesta)"
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-xs"
            />
            <button
              onClick={enviar}
              disabled={pendiente}
              className="inline-flex items-center gap-1.5 bg-[#0D0D0F] hover:bg-black text-white text-[11px] font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-60"
            >
              {pendiente ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Enviar a revisión
            </button>
          </div>
        </div>
      )}

      {urlNueva && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-2">
          <p className="text-[11px] text-amber-800 flex-1 break-all">{urlNueva}</p>
          <button
            onClick={() => copiar(urlNueva, "url")}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800"
          >
            {copiado === "url" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            Copiar
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      {/* Historial de revisiones con sus comentarios */}
      {revisiones.map((rev, i) => {
        const estado = estadoDeRevision(rev as unknown as RevisionVigencia, ahora);
        const esUltimaViva = i === 0 && estado === "abierta";
        return (
          <div key={rev.id} className="border border-gray-100 rounded-xl p-3 space-y-2">
            <div className="flex items-center gap-2 flex-wrap text-[11px]">
              <span className="font-bold text-gray-900">Versión {rev.numeroVersion}</span>
              <span
                className={
                  estado === "aprobada"
                    ? "text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5 inline-flex items-center gap-1"
                    : estado === "cambios_solicitados"
                      ? "text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5"
                      : estado === "abierta"
                        ? "text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5"
                        : "text-gray-500 bg-gray-50 border border-gray-200 rounded-full px-2 py-0.5"
                }
              >
                {estado === "aprobada" && <CheckCircle2 className="w-3 h-3" />}
                {NOMBRE_ESTADO_REVISION[estado]}
                {estado === "aprobada" && rev.aprobada_por ? ` · ${rev.aprobada_por}` : ""}
              </span>
              <span className="text-gray-400">{fechaLarga(rev.creado_en.slice(0, 10))}</span>
              {esUltimaViva && (
                <span className="ml-auto flex items-center gap-2">
                  <button
                    onClick={() => copiar(`${urlBase}/revision/${rev.token}`, rev.id)}
                    className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-900"
                  >
                    {copiado === rev.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    Enlace
                  </button>
                  <button
                    onClick={() => revocar(rev.id)}
                    disabled={pendiente}
                    className="inline-flex items-center gap-1 text-red-500 hover:text-red-700"
                  >
                    <Ban className="w-3 h-3" /> Revocar
                  </button>
                </span>
              )}
            </div>

            {rev.comentarios.length > 0 && (
              <ul className="space-y-1.5">
                {rev.comentarios.map((c) => (
                  <li key={c.id} className="text-xs text-gray-700 flex items-start gap-2">
                    <MessageSquare className="w-3.5 h-3.5 text-gray-300 shrink-0 mt-0.5" />
                    <span className="flex-1">
                      <b className="text-gray-400">
                        {NOMBRE_SECCION[c.seccion as SeccionComentable] ?? c.seccion}:
                      </b>{" "}
                      <span className={c.estado === "resuelto" ? "line-through text-gray-400" : ""}>
                        {c.texto}
                      </span>
                      {c.estado === "descartado" && (
                        <span className="text-gray-400"> (descartado)</span>
                      )}
                      {/* La referencia del cliente: miniatura que abre la
                          imagen completa (URL firmada del bucket privado) */}
                      {c.imagenUrl && (
                        <a
                          href={c.imagenUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block mt-1.5"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal: next/image no puede optimizarla */}
                          <img
                            src={c.imagenUrl}
                            alt="Imagen de referencia del cliente"
                            className="h-16 rounded-lg border border-gray-200 object-cover hover:opacity-80 transition-opacity"
                          />
                        </a>
                      )}
                    </span>
                    {c.estado !== "resuelto" && c.estado !== "descartado" && (
                      <span className="flex gap-1 shrink-0">
                        <button
                          onClick={() => marcarComentario(c.id, "resuelto")}
                          disabled={pendiente}
                          title="Marcar resuelto"
                          className="text-[10px] text-emerald-600 border border-emerald-200 rounded px-1.5 py-0.5 hover:bg-emerald-50"
                        >
                          Resuelto
                        </button>
                        <button
                          onClick={() => marcarComentario(c.id, "descartado")}
                          disabled={pendiente}
                          title="Descartar"
                          className="text-[10px] text-gray-500 border border-gray-200 rounded px-1.5 py-0.5 hover:bg-gray-50"
                        >
                          Descartar
                        </button>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}

      {revisiones.length === 0 && !bloqueadaEn && (
        <p className="text-[11px] text-gray-400">
          Aún no se ha enviado ninguna revisión. El cliente no necesita cuenta: recibirá un
          enlace que caduca a los 30 días y se puede revocar.
        </p>
      )}
    </div>
  );
}
