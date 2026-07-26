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
 * (La decisión vive en `planificarRecalculo`, en src/lib/vencimientos.ts,
 * que tiene sus propias pruebas.)
 *
 * LA VÍA NORMAL ES EL PANEL: Panel → Mantenimiento tiene esto mismo como
 * botón, con la lógica compartida en src/lib/. Este script existe para
 * quien prefiera la terminal.
 *
 * NO es SQL: no se pega en Supabase. Es un programa que se ejecuta en la
 * terminal de tu computadora, dentro de la carpeta del proyecto:
 *
 *   # 1. Ver qué cambiaría, sin tocar nada
 *   npm run vencimientos:simular
 *
 *   # 2. Si el listado te convence, aplicarlo
 *   npm run vencimientos:aplicar
 *
 * Sin --aplicar no escribe nada: solo enseña la tabla de cambios.
 * Requiere Node 22.6 o superior y un .env.local con las claves.
 */

import { createClient } from "@supabase/supabase-js";
import { planificarRecalculo, type PedidoRecalculo } from "../src/lib/vencimientos.ts";
import { VIGENCIA_MESES, PLANES } from "../src/lib/planes.ts";
import type { Plan } from "../src/lib/tipos.ts";

const aplicar = process.argv.includes("--aplicar");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const clave = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;

if (!url || !clave) {
  console.error(
    "Falta el archivo .env.local con NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SECRET_KEY.\n" +
      "Ponlo en la raíz del proyecto y ejecuta:  npm run vencimientos:simular"
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

type PedidoConNombre = PedidoRecalculo & {
  clientes: { nombre: string } | { nombre: string }[] | null;
};

const { data, error } = await supabase
  .from("pedidos")
  .select("id, plan, estado, fecha_entrega, fecha_vencimiento, clientes(nombre)")
  .not("fecha_entrega", "is", null);

if (error) {
  console.error("No se pudieron leer los pedidos:", error.message);
  process.exit(1);
}

const pedidos = (data ?? []) as unknown as PedidoConNombre[];

/** Supabase devuelve la relación como objeto o como lista según el caso. */
function nombreDe(pedido: PedidoConNombre): string {
  const c = pedido.clientes;
  if (!c) return "Cliente";
  return (Array.isArray(c) ? c[0]?.nombre : c.nombre) ?? "Cliente";
}

const { aAlargar, seRespetan } = planificarRecalculo(pedidos);

if (seRespetan.length) {
  console.log(`Se dejan como están, la política nueva los acortaría — ${seRespetan.length}:`);
  for (const c of seRespetan) {
    console.log(
      `  · ${nombreDe(c.pedido)} (${PLANES[c.pedido.plan].nombre}): conserva ${c.antes}`
    );
  }
  console.log();
}

if (!aAlargar.length) {
  console.log("No hay nada que alargar: todos los pedidos ya reflejan la política actual.");
  process.exit(0);
}

const revividos = aAlargar.filter((c) => c.revive);

console.log(`Se alargarían — ${aAlargar.length}:`);
for (const c of aAlargar) {
  console.log(
    `  · ${nombreDe(c.pedido)} (${PLANES[c.pedido.plan].nombre}): ` +
      `${c.antes ?? "sin fecha"} → ${c.despues}${c.revive ? "  [vuelve a estar activa]" : ""}`
  );
}
if (revividos.length) {
  console.log(`\n${revividos.length} invitación(es) estaban vencidas y vuelven a publicarse.`);
}

if (!aplicar) {
  console.log("\nVuelve a ejecutarlo con --aplicar para guardar estos cambios.");
  process.exit(0);
}

let guardados = 0;
for (const c of aAlargar) {
  const { error: errorGuardar } = await supabase
    .from("pedidos")
    .update({
      fecha_vencimiento: c.despues,
      // Se limpia el aviso para que el repaso diario vuelva a avisar con la
      // fecha nueva, y se revive el pedido si se había dado por vencido.
      aviso_vencimiento_en: null,
      ...(c.revive ? { estado: "activa" } : {}),
    })
    .eq("id", c.pedido.id);

  if (errorGuardar) console.warn(`  ✗ ${nombreDe(c.pedido)}: ${errorGuardar.message}`);
  else guardados++;
}

console.log(`\nListo. ${guardados} de ${aAlargar.length} pedido(s) actualizados.`);
