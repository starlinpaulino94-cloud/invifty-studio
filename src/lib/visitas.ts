import { createHash } from "node:crypto";

/**
 * CONTEO DE VISITAS DE UNA INVITACIÓN
 * ====================================
 * Sirve para poder decirle al cliente "tu invitación se abrió 340 veces y
 * la vieron unas 180 personas". Es prueba del trabajo entregado y el mejor
 * argumento para renovar la vigencia.
 *
 * PRIVACIDAD: no se guarda la IP de nadie, ni cookies, ni identificadores
 * que sigan a una persona entre invitaciones. Solo se guarda una huella:
 * un hash irreversible de (id de la invitación + IP + navegador).
 *
 * El id de la invitación actúa de sal y nunca es público —la dirección que
 * se comparte es el slug—, así que la misma persona produce huellas
 * distintas en invitaciones distintas y no se la puede seguir de una a
 * otra. Tampoco se puede recorrer el rango de IPs para averiguar quién
 * visitó sin conocer antes ese id.
 */

/**
 * Huella anónima de una visita. Estable para el mismo dispositivo dentro de
 * la misma invitación, para poder contar personas distintas.
 */
export function huellaDeVisita(
  invitacionId: string,
  ip: string,
  navegador: string
): string {
  return createHash("sha256")
    .update(`${invitacionId}:${ip}:${navegador}`)
    .digest("hex")
    .slice(0, 32);
}

/**
 * La hora de la visita, redondeada hacia abajo. Se guarda una fila por
 * dispositivo y hora: si un invitado recarga la invitación quince veces
 * seguidas cuenta como una sola apertura, y así el número que ve el cliente
 * significa algo.
 */
export function horaTruncada(fecha: Date): string {
  const copia = new Date(fecha);
  copia.setUTCMinutes(0, 0, 0);
  return copia.toISOString();
}

/** Primera línea de la cabecera de IP reenviada, que es la del visitante. */
export function ipDeCabecera(reenviada: string | null, real: string | null): string {
  const primera = (reenviada ?? "").split(",")[0]?.trim();
  return primera || real?.trim() || "desconocida";
}

export interface ResumenVisitas {
  aperturas: number;
  personas: number;
  primera: string | null;
  ultima: string | null;
  ultimos7Dias: number;
}

/**
 * Resume las filas de visitas en los números que se le enseñan al equipo.
 * Se calcula aquí y no en SQL para poder probarlo sin base de datos.
 */
export function resumirVisitas(
  filas: { huella: string; creado_en: string }[],
  ahora = new Date()
): ResumenVisitas {
  if (!filas.length) {
    return { aperturas: 0, personas: 0, primera: null, ultima: null, ultimos7Dias: 0 };
  }

  const fechas = filas.map((f) => f.creado_en).sort();
  const corte = new Date(ahora.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  return {
    aperturas: filas.length,
    personas: new Set(filas.map((f) => f.huella)).size,
    primera: fechas[0],
    ultima: fechas[fechas.length - 1],
    ultimos7Dias: fechas.filter((f) => f >= corte).length,
  };
}
