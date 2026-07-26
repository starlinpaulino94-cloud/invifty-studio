/**
 * APLICAR LA POLÍTICA DE VIGENCIAS A LOS PEDIDOS YA ENTREGADOS
 * ============================================================
 * Cambiar VIGENCIA_MESES en src/lib/planes.ts solo afecta a las entregas
 * FUTURAS: los pedidos ya entregados llevan su fecha de vencimiento
 * congelada con la política que hubiera ese día. Este script la recalcula.
 *
 * REGLA DE ORO: solo alarga, nunca acorta. Si el recálculo diera una fecha
 * anterior a la que ya tiene el pedido, se deja como está. A un cliente no
 * se le quita algo que ya se le prometió, aunque la política haya cambiado.
 *
 * Cómo usarlo (desde la raíz del proyecto):
 *
 *   # 1. Ver qué cambiaría, sin tocar nada
 *   node --experimental-strip-types --env-file=.env.local scripts/recalcular-vencimientos.mts
 *
 *   # 2. Si el listado te convence, aplicarlo
 *   node --experimental-strip-types --env-file=.env.local scripts/recalcular-vencimientos.mts --aplicar
 *
 * Sin --aplicar no escribe nada: solo enseña la tabla de cambios.
 * Requiere Node 22.6 o superior.
 */

import { createClient } from "@supabase/supabase-js";
import { calcularVencimiento } from "../src/lib/vencimientos.ts";
import { VIGENCIA_MESES, PLANES } from "../src/lib/planes.ts";
import type { Plan } from "../src/lib/tipos.ts";

const aplicar = process.argv.includes("--aplicar");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const clave = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;

if (!url || !clave) {
  console.error(
    "Faltan las variables de entorno. Ejecuta con:\n" +
      "  node --experimental-strip-types --env-file=.env.local scripts/recalcular-vencimientos.mts"
  );
  process.exit(1);
}

const supabase = createClient(url, clave, {
  auth: { persistSession: false, autoRefreshToken: false },
});

console.log("Política de vigencia configurada ahora mismo:");
for (const [plan, meses] of Object.entries(VIGENCIA_MESES)) {
  console.log(`  ${PLANES[plan as Plan].nombre.padEnd(10)} ${meses} meses`);
}
console.log(aplicar ? "\nMODO REAL: se van a guardar los cambios.\n" : "\nSIMULACIÓN: no se guarda nada.\n");

const { data: pedidos, error } = await supabase
  .from("pedidos")
  .select("id, plan, estado, fecha_entrega, fecha_vencimiento, clientes(nombre)")
  .not("fecha_entrega", "is", null);

if (error) {
  console.error("No se pudieron leer los pedidos:", error.message);
  process.exit(1);
}

interface Cambio {
  id: string;
  cliente: string;
  plan: Plan;
  antes: string | null;
  despues: string;
}

const alargar: Cambio[] = [];
const seRespeta: Cambio[] = [];

for (const pedido of pedidos ?? []) {
  const plan = pedido.plan as Plan;
  const nueva = calcularVencimiento(pedido.fecha_entrega as string, plan);
  if (!nueva) continue;

  const cambio: Cambio = {
    id: pedido.id as string,
    // Supabase devuelve la relación como objeto o como lista según el caso.
    cliente:
      (Array.isArray(pedido.clientes) ? pedido.clientes[0]?.nombre : (pedido.clientes as { nombre?: string } | null)?.nombre) ??
      "Cliente",
    plan,
    antes: pedido.fecha_vencimiento as string | null,
    despues: nueva,
  };

  if (!cambio.antes || nueva > cambio.antes) alargar.push(cambio);
  else if (nueva < cambio.antes) seRespeta.push(cambio);
}

if (seRespeta.length) {
  console.log(`Se dejan como están (la nueva política los acortaría) — ${seRespeta.length}:`);
  for (const c of seRespeta) {
    console.log(`  · ${c.cliente} (${PLANES[c.plan].nombre}): conserva ${c.antes}, no se toca ${c.despues}`);
  }
  console.log();
}

if (!alargar.length) {
  console.log("No hay nada que alargar: todos los pedidos ya reflejan la política actual.");
  process.exit(0);
}

console.log(`Se alargarían — ${alargar.length}:`);
for (const c of alargar) {
  console.log(`  · ${c.cliente} (${PLANES[c.plan].nombre}): ${c.antes ?? "sin fecha"} → ${c.despues}`);
}

if (!aplicar) {
  console.log("\nVuelve a ejecutarlo con --aplicar para guardar estos cambios.");
  process.exit(0);
}

let guardados = 0;
for (const c of alargar) {
  const { error: errorGuardar } = await supabase
    .from("pedidos")
    // Se limpia el aviso para que el repaso diario vuelva a avisar con la
    // fecha nueva, y se revive el pedido si se había dado por vencido.
    .update({
      fecha_vencimiento: c.despues,
      aviso_vencimiento_en: null,
      ...(c.antes && c.antes < new Date().toISOString().slice(0, 10) ? { estado: "activa" } : {}),
    })
    .eq("id", c.id);

  if (errorGuardar) console.warn(`  ✗ ${c.cliente}: ${errorGuardar.message}`);
  else guardados++;
}

console.log(`\nListo. ${guardados} de ${alargar.length} pedido(s) actualizados.`);
