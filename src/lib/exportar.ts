/**
 * EXPORTAR A CSV — la lógica pura
 * ================================
 * Para la contabilidad: pedidos, pagos y clientes en un archivo que
 * Excel abre sin pelear. Dos detalles que no se negocian:
 *
 *  - El BOM (\uFEFF) al inicio: sin él, Excel en Windows lee "Pérez"
 *    como "PÃ©rez" y el archivo parece roto.
 *  - El escapado RFC 4180: una coma, una comilla o un salto de línea en
 *    una nota no puede desplazar columnas — un CSV corrido en dinero es
 *    un error de contabilidad esperando turno.
 */

export interface ColumnaCsv<T> {
  titulo: string;
  valor: (fila: T) => string | number | null | undefined;
}

/** Un campo CSV, escapado solo cuando hace falta (RFC 4180). */
export function campoCsv(valor: string | number | null | undefined): string {
  if (valor === null || valor === undefined) return "";
  const texto = String(valor);
  if (/[",\n\r]/.test(texto)) return `"${texto.replace(/"/g, '""')}"`;
  return texto;
}

/** El archivo completo: BOM + cabecera + filas. */
export function aCsv<T>(filas: T[], columnas: ColumnaCsv<T>[]): string {
  const lineas = [
    columnas.map((c) => campoCsv(c.titulo)).join(","),
    ...filas.map((fila) => columnas.map((c) => campoCsv(c.valor(fila))).join(",")),
  ];
  return "\uFEFF" + lineas.join("\r\n");
}

/** El nombre del archivo, con la fecha para que no se pisen. */
export function nombreArchivo(tipo: string, ahora: Date): string {
  const fecha = ahora.toISOString().slice(0, 10);
  return `invifty-${tipo}-${fecha}.csv`;
}
