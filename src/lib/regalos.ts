import { estadoDeCapacidad, type ContratoCapacidades } from "./capacidades";
import { formatoDOP } from "./planes";

/**
 * LA MESA DE REGALOS — la lógica pura
 * ====================================
 * El invitado transfiere DIRECTO al anfitrión (sus cuentas, no las de
 * Invifty: aquí no se custodia dinero) y registra su regalo para que el
 * anfitrión tenga su lista de agradecimientos. Dos reglas que no se
 * negocian:
 *
 *  - Los montos son PRIVADOS del anfitrión: la página pública jamás
 *    lista quién dio qué.
 *  - Decir el monto es OPCIONAL: un regalo sin cifra sigue siendo un
 *    regalo, y presionar por el número sería de mal gusto.
 */

/** ¿El contrato incluye la mesa de regalos? (Premium y Luxury la venden
 * como "regalos"; los contratos viejos con la promesa también cuentan.) */
export function tieneMesaRegalos(contrato: ContratoCapacidades): boolean {
  const estado = estadoDeCapacidad(contrato, "regalos");
  return estado === "activa" || estado === "vendida_sin_implementar";
}

export const MAX_NOMBRE_APORTE = 80;
export const MAX_MENSAJE_APORTE = 300;
/** Tope técnico anti-error: un regalo de más de un millón es un typo. */
export const MAX_MONTO_APORTE = 1_000_000;

/** Valida lo que el invitado registra. El nombre manda; el monto es opcional. */
export function validarAporte(datos: {
  nombre: unknown;
  monto?: unknown;
  mensaje?: unknown;
}):
  | { ok: true; nombre: string; monto: number | null; mensaje: string | null }
  | { ok: false; error: string } {
  const nombre = String(datos.nombre ?? "").trim().replace(/\s+/g, " ").slice(0, MAX_NOMBRE_APORTE);
  if (nombre.length < 2) return { ok: false, error: "Dinos tu nombre para el agradecimiento." };

  let monto: number | null = null;
  const crudo = String(datos.monto ?? "").trim();
  if (crudo) {
    const numero = Number(crudo);
    if (!Number.isFinite(numero) || numero <= 0 || numero > MAX_MONTO_APORTE) {
      return { ok: false, error: "Ese monto no parece correcto: revísalo (o déjalo vacío)." };
    }
    monto = Math.round(numero * 100) / 100;
  }

  const mensaje = String(datos.mensaje ?? "").trim().slice(0, MAX_MENSAJE_APORTE) || null;
  return { ok: true, nombre, monto, mensaje };
}

/* ---------- Las cuentas del anfitrión ---------- */

export interface CuentaRegalo {
  banco: string;
  numero: string;
  titular: string;
  /** Cédula del titular, como la piden los bancos al transferir. */
  documento?: string;
}

export const MAX_CUENTAS_REGALO = 3;

/**
 * Limpia lo que el anfitrión guardó como cuentas: solo los campos
 * conocidos, con topes, y hasta 3 cuentas. Lo demás no entra.
 */
export function sanearCuentasRegalo(crudo: unknown): CuentaRegalo[] {
  if (!Array.isArray(crudo)) return [];
  const limpias: CuentaRegalo[] = [];
  for (const cuenta of crudo) {
    if (limpias.length >= MAX_CUENTAS_REGALO) break;
    if (!cuenta || typeof cuenta !== "object") continue;
    const c = cuenta as Record<string, unknown>;
    const banco = String(c.banco ?? "").trim().slice(0, 40);
    const numero = String(c.numero ?? "").trim().slice(0, 34);
    const titular = String(c.titular ?? "").trim().slice(0, 80);
    const documento = String(c.documento ?? "").trim().slice(0, 30);
    if (!banco || !numero || !titular) continue; // sin las tres, no es una cuenta
    limpias.push({ banco, numero, titular, ...(documento ? { documento } : {}) });
  }
  return limpias;
}

/* ---------- El resumen del anfitrión ---------- */

export interface ResumenAportes {
  regalos: number;
  /** Suma de los montos declarados (los sin monto no suman, pero cuentan). */
  totalDeclarado: number;
  sinMonto: number;
}

export function resumenAportes(
  aportes: { monto: number | null; estado: string }[]
): ResumenAportes {
  let total = 0;
  let sinMonto = 0;
  let regalos = 0;
  for (const a of aportes) {
    if (a.estado !== "visible") continue;
    regalos += 1;
    if (a.monto === null) sinMonto += 1;
    else total += Number(a.monto);
  }
  return { regalos, totalDeclarado: Math.round(total * 100) / 100, sinMonto };
}

/** Mensaje del anfitrión para compartir la mesa de regalos. */
export function mensajeWhatsAppRegalos(url: string): string {
  return (
    `🎁 Nuestra mesa de regalos\n\n` +
    `Si deseas hacernos un regalo, aquí están los datos (con botón para ` +
    `copiar) y puedes dejarnos tu mensaje:\n\n` +
    `${url}\n\n` +
    `Tu presencia es el mejor regalo. 💛`
  );
}

/** La línea del total para el anfitrión, honesta con lo no declarado. */
export function lineaTotal(resumen: ResumenAportes): string {
  const partes = [`${resumen.regalos} regalo${resumen.regalos === 1 ? "" : "s"}`];
  if (resumen.totalDeclarado > 0) partes.push(`${formatoDOP(resumen.totalDeclarado)} declarados`);
  if (resumen.sinMonto > 0) partes.push(`${resumen.sinMonto} sin monto`);
  return partes.join(" · ");
}
