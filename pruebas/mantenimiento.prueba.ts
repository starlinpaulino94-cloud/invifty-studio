import test from "node:test";
import assert from "node:assert/strict";

import {
  agruparActualizaciones, sumarAvance, seAtasco, TOTAL_VACIO,
  FOTOS_POR_TANDA, MS_POR_TANDA, type AvanceFotos,
} from "@/lib/mantenimiento";
import { planificarRecalculo, type PedidoRecalculo } from "@/lib/vencimientos";

/**
 * MANTENIMIENTO DESDE EL PANEL
 * =============================
 * Las dos tareas tocan todos los pedidos de una vez y no hay forma de
 * deshacerlas con un botón, así que lo que decide qué se escribe y hasta
 * dónde se llega se prueba aquí.
 */

const cambio = (id: string, despues: string, revive = false) => ({
  pedido: { id } as PedidoRecalculo,
  antes: null,
  despues,
  revive,
});

/* ---------- Agrupar escrituras ---------- */

test("los pedidos que acaban con la misma fecha se escriben de una vez", () => {
  const grupos = agruparActualizaciones([
    cambio("a", "2026-09-30"),
    cambio("b", "2026-09-30"),
    cambio("c", "2026-12-31"),
  ]);

  assert.equal(grupos.length, 2, "tres pedidos, dos escrituras");
  const septiembre = grupos.find((g) => g.fecha === "2026-09-30")!;
  assert.deepEqual(septiembre.ids.sort(), ["a", "b"]);
});

test("los que reviven no se mezclan con los que solo cambian de fecha", () => {
  // Los que reviven llevan además `estado: "activa"`. Meterlos en el mismo
  // grupo republicaría invitaciones que nadie mandó republicar.
  const grupos = agruparActualizaciones([
    cambio("a", "2026-09-30", true),
    cambio("b", "2026-09-30", false),
  ]);

  assert.equal(grupos.length, 2);
  assert.deepEqual(grupos.find((g) => g.revive)!.ids, ["a"]);
  assert.deepEqual(grupos.find((g) => !g.revive)!.ids, ["b"]);
});

test("no se pierde ni se duplica ningún pedido al agrupar", () => {
  const cambios = Array.from({ length: 50 }, (_, i) =>
    cambio(`p${i}`, `2026-0${(i % 9) + 1}-15`, i % 3 === 0)
  );

  const ids = agruparActualizaciones(cambios).flatMap((g) => g.ids);
  assert.equal(ids.length, 50);
  assert.equal(new Set(ids).size, 50);
});

test("sin cambios no se escribe nada", () => {
  assert.deepEqual(agruparActualizaciones([]), []);
});

test("lo que se agrupa es exactamente lo que el simulacro enseñó", () => {
  // El panel enseña `aAlargar` y luego escribe lo agrupado: si estas dos
  // listas se separaran, el equipo aprobaría una cosa y pasaría otra.
  const pedidos: PedidoRecalculo[] = [
    { id: "a", plan: "premium", estado: "entregada", fecha_entrega: "2026-01-15", fecha_vencimiento: "2026-04-15" },
    { id: "b", plan: "esencial", estado: "entregada", fecha_entrega: "2026-01-15", fecha_vencimiento: "2027-01-15" },
  ];

  const { aAlargar } = planificarRecalculo(pedidos, new Date("2026-07-01T12:00:00Z"));
  const ids = agruparActualizaciones(aAlargar).flatMap((g) => g.ids);

  assert.deepEqual(ids.sort(), aAlargar.map((c) => c.pedido.id).sort());
  assert.ok(!ids.includes("b"), "al esencial la política nueva lo acortaría: no se toca");
});

/* ---------- Tandas de fotos ---------- */

const tanda = (p: Partial<AvanceFotos> = {}): AvanceFotos => ({
  procesadas: 0,
  fallidas: 0,
  saltadas: 0,
  fallos: [],
  cursor: null,
  terminado: false,
  ...p,
});

test("una tanda cabe de sobra en el tiempo de una función de servidor", () => {
  // Vercel corta a los 60 s como mucho; el presupuesto interno deja margen
  // para que la llamada devuelva su avance en vez de morir a medias.
  assert.ok(MS_POR_TANDA < 60_000, "una tanda no puede acercarse al tiempo máximo");
  assert.ok(FOTOS_POR_TANDA > 0 && FOTOS_POR_TANDA <= 10);
});

test("el acumulado suma procesadas y fallidas, pero nunca las saltadas", () => {
  // Al cortar a mitad de un pedido, la tanda siguiente vuelve a ver las
  // fotos ya hechas y las salta. Sumarlas contaría la misma foto varias
  // veces y la barra de progreso pasaría del 100%.
  let total = TOTAL_VACIO;
  total = sumarAvance(total, tanda({ procesadas: 4, saltadas: 30 }));
  total = sumarAvance(total, tanda({ procesadas: 3, fallidas: 1, saltadas: 34 }));

  assert.equal(total.procesadas, 7);
  assert.equal(total.fallidas, 1);
  assert.equal(total.tandas, 2);
  assert.ok(!("saltadas" in total));
});

test("la lista de fallos se queda en un tamaño que se pueda leer", () => {
  let total = TOTAL_VACIO;
  for (let i = 0; i < 30; i++) {
    total = sumarAvance(total, tanda({ fallidas: 1, fallos: [`foto-${i}.jpg`] }));
  }
  assert.equal(total.fallidas, 30, "el conteo sí es completo");
  assert.equal(total.fallos.length, 20, "la lista visible se recorta");
});

test("el acumulado no muta lo que ya se había contado", () => {
  const antes = sumarAvance(TOTAL_VACIO, tanda({ procesadas: 2, fallos: ["a"] }));
  sumarAvance(antes, tanda({ procesadas: 5, fallos: ["b"] }));
  assert.equal(antes.procesadas, 2);
  assert.deepEqual(antes.fallos, ["a"]);
});

test("una tanda que no toca nada ni avanza se declara atascada", () => {
  // Sin esto el panel repetiría la misma llamada para siempre.
  assert.equal(seAtasco("pedido-7", tanda({ cursor: "pedido-7" })), true);
});

test("avanzar el cursor no es atascarse, aunque no haya nada que hacer", () => {
  // Pedidos sin fotos: no se procesa nada, pero el trabajo sí avanza.
  assert.equal(seAtasco("pedido-7", tanda({ cursor: "pedido-9" })), false);
});

test("trabajar sin mover el cursor no es atascarse", () => {
  // Es justo lo que pasa al cortar a mitad de un pedido con muchas fotos.
  assert.equal(seAtasco("pedido-7", tanda({ procesadas: 4, cursor: "pedido-7" })), false);
  assert.equal(seAtasco("pedido-7", tanda({ saltadas: 12, cursor: "pedido-7" })), false);
  assert.equal(seAtasco("pedido-7", tanda({ fallidas: 2, cursor: "pedido-7" })), false);
});

test("terminar no es atascarse", () => {
  assert.equal(seAtasco("pedido-7", tanda({ cursor: "pedido-7", terminado: true })), false);
});

test("el primer arranque no se confunde con un atasco", () => {
  assert.equal(seAtasco(null, tanda({ procesadas: 4, cursor: "pedido-1" })), false);
});
