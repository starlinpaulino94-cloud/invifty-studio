import Link from "next/link";
import { describirActividad, haceCuanto, type FilaActividad } from "@/lib/portal";
import { UserCheck } from "lucide-react";

/**
 * LA ACTIVIDAD DEL PORTAL EN EL TABLERO: lo que los clientes hicieron
 * solos (activar, invitar, editar textos, recuperar contraseña), sacado
 * de la auditoría — que ya lo tenía todo, solo que nadie lo enseñaba.
 * Sin actividad no ocupa sitio: el tablero no colecciona ceros.
 */
export default function ActividadPortal({
  filas,
  ahora,
}: {
  filas: FilaActividad[];
  ahora: Date;
}) {
  const lineas = filas
    .map((fila) => ({ frase: describirActividad(fila), fila }))
    .filter((l): l is { frase: string; fila: FilaActividad } => l.frase !== null);

  if (!lineas.length) return null;

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-gray-800 font-semibold text-sm">
          <UserCheck className="w-4 h-4 text-[#D4AF37]" />
          Actividad del portal de clientes
        </div>
        <Link href="/panel/clientes" className="text-xs text-gray-400 hover:text-gray-600">
          Ver clientes →
        </Link>
      </div>
      <ul className="divide-y divide-gray-50">
        {lineas.map(({ frase, fila }, i) => (
          <li key={i} className="flex items-baseline justify-between gap-3 py-1.5 text-xs">
            <span className="text-gray-600 truncate">{frase}</span>
            <span className="text-gray-300 whitespace-nowrap">
              {haceCuanto(fila.creado_en, ahora)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
