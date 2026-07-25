import { Bloque, Pregunta } from "@/config/formularios";
import { formatoFecha } from "./planes";

/**
 * Convierte el valor crudo de una respuesta en texto legible
 * para mostrar y copiar desde el panel.
 */
export function formatearValor(pregunta: Pregunta, valor: unknown): string {
  if (valor === undefined || valor === null || valor === "") return "—";

  switch (pregunta.tipo) {
    case "seleccion": {
      if (Array.isArray(valor)) {
        return valor
          .map((v) => pregunta.opciones?.find((o) => o.valor === v)?.etiqueta ?? String(v))
          .join(", ");
      }
      const opcion = pregunta.opciones?.find((o) => o.valor === valor);
      return opcion ? opcion.etiqueta : String(valor); // texto libre de "Otro"
    }
    case "fecha":
      return formatoFecha(String(valor));
    case "lista": {
      const items = Array.isArray(valor) ? (valor as Record<string, string>[]) : [];
      if (!items.length) return "—";
      return items
        .map((item) =>
          (pregunta.campos ?? [])
            .map((c) => item[c.id])
            .filter(Boolean)
            .join(" — ")
        )
        .join("\n");
    }
    case "rsvp": {
      const v = valor as { fecha_limite?: string; acompanantes?: string };
      const partes: string[] = [];
      if (v.fecha_limite) partes.push(`Confirmar antes de: ${formatoFecha(v.fecha_limite)}`);
      if (v.acompanantes)
        partes.push(v.acompanantes === "si" ? "Con acompañantes" : "Sin acompañantes");
      return partes.join("\n") || "—";
    }
    case "fotos":
      return "(ver fotos subidas más abajo)";
    default:
      return String(valor);
  }
}

/** Texto plano de un bloque completo (para el botón "copiar sección"). */
export function textoDeBloque(bloque: Bloque, respuestas: Record<string, unknown>): string {
  const lineas = [`■ ${bloque.titulo.toUpperCase()}`];
  for (const pregunta of bloque.preguntas) {
    if (pregunta.tipo === "fotos") continue;
    lineas.push(`${pregunta.titulo}\n${formatearValor(pregunta, respuestas[pregunta.id])}`);
  }
  return lineas.join("\n\n");
}
