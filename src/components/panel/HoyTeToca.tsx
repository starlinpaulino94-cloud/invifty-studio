import Link from "next/link";
import {
  ChevronRight, Hourglass, Inbox, MailWarning, PenLine, Rocket, Wallet,
  type LucideIcon,
} from "lucide-react";

/**
 * HOY TE TOCA — la parte del tablero que pide acción
 * ===================================================
 * Al abrir el panel, antes que ningún número decorativo: qué hay que
 * hacer. Solo aparece lo que existe (un cero no es una tarea), y cada
 * cosa lleva a donde se resuelve. Presentacional a propósito: el tablero
 * calcula, esto dibuja — y así se puede probar en el navegador con datos
 * de muestra.
 */

export interface TareaDeHoy {
  cuenta: number;
  etiqueta: string;
  /** null = tarjeta informativa sin destino (no mandar a un callejón). */
  href: string | null;
  icono: "leads" | "cobrar" | "vencer" | "avisos";
  tono: string;
}

export interface InvitacionPendiente {
  id: string;
  nombre: string;
}

const ICONOS: Record<TareaDeHoy["icono"], LucideIcon> = {
  leads: Inbox,
  cobrar: Wallet,
  vencer: Hourglass,
  avisos: MailWarning,
};

export function TiraDeTareas({ tareas }: { tareas: TareaDeHoy[] }) {
  const visibles = tareas.filter((t) => t.cuenta > 0);
  if (visibles.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {visibles.map((t) => {
        const Icono = ICONOS[t.icono];
        const contenido = (
          <>
            <Icono className="w-4 h-4 shrink-0" />
            <span className="font-bold">{t.cuenta}</span>
            <span>{t.etiqueta}</span>
            {t.href && <ChevronRight className="w-3.5 h-3.5 opacity-50" />}
          </>
        );
        const clases = `inline-flex items-center gap-1.5 text-xs border rounded-full px-3.5 py-2 ${t.tono}`;
        return t.href ? (
          <Link key={t.etiqueta} href={t.href} className={`${clases} hover:shadow-sm transition-shadow`}>
            {contenido}
          </Link>
        ) : (
          <span key={t.etiqueta} className={clases}>{contenido}</span>
        );
      })}
    </div>
  );
}

/** Caja de alerta con lista de invitaciones que esperan al equipo. */
export function AlertaRevisiones({
  variante,
  invitaciones,
}: {
  variante: "cambios" | "publicar";
  invitaciones: InvitacionPendiente[];
}) {
  if (invitaciones.length === 0) return null;

  const esCambios = variante === "cambios";
  const Icono = esCambios ? PenLine : Rocket;

  return (
    <div
      className={
        esCambios
          ? "bg-amber-50 border border-amber-200 rounded-2xl p-4"
          : "bg-emerald-50 border border-emerald-200 rounded-2xl p-4"
      }
    >
      <div
        className={`flex items-center gap-2 font-semibold text-sm mb-2 ${
          esCambios ? "text-amber-800" : "text-emerald-800"
        }`}
      >
        <Icono className="w-4 h-4" />
        {esCambios ? "Clientes que pidieron cambios" : "Aprobadas, listas para publicar"}
      </div>
      <ul className="space-y-1.5">
        {invitaciones.map((i) => (
          <li key={i.id}>
            <Link
              href={`/panel/invitaciones/${i.id}`}
              className={`text-sm hover:underline flex justify-between gap-2 ${
                esCambios ? "text-amber-900" : "text-emerald-900"
              }`}
            >
              <span>{i.nombre}</span>
              <span className="font-semibold shrink-0">
                {esCambios ? "ver comentarios →" : "publicar →"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
