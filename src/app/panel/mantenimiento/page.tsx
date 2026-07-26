import { Wrench } from "lucide-react";
import { RecalculoVencimientos, FotosLigeras } from "@/components/panel/Mantenimiento";

export const dynamic = "force-dynamic";

/**
 * Tareas que se hacen de vez en cuando y afectan a todos los pedidos a la
 * vez. Antes vivían en `scripts/` y solo se podían lanzar desde la terminal.
 * Los scripts siguen ahí, con la misma lógica, para quien prefiera esa vía.
 */
export default function PaginaMantenimiento() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="font-serif text-3xl text-gray-900 flex items-center gap-2">
          <Wrench className="w-6 h-6 text-[#D4AF37]" /> Mantenimiento
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Trabajos que tocan todos los pedidos a la vez. Ninguno se ejecuta solo:
          primero te enseñan qué van a hacer y tú decides.
        </p>
      </div>

      <RecalculoVencimientos />
      <FotosLigeras />

      <p className="text-[11px] text-gray-400 leading-relaxed">
        Las dos tareas existen también como comandos de terminal —{" "}
        <code className="bg-gray-100 px-1 py-0.5 rounded">npm run vencimientos:simular</code> y{" "}
        <code className="bg-gray-100 px-1 py-0.5 rounded">npm run fotos:ligeras</code> — y
        comparten la misma lógica, así que hacen exactamente lo mismo.
      </p>
    </div>
  );
}
