import type { DensidadOrnamental } from "@/lib/tipos";
import { RamoEsquina, RamaLateral, FollajeFondo } from "./OrnamentosFlorales";

/**
 * CAPA ORNAMENTAL
 * ================
 * El adorno que se suma por encima de la plantilla cuando la invitación
 * pide mucha presencia. Vive en `Marco`, así que las diez plantillas la
 * reciben sin tocar ninguna, y una plantilla nueva la hereda gratis.
 *
 * En "equilibrado" —el valor por defecto— no dibuja nada: las invitaciones
 * de siempre se ven exactamente igual que antes.
 *
 * Va detrás del contenido y con opacidad baja: enmarca sin competir con el
 * texto, que es lo que separa una invitación recargada de una recargada y
 * además ilegible.
 */
export default function CapaOrnamental({ densidad }: { densidad: DensidadOrnamental }) {
  if (densidad !== "extravagante") return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[1] overflow-hidden"
      style={{ color: "var(--inv-acento)" }}
      aria-hidden
    >
      {/* Ramos en las cuatro esquinas */}
      <RamoEsquina className="absolute -top-2 -left-2 w-40 sm:w-52 opacity-[0.28]" />
      <RamoEsquina className="absolute -top-2 -right-2 w-40 sm:w-52 opacity-[0.28] scale-x-[-1]" />
      <RamoEsquina className="absolute -bottom-2 -left-2 w-32 sm:w-44 opacity-[0.22] scale-y-[-1]" />
      <RamoEsquina className="absolute -bottom-2 -right-2 w-32 sm:w-44 opacity-[0.22] scale-[-1]" />

      {/* Ramas laterales, solo donde hay sitio de sobra */}
      <RamaLateral className="hidden lg:block absolute top-1/4 -left-4 w-24 opacity-[0.18]" />
      <RamaLateral className="hidden lg:block absolute top-1/3 -right-4 w-24 opacity-[0.18] scale-x-[-1]" />

      {/* Follaje muy tenue al fondo */}
      <FollajeFondo className="absolute inset-0 w-full h-full opacity-[0.09]" />
    </div>
  );
}
