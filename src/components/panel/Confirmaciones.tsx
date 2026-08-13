import { Confirmacion } from "@/lib/tipos";
import { formatoFecha } from "@/lib/planes";
import { BotonExportarConfirmaciones, BotonCopiar } from "./Interactivos";
import { UserCheck, UserX, Users } from "lucide-react";

/**
 * Lista de confirmaciones de asistencia de una invitación.
 * Es lo que el equipo le pasa al anfitrión para el salón y el catering,
 * así que lo primero y más grande es el total de personas.
 */
export default function Confirmaciones({
  confirmaciones,
  nombreEvento,
  etiquetas = {},
}: {
  confirmaciones: Confirmacion[];
  nombreEvento: string;
  /** Texto de cada pregunta extra del RSVP, por id (para las respuestas). */
  etiquetas?: Record<string, string>;
}) {
  const asisten = confirmaciones.filter((c) => c.asiste);
  const noAsisten = confirmaciones.filter((c) => !c.asiste);
  const totalPersonas = asisten.reduce((s, c) => s + c.cantidad, 0);

  /** "¿Qué menú prefieren? Pollo · ¿Transporte? Sí" — o vacío. */
  const textoRespuestas = (c: Confirmacion) =>
    Object.entries(c.respuestas ?? {})
      .map(([id, valor]) => `${etiquetas[id] ?? id}: ${valor}`)
      .join(" · ");

  /** Resumen en texto plano, listo para pegar en WhatsApp al anfitrión. */
  const resumenTexto = [
    `CONFIRMACIONES — ${nombreEvento}`,
    `Asisten: ${totalPersonas} persona(s) en ${asisten.length} confirmación(es)`,
    ...(noAsisten.length ? [`No podrán asistir: ${noAsisten.length}`] : []),
    "",
    ...asisten.map(
      (c) =>
        `• ${c.nombre}` +
        (c.cantidad > 1 ? ` (${c.cantidad} personas)` : "") +
        (textoRespuestas(c) ? ` — ${textoRespuestas(c)}` : "") +
        (c.nota ? ` — ${c.nota}` : "")
    ),
    ...(noAsisten.length
      ? ["", ...noAsisten.map((c) => `× ${c.nombre} — no asistirá${c.nota ? ` — ${c.nota}` : ""}`)]
      : []),
  ].join("\n");

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <h2 className="font-serif text-lg text-gray-900 flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-[#D4AF37]" />
          Confirmaciones de asistencia
        </h2>
        {confirmaciones.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <BotonCopiar texto={resumenTexto} etiqueta="Copiar resumen" />
            <BotonExportarConfirmaciones
              filas={confirmaciones}
              nombreArchivo={`confirmaciones-${nombreEvento.toLowerCase().replace(/[^a-z0-9]+/gi, "-")}`}
            />
          </div>
        )}
      </div>

      {confirmaciones.length === 0 ? (
        <p className="text-sm text-gray-400">
          Todavía nadie ha confirmado. Las confirmaciones aparecen aquí en cuanto
          los invitados las envían desde la invitación publicada.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 text-center mb-5">
            <div className="bg-emerald-50 rounded-xl py-3">
              <p className="text-[10px] uppercase tracking-wider text-emerald-600 font-semibold">
                Personas
              </p>
              <p className="text-xl font-bold text-emerald-700">{totalPersonas}</p>
            </div>
            <div className="bg-gray-50 rounded-xl py-3">
              <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">
                Confirmaron
              </p>
              <p className="text-xl font-bold text-gray-900">{asisten.length}</p>
            </div>
            <div className="bg-gray-50 rounded-xl py-3">
              <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">
                No asisten
              </p>
              <p className="text-xl font-bold text-gray-500">{noAsisten.length}</p>
            </div>
          </div>

          <ul className="divide-y divide-gray-100">
            {confirmaciones.map((c) => (
              <li key={c.id} className="py-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-gray-900 flex items-center gap-2">
                    {c.asiste ? (
                      <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    ) : (
                      <UserX className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                    )}
                    <span className="font-medium">{c.nombre}</span>
                    {c.asiste && c.cantidad > 1 && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                        <Users className="w-3 h-3" />
                        {c.cantidad}
                      </span>
                    )}
                  </p>
                  {textoRespuestas(c) && (
                    <p className="text-xs text-gray-500 mt-1 ml-[22px]">{textoRespuestas(c)}</p>
                  )}
                  {c.nota && (
                    <p className="text-xs text-gray-500 mt-1 ml-[22px] whitespace-pre-line">
                      {c.nota}
                    </p>
                  )}
                </div>
                <span className="text-[11px] text-gray-400 shrink-0 mt-0.5">
                  {formatoFecha(c.creado_en)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
