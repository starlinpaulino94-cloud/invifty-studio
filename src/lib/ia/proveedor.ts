import { proveedorMock } from "./mock";
import { modoIA } from "../entorno";
import type { ProveedorCreativo } from "./tipos";

/**
 * QUIÉN PROPONE — la llave del proveedor
 * =======================================
 * El dominio no sabe de proveedores: pide conceptos y punto. Aquí se
 * decide quién responde, según IA_PROVEEDOR (variable de entorno):
 *
 *  - "mock" (y el valor por defecto): el generador determinista local.
 *    Cero coste, cero red, flujo completo.
 *  - "anthropic": Claude, si además hay IA_API_KEY. El import es dinámico
 *    para que el SDK no viaje en ningún bundle mientras nadie lo usa.
 *  - "off": apagado del todo — la pantalla de conceptos lo dice en vez
 *    de fingir que genera.
 */
export async function proveedorActivo(): Promise<ProveedorCreativo | null> {
  const modo = modoIA();
  if (modo === "off") return null;
  if (modo === "anthropic") {
    const { proveedorAnthropic } = await import("./anthropic");
    return proveedorAnthropic;
  }
  return proveedorMock;
}
