import type { ConceptoCreativo } from "./tipos";

/**
 * LA HUELLA VISUAL — contra los conceptos repetidos
 * ==================================================
 * "Tres conceptos" que solo cambian un color no son tres conceptos: son
 * uno con maquillaje, y el equipo pierde el tiempo eligiendo entre
 * iguales. La huella resume las decisiones que de verdad cambian la cara
 * de una invitación, y la similitud las compara con pesos según cuánto
 * pesa cada una a la vista.
 *
 * Se ADVIERTE, no se rechaza: dos conceptos parecidos a veces son
 * legítimos (el cliente pidió "algo clásico, dos opciones"). La decisión
 * final es humana; esto solo evita que la repetición pase desapercibida.
 */

export interface HuellaVisual {
  plantilla: string;
  paleta: string;
  tipografia: string;
  densidad: string;
}

export function huellaVisual(c: ConceptoCreativo): HuellaVisual {
  return {
    plantilla: c.plantilla,
    paleta: c.paleta,
    tipografia: c.tipografia,
    densidad: c.densidad,
  };
}

/**
 * 0 = nada que ver, 1 = idénticos. La plantilla pesa lo que pesa: es la
 * estructura entera de la página. La densidad casi no se nota entre dos
 * invitaciones distintas, así que casi no cuenta.
 */
export function similitud(a: ConceptoCreativo, b: ConceptoCreativo): number {
  let puntos = 0;
  if (a.plantilla === b.plantilla) puntos += 0.45;
  if (a.paleta === b.paleta) puntos += 0.3;
  if (a.tipografia === b.tipografia) puntos += 0.15;
  if (a.densidad === b.densidad) puntos += 0.1;
  return puntos;
}

/** Por encima de esto, dos "conceptos distintos" son el mismo con maquillaje. */
export const UMBRAL_PARECIDO = 0.6;

/**
 * Revisa la tanda por pares y devuelve avisos legibles. Vacío = tanda
 * bien diferenciada.
 */
export function avisosDeParecido(conceptos: ConceptoCreativo[]): string[] {
  const avisos: string[] = [];
  for (let i = 0; i < conceptos.length; i++) {
    for (let j = i + 1; j < conceptos.length; j++) {
      const s = similitud(conceptos[i], conceptos[j]);
      if (s >= UMBRAL_PARECIDO) {
        avisos.push(
          `"${conceptos[i].nombre}" y "${conceptos[j].nombre}" se parecen demasiado ` +
            `(${Math.round(s * 100)}%): comparten ${
              conceptos[i].plantilla === conceptos[j].plantilla ? "plantilla" : "paleta"
            }. Vale la pena regenerar.`
        );
      }
    }
  }
  return avisos;
}
