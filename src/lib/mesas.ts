/**
 * EL ORGANIZADOR DE MESAS — la lógica pura
 * =========================================
 * Los hogares se asignan COMPLETOS a una mesa: las familias se sientan
 * juntas, y el modelo de hogares ya dice quiénes van juntos. La
 * ocupación se calcula contra las personas CONFIRMADAS de cada hogar —
 * el número que de verdad se sienta —, y si un hogar aún no confirma,
 * se cuenta su CUPO completo como reserva: mejor sobrar silla que
 * faltar.
 */

export const MIN_CAPACIDAD = 1;
export const MAX_CAPACIDAD = 100;
/** Tope técnico anti-abuso, no comercial. */
export const MAX_MESAS = 60;

export function nombreMesaValido(nombre: string): boolean {
  const limpio = nombre.trim();
  return limpio.length >= 1 && limpio.length <= 40;
}

export function capacidadValida(capacidad: number): boolean {
  return Number.isInteger(capacidad) && capacidad >= MIN_CAPACIDAD && capacidad <= MAX_CAPACIDAD;
}

export interface MesaBase {
  id: string;
  nombre: string;
  capacidad: number;
}

export interface HogarAsignable {
  id: string;
  nombre: string;
  cupo: number;
  mesa_id: string | null;
}

export interface OcupacionMesa extends MesaBase {
  hogares: HogarAsignable[];
  /** Personas confirmadas + cupo reservado de los que no han respondido. */
  personas: number;
  sobrecupo: boolean;
}

/**
 * Cuántas personas ocupa un hogar en su mesa: sus confirmadas si ya
 * respondió; su cupo completo como reserva si todavía no.
 */
export function personasDeHogar(
  hogar: { id: string; cupo: number },
  confirmadosPorHogar: Record<string, number>,
  respondieron: Set<string>
): number {
  if (respondieron.has(hogar.id)) return confirmadosPorHogar[hogar.id] ?? 0;
  return hogar.cupo;
}

/** El plano completo: cada mesa con sus hogares, personas y sobrecupo. */
export function ocupacionDeMesas(
  mesas: MesaBase[],
  hogares: HogarAsignable[],
  confirmadosPorHogar: Record<string, number>,
  respondieron: Set<string>
): OcupacionMesa[] {
  return mesas.map((mesa) => {
    const asignados = hogares.filter((h) => h.mesa_id === mesa.id);
    const personas = asignados.reduce(
      (suma, h) => suma + personasDeHogar(h, confirmadosPorHogar, respondieron),
      0
    );
    return { ...mesa, hogares: asignados, personas, sobrecupo: personas > mesa.capacidad };
  });
}

export function hogaresSinMesa(hogares: HogarAsignable[]): HogarAsignable[] {
  return hogares.filter((h) => !h.mesa_id);
}

/**
 * El plano en texto, para imprimir o mandar al venue por WhatsApp.
 * Sin teléfonos ni tokens: nombres de mesa, familias y personas.
 */
export function planoTexto(
  ocupacion: OcupacionMesa[],
  sinMesa: HogarAsignable[],
  titulo: string
): string {
  const lineas: string[] = [`🪑 *Plano de mesas — ${titulo}*`, ""];
  for (const mesa of ocupacion) {
    lineas.push(`*${mesa.nombre}* (${mesa.personas}/${mesa.capacidad})`);
    for (const h of mesa.hogares) lineas.push(`  · ${h.nombre}`);
    if (mesa.hogares.length === 0) lineas.push("  · (vacía)");
    lineas.push("");
  }
  if (sinMesa.length > 0) {
    lineas.push(`*Sin mesa todavía:*`);
    for (const h of sinMesa) lineas.push(`  · ${h.nombre}`);
  }
  return lineas.join("\n").trim();
}
