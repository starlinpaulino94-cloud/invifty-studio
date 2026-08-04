/**
 * FORMATO DE FECHAS EN ESPAÑOL
 * =============================
 * Formateamos a mano (sin toLocaleDateString) por dos razones:
 *  - servidor y navegador producen exactamente el mismo texto, sin errores
 *    de hidratación;
 *  - el español es siempre correcto, sin depender de los datos de idioma
 *    que tenga instalado el servidor.
 *
 * Módulo sin "use client": lo usan tanto las plantillas (cliente) como el
 * render de la tarjeta de vista previa y los metadatos (servidor).
 */

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** Interpreta "YYYY-MM-DD" como fecha local, sin desfases de zona horaria. */
function partes(fecha: string): { d: number; m: number; a: number; diaSemana: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(fecha ?? "");
  if (!m) return null;
  const anio = Number(m[1]);
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  const referencia = new Date(Date.UTC(anio, mes - 1, dia));
  return { d: dia, m: mes - 1, a: anio, diaSemana: referencia.getUTCDay() };
}

/** "sábado, 14 de febrero de 2026" */
export function fechaLarga(fecha: string): string {
  const p = partes(fecha);
  if (!p) return "";
  return `${DIAS[p.diaSemana]}, ${p.d} de ${MESES[p.m]} de ${p.a}`;
}

/** "14 de febrero de 2026" — sin el día de la semana. */
export function fechaSinDiaSemana(fecha: string): string {
  const p = partes(fecha);
  if (!p) return "";
  return `${p.d} de ${MESES[p.m]} de ${p.a}`;
}

export function fechaCorta(fecha: string): { dia: string; mes: string; anio: string; diaSemana: string } {
  const p = partes(fecha);
  if (!p) return { dia: "", mes: "", anio: "", diaSemana: "" };
  return {
    dia: String(p.d).padStart(2, "0"),
    mes: MESES[p.m],
    anio: String(p.a),
    diaSemana: DIAS[p.diaSemana],
  };
}

/** "18:30" → "6:30 p. m." */
export function hora12(hora: string): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(hora ?? "");
  if (!m) return hora ?? "";
  const h24 = Number(m[1]);
  const minutos = m[2];
  const sufijo = h24 >= 12 ? "p. m." : "a. m.";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${minutos} ${sufijo}`;
}

/* ============================================================
   HOY, EN LA ZONA DEL EVENTO
   ============================================================ */

/**
 * "YYYY-MM-DD" de hoy en República Dominicana (UTC-4 fijo, sin horario de
 * verano). No vale el hoy del servidor ni el del navegador: a las 10 de la
 * noche en Santo Domingo ya es "mañana" en UTC, y comparar contra ese
 * mañana cerraría el RSVP dos horas antes en su último día.
 */
export function hoyEnRD(ahora = new Date()): string {
  return new Date(ahora.getTime() - 4 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * true cuando una fecha "YYYY-MM-DD" ya quedó atrás. El día señalado
 * cuenta entero: "confirma antes del 15" admite confirmaciones el 15.
 * Sin fecha no hay límite, así que nunca vence.
 */
export function fechaVencida(fecha: string, ahora = new Date()): boolean {
  return !!fecha && hoyEnRD(ahora) > fecha;
}
