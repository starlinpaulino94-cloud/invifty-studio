import { formatoFecha } from "@/lib/planes";
import type { ResumenVisitas } from "@/lib/visitas";
import { BotonCopiar } from "./Interactivos";
import { Eye, TrendingUp } from "lucide-react";

/**
 * Cuánto se ha abierto la invitación. Es el dato que el equipo le manda al
 * cliente como prueba de lo entregado, y la mejor excusa para hablar de
 * renovar la vigencia.
 */
export default function Visitas({
  resumen,
  nombreEvento,
}: {
  resumen: ResumenVisitas;
  nombreEvento: string;
}) {
  const hayVisitas = resumen.aperturas > 0;

  /** Mensaje listo para mandarle al cliente por WhatsApp. */
  const mensaje =
    `¡Hola! Te cuento cómo va tu invitación 💛\n\n` +
    `Se ha abierto ${resumen.aperturas} ${resumen.aperturas === 1 ? "vez" : "veces"}, ` +
    `por unas ${resumen.personas} ${resumen.personas === 1 ? "persona" : "personas"} distintas.` +
    (resumen.ultimos7Dias > 0 ? `\nEn los últimos 7 días: ${resumen.ultimos7Dias} aperturas.` : "") +
    (resumen.ultima ? `\nLa última visita fue el ${formatoFecha(resumen.ultima)}.` : "");

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <h2 className="font-serif text-lg text-gray-900 flex items-center gap-2">
          <Eye className="w-4 h-4 text-[#D4AF37]" />
          Cómo va la invitación
        </h2>
        {hayVisitas && <BotonCopiar texto={mensaje} etiqueta="Copiar para el cliente" />}
      </div>

      {!hayVisitas ? (
        <p className="text-sm text-gray-400">
          Todavía no se ha abierto. En cuanto {nombreEvento.split(" ")[0]} comparta el
          enlace, aquí verás cuántas veces la abren y cuánta gente la ve.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-gray-50 rounded-xl py-3">
              <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">
                Aperturas
              </p>
              <p className="text-xl font-bold text-gray-900">{resumen.aperturas}</p>
            </div>
            <div className="bg-[#FFFBF0] rounded-xl py-3">
              <p className="text-[10px] uppercase tracking-wider text-[#8A6D1F] font-semibold">
                Personas
              </p>
              <p className="text-xl font-bold text-[#8A6D1F]">{resumen.personas}</p>
            </div>
            <div className="bg-gray-50 rounded-xl py-3">
              <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold flex items-center justify-center gap-1">
                <TrendingUp className="w-3 h-3" /> 7 días
              </p>
              <p className="text-xl font-bold text-gray-900">{resumen.ultimos7Dias}</p>
            </div>
          </div>

          <p className="text-xs text-gray-400 mt-4">
            Primera visita el {formatoFecha(resumen.primera)} · última el{" "}
            {formatoFecha(resumen.ultima)}. Se cuenta una apertura por dispositivo y
            hora, así que recargar la página no infla el número.
          </p>
        </>
      )}
    </div>
  );
}
