import { formatoDOP } from "./planes";

/**
 * COBRO POR TRANSFERENCIA GUIADO — la lógica pura
 * ================================================
 * El dinero es donde menos se perdona un número flojo. Aquí viven,
 * puras y probadas: la validación de lo que el cliente reporta, los
 * nombres de cada estado y el mensaje de WhatsApp con el saldo.
 *
 * Un REPORTE no es un PAGO: el balance solo se mueve cuando el equipo
 * confirma contra el banco. Esta separación es el corazón del módulo.
 */

/** Tamaño máximo del comprobante que sube el cliente. */
export const COMPROBANTE_MAX_MB = 8;

export const COMPROBANTE_TIPOS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

export const MAX_REFERENCIA = 60;
export const MAX_NOTA = 300;

export type EstadoReporte = "pendiente" | "confirmado" | "rechazado";

export const NOMBRE_ESTADO_REPORTE: Record<EstadoReporte, string> = {
  pendiente: "Por confirmar",
  confirmado: "Confirmado",
  rechazado: "Rechazado",
};

/**
 * Valida lo que el cliente reporta. El monto manda; y sin referencia NI
 * comprobante no hay reporte — algo tiene que poder cruzarse con el banco.
 */
export function validarReporte(datos: {
  monto: unknown;
  referencia?: string | null;
  tieneComprobante: boolean;
}): { ok: true; monto: number; referencia: string | null } | { ok: false; error: string } {
  const monto = Number(datos.monto);
  if (!Number.isFinite(monto) || monto <= 0) {
    return { ok: false, error: "Escribe el monto que transferiste." };
  }
  if (monto > 1_000_000) {
    return { ok: false, error: "Ese monto no parece correcto: revísalo." };
  }
  const referencia = (datos.referencia ?? "").trim().slice(0, MAX_REFERENCIA) || null;
  if (!referencia && !datos.tieneComprobante) {
    return {
      ok: false,
      error: "Adjunta el comprobante o escribe el número de referencia: sin eso no podemos ubicar tu pago.",
    };
  }
  return { ok: true, monto: Math.round(monto * 100) / 100, referencia };
}

/** Mensaje para mandar el enlace de cobro por WhatsApp, con el saldo. */
export function mensajeWhatsAppCobro(
  nombreCliente: string,
  saldo: number,
  url: string
): string {
  const primerNombre = nombreCliente.split(" ")[0];
  return (
    `¡Hola ${primerNombre}! 💛 Te escribimos de Invifty.\n\n` +
    `Tu saldo pendiente es *${formatoDOP(saldo)}*. En este enlace tienes ` +
    `nuestras cuentas (con botón para copiar) y puedes subir tu comprobante ` +
    `al terminar — así lo confirmamos rapidito:\n\n` +
    `💳 ${url}\n\n` +
    `¡Cualquier duda estamos aquí!`
  );
}
