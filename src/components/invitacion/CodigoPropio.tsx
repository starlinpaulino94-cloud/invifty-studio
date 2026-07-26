import { ATRIBUTOS_SANDBOX, aplicarMarcadores } from "@/lib/codigo";
import { fechaLarga } from "@/lib/fechas";
import type { DatosInvitacion, FotoInvitacion } from "@/lib/tipos";

/**
 * Muestra una invitación hecha fuera del sistema (por ejemplo con IA).
 *
 * Va dentro de un iframe con `sandbox` y SIN `allow-same-origin`: el
 * navegador le da un origen opaco, así que el código pegado no puede leer
 * la sesión del equipo ni tocar la página que lo contiene. Ver lib/codigo.ts.
 *
 * El contador de visitas y la vista previa al compartir viven en la página
 * de fuera, así que siguen funcionando igual que en las demás invitaciones.
 */
export default function CodigoPropio({
  html,
  datos,
  fotos,
  esBorrador,
}: {
  html: string | null;
  datos: DatosInvitacion;
  fotos: FotoInvitacion[];
  esBorrador?: boolean;
}) {
  const contenido = aplicarMarcadores(html ?? "", {
    fotos,
    titulo: datos.titulo,
    fecha: datos.fechaEvento ? fechaLarga(datos.fechaEvento) : "",
  });

  if (!contenido.trim()) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[#0D0D0F] px-6 text-center">
        <div>
          <p className="text-white/70 text-sm">Esta invitación todavía no tiene contenido.</p>
          {esBorrador && (
            <p className="text-white/35 text-xs mt-2">
              Pega el código en el editor del panel para verla aquí.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col bg-white">
      {esBorrador && (
        <div className="bg-amber-500 text-black text-center text-xs font-bold py-2 px-4 shrink-0">
          ⚠ BORRADOR — Solo visible para el equipo Invifty. Publica la invitación para compartirla.
        </div>
      )}
      <iframe
        srcDoc={contenido}
        sandbox={ATRIBUTOS_SANDBOX}
        title={datos.titulo || "Invitación"}
        className="flex-1 w-full border-0"
      />
    </div>
  );
}
