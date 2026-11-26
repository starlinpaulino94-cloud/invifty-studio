/**
 * LAS INICIALES DEL MONOGRAMA
 * ============================
 * "Camila & Lucas" → "C & L". Es lógica de cadenas, no un componente, y
 * vive aparte porque la usan ocho sitios — entre ellos la imagen de
 * OpenGraph (app/i/[slug]/opengraph-image.tsx), que se dibuja en el
 * SERVIDOR. Mientras estuvo dentro de un fichero de componentes, una ruta
 * de servidor importaba del mismo módulo que los ornamentos del
 * navegador: funciona hasta el día en que ese módulo necesita un hook.
 */

/** Extrae iniciales legibles de un título: "Camila & Lucas" → "C & L" */
export function inicialesDe(titulo: string): string {
  const partes = (titulo ?? "")
    .split(/\s*(?:&|y|\+)\s*/i)
    .map((p) => p.trim())
    .filter(Boolean);

  if (partes.length >= 2) {
    return partes
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join(" & ");
  }
  return ((titulo ?? "").trim()[0] ?? "I").toUpperCase();
}
