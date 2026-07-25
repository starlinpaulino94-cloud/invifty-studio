import Link from "next/link";
import { PLANTILLAS } from "@/config/plantillas";
import { PALETAS, TIPOGRAFIAS } from "@/config/diseno";
import { Eye, Palette, Type } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * Catálogo de plantillas: sirve al equipo para elegir con criterio y
 * para enseñarle al cliente cómo puede quedar su invitación.
 */
export default function CatalogoPlantillas() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="font-serif text-3xl text-gray-900">Catálogo de plantillas</h1>
        <p className="text-sm text-gray-500 mt-1">
          {PLANTILLAS.length} diseños × {Object.keys(PALETAS).length} paletas ×{" "}
          {Object.keys(TIPOGRAFIAS).length} tipografías. Abre cualquiera para verla en vivo
          con datos de ejemplo.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-5">
        {PLANTILLAS.map((p) => {
          const pal = PALETAS[p.paletaSugerida];
          const tip = TIPOGRAFIAS[p.tipografiaSugerida];
          return (
            <div
              key={p.id}
              className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
            >
              {/* Muestra de la paleta */}
              <div
                className="h-32 flex items-center justify-center relative"
                style={{ backgroundColor: pal.fondo }}
              >
                <div
                  className="absolute inset-4"
                  style={{ border: `1px solid color-mix(in srgb, ${pal.acento} 35%, transparent)` }}
                />
                <span
                  className="text-2xl tracking-[0.2em] uppercase"
                  style={{ color: pal.acento, fontFamily: "var(--font-serif)" }}
                >
                  {p.nombre.split(" ")[0]}
                </span>
              </div>

              <div className="p-5">
                <h2 className="font-serif text-xl text-gray-900">{p.nombre}</h2>
                <p className="text-xs text-gray-500 leading-relaxed mt-1.5">{p.descripcion}</p>
                <p className="text-[11px] text-[#B08D2A] mt-2.5 font-medium">{p.ideal}</p>

                <div className="flex flex-wrap gap-3 mt-4 text-[11px] text-gray-400">
                  <span className="inline-flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-[#D4AF37]" /> {pal.nombre}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Type className="w-3.5 h-3.5 text-[#D4AF37]" /> {tip.nombre}
                  </span>
                </div>

                <Link
                  href={`/muestra/${p.id}`}
                  target="_blank"
                  className="mt-5 w-full inline-flex items-center justify-center gap-2 bg-[#0D0D0F] text-white text-xs font-semibold py-3 rounded-xl hover:bg-black transition-colors"
                >
                  <Eye className="w-4 h-4 text-[#D4AF37]" />
                  Ver muestra en vivo
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
        <h2 className="font-serif text-lg text-gray-900 mb-3">Cómo se combinan</h2>
        <p className="text-sm text-gray-600 leading-relaxed">
          Cada plantilla define la <strong>estructura</strong> (portada, ornamentos, ritmo de las
          secciones). La <strong>paleta</strong> cambia todos los colores y la{" "}
          <strong>tipografía</strong> cambia el carácter de las letras. Además, cada invitación
          puede activar o desactivar secciones (historia, padrinos, cronograma, regalos, avisos)
          y efectos como el sobre lacrado o la música. Por eso no hay dos invitaciones iguales.
        </p>
      </div>
    </div>
  );
}
