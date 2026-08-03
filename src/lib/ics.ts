/**
 * ARCHIVO DE CALENDARIO (.ics)
 * =============================
 * El botón "Guardar la fecha" solo sabía hablar con Google Calendar. Un
 * invitado con iPhone y calendario de iCloud —que aquí son muchísimos— no
 * tenía cómo guardarse el evento. El formato .ics (RFC 5545) lo abre
 * cualquier calendario: Apple, Google, Outlook.
 *
 * Además, el enlace de Google calculaba la hora final sumando 5 a mano:
 * un evento a las 20:00 producía "25:00". `sumarHoras` hace la cuenta de
 * verdad y la comparten el .ics y el enlace de Google.
 *
 * Todo lo de aquí es puro: recibe datos y devuelve texto. Quien sabe de
 * dónde salen los datos es la ruta (api/invitacion/[slug]/ics).
 */

/**
 * Cuánto dura el evento si nadie dice cuándo termina. Una boda o unos 15
 * realmente duran esto; para el calendario del invitado es suficiente.
 */
export const HORAS_EVENTO = 5;

/** La hora que se asume cuando el equipo no puso ninguna. */
export const HORA_POR_DEFECTO = "18:00";

/**
 * Zona horaria de los eventos. República Dominicana vive en UTC-4 fijo,
 * sin horario de verano, lo que hace el VTIMEZONE de abajo trivial.
 */
export const ZONA_HORARIA = "America/Santo_Domingo";

/** Suma horas a una fecha y hora locales, pasando de medianoche si toca. */
export function sumarHoras(
  fecha: string,
  hora: string,
  horas: number
): { fecha: string; hora: string } {
  const [a, m, d] = fecha.split("-").map(Number);
  const [hh, mm] = hora.split(":").map(Number);
  // Date.UTC como calculadora de calendario, no como reloj: aquí no hay
  // zona horaria, solo "las 20:00 más 5 horas son las 01:00 del día 13".
  const t = new Date(Date.UTC(a, m - 1, d, hh + horas, mm));
  const p = (n: number) => String(n).padStart(2, "0");
  return {
    fecha: `${t.getUTCFullYear()}-${p(t.getUTCMonth() + 1)}-${p(t.getUTCDate())}`,
    hora: `${p(t.getUTCHours())}:${p(t.getUTCMinutes())}`,
  };
}

/** "2026-12-12" + "17:30" → "20261212T173000", el formato del estándar. */
export function fechaCompacta(fecha: string, hora: string): string {
  return `${fecha.replace(/-/g, "")}T${hora.replace(":", "")}00`;
}

/**
 * El estándar manda escapar coma, punto y coma y barra invertida, y
 * escribir los saltos de línea como "\n" literal. Sin esto, una dirección
 * con comas ("Av. Anacaona, Santo Domingo") rompería el campo LOCATION.
 */
function escaparTexto(texto: string): string {
  return texto
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * Ninguna línea puede pasar de 75 bytes; las largas continúan en la
 * siguiente empezando por un espacio. Se cuenta en BYTES y no en letras
 * porque los acentos ocupan dos, y partir una letra por la mitad produce
 * un archivo que algunos calendarios rechazan entero.
 */
function plegar(linea: string): string {
  const LIMITE = 75;
  const medir = (s: string) => new TextEncoder().encode(s).length;
  if (medir(linea) <= LIMITE) return linea;

  const partes: string[] = [];
  let actual = "";
  let bytes = 0;
  for (const letra of linea) {
    const b = medir(letra);
    if (bytes + b > LIMITE) {
      partes.push(actual);
      actual = " "; // la continuación empieza con espacio, que también cuenta
      bytes = 1;
    }
    actual += letra;
    bytes += b;
  }
  partes.push(actual);
  return partes.join("\r\n");
}

export interface EventoIcs {
  /** Identifica el evento de forma estable: bajar el archivo dos veces actualiza, no duplica. */
  slug: string;
  titulo: string;
  fecha: string; // YYYY-MM-DD
  hora?: string; // HH:MM
  lugar?: string;
  descripcion?: string;
  /** Dirección pública de la invitación, para volver a ella desde el calendario. */
  url: string;
  /** Cuándo se tocó la invitación por última vez (ISO). Es el DTSTAMP. */
  actualizadoEn: string;
}

/** Construye el archivo .ics completo, con retornos CRLF como pide el estándar. */
export function icsDeInvitacion(evento: EventoIcs): string {
  const hora = evento.hora || HORA_POR_DEFECTO;
  const fin = sumarHoras(evento.fecha, hora, HORAS_EVENTO);

  const sello = new Date(evento.actualizadoEn)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");

  const lineas = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Invifty//Invitaciones digitales//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    // RD no cambia de hora en el año, así que la zona entera es esto.
    "BEGIN:VTIMEZONE",
    `TZID:${ZONA_HORARIA}`,
    "BEGIN:STANDARD",
    "DTSTART:19700101T000000",
    "TZOFFSETFROM:-0400",
    "TZOFFSETTO:-0400",
    "TZNAME:AST",
    "END:STANDARD",
    "END:VTIMEZONE",
    "BEGIN:VEVENT",
    `UID:${evento.slug}@invifty`,
    `DTSTAMP:${sello}`,
    `DTSTART;TZID=${ZONA_HORARIA}:${fechaCompacta(evento.fecha, hora)}`,
    `DTEND;TZID=${ZONA_HORARIA}:${fechaCompacta(fin.fecha, fin.hora)}`,
    `SUMMARY:${escaparTexto(evento.titulo)}`,
    evento.lugar ? `LOCATION:${escaparTexto(evento.lugar)}` : "",
    evento.descripcion ? `DESCRIPTION:${escaparTexto(evento.descripcion)}` : "",
    `URL:${evento.url}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);

  return lineas.map(plegar).join("\r\n") + "\r\n";
}
