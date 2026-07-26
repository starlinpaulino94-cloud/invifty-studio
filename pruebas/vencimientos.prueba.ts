import test from "node:test";
import assert from "node:assert/strict";

import {
  diasHasta, estadoVigencia, textoVigencia, repasarVencimientos, calcularVencimiento,
  sumarMeses, planificarRecalculo, DIAS_DE_AVISO,
  type PedidoVigencia, type PedidoRecalculo,
} from "@/lib/vencimientos";
import { mensajeWhatsAppRenovacion, VIGENCIA_MESES } from "@/lib/planes";
import type { Plan } from "@/lib/tipos";

/**
 * VENCIMIENTOS
 * =============
 * El repaso corre solo, una vez al día y sin nadie mirando. Si se equivoca
 * puede apagarle la invitación a un cliente antes de tiempo, o mandarle el
 * mismo correo al equipo cada mañana. Conviene fijarlo bien.
 */

const HOY = new Date("2026-06-15T13:00:00Z");

test("los días que faltan se cuentan por día natural, no por horas", () => {
  assert.equal(diasHasta("2026-06-15", HOY), 0, "vence hoy");
  assert.equal(diasHasta("2026-06-16", HOY), 1);
  assert.equal(diasHasta("2026-06-30", HOY), 15);
  assert.equal(diasHasta("2026-06-14", HOY), -1, "venció ayer");
  assert.equal(diasHasta("2026-05-15", HOY), -31);
  assert.ok(Number.isNaN(diasHasta("", HOY)));
});

test("la hora del día no cambia la cuenta", () => {
  // Mismo día natural, distintas horas: el resultado no puede bailar.
  for (const hora of ["00:30", "13:00", "23:45"]) {
    assert.equal(
      diasHasta("2026-06-20", new Date(`2026-06-15T${hora}:00Z`)),
      5,
      `falló a las ${hora}`
    );
  }
});

test("una invitación solo se da por vencida cuando la fecha ya pasó", () => {
  assert.equal(estadoVigencia("2026-06-14", HOY), "vencida");
  // El último día todavía cuenta como vigente: al cliente se le prometió ese día.
  assert.equal(estadoVigencia("2026-06-15", HOY), "por_vencer");
  assert.equal(estadoVigencia("2026-06-30", HOY), "por_vencer", `${DIAS_DE_AVISO} días justos`);
  assert.equal(estadoVigencia("2026-07-01", HOY), "vigente", "un día más allá del aviso");
  assert.equal(estadoVigencia("2027-01-01", HOY), "vigente");
});

test("el texto de vigencia se lee en español natural", () => {
  assert.equal(textoVigencia("2026-06-15", HOY), "vence hoy");
  assert.equal(textoVigencia("2026-06-16", HOY), "vence mañana");
  assert.equal(textoVigencia("2026-06-27", HOY), "vence en 12 días");
  assert.equal(textoVigencia("2026-06-14", HOY), "venció ayer");
  assert.equal(textoVigencia("2026-06-12", HOY), "venció hace 3 días");
});

/* ---------- Cálculo de la fecha de vencimiento ---------- */

test("una entrega a fin de mes no se desborda al mes siguiente", () => {
  // El cálculo anterior usaba setMonth: el 31 de agosto + 6 meses daba el 3
  // de marzo, regalándole tres días a unos clientes y a otros no.
  assert.equal(sumarMeses("2026-08-31", 6), "2027-02-28", "febrero corto");
  assert.equal(sumarMeses("2026-01-31", 3), "2026-04-30", "abril tiene 30 días");
  assert.equal(sumarMeses("2028-08-31", 6), "2029-02-28");
  assert.equal(sumarMeses("2027-08-31", 6), "2028-02-29", "año bisiesto");
  // Un día que existe en el mes destino no se toca
  assert.equal(sumarMeses("2026-03-15", 3), "2026-06-15");
});

test("sumar meses cruza el fin de año correctamente", () => {
  assert.equal(sumarMeses("2026-11-15", 3), "2027-02-15");
  assert.equal(sumarMeses("2026-12-01", 12), "2027-12-01");
  assert.equal(sumarMeses("2026-06-10", 0), "2026-06-10");
});

test("el vencimiento respeta los meses del plan y cruza bien el año", () => {
  for (const [plan, mesesPlan] of Object.entries(VIGENCIA_MESES)) {
    const resultado = calcularVencimiento("2026-11-15", plan as never);
    const esperado = new Date(Date.UTC(2026, 10 + mesesPlan, 15)).toISOString().slice(0, 10);
    assert.equal(resultado, esperado, `el plan ${plan} debería sumar ${mesesPlan} meses`);
  }
});

test("una fecha de entrega inválida no inventa un vencimiento", () => {
  assert.equal(calcularVencimiento("", "popular"), "");
  assert.equal(calcularVencimiento("no es fecha", "popular"), "");
});

/* ---------- El repaso diario ---------- */

function pedido(parcial: Partial<PedidoVigencia> & { id: string }): PedidoVigencia {
  return {
    estado: "entregada",
    fecha_vencimiento: null,
    aviso_vencimiento_en: null,
    ...parcial,
  };
}

test("el repaso separa lo que hay que marcar de lo que hay que avisar", () => {
  const { aMarcarVencidas, aAvisar } = repasarVencimientos(
    [
      pedido({ id: "vencida", fecha_vencimiento: "2026-06-01" }),
      pedido({ id: "vence-pronto", fecha_vencimiento: "2026-06-25" }),
      pedido({ id: "lejana", fecha_vencimiento: "2026-12-01" }),
    ],
    HOY
  );

  assert.deepEqual(aMarcarVencidas.map((p) => p.id), ["vencida"]);
  assert.deepEqual(aAvisar.map((p) => p.id), ["vence-pronto"]);
});

test("no se avisa dos veces del mismo pedido", () => {
  const { aAvisar } = repasarVencimientos(
    [
      pedido({ id: "ya-avisado", fecha_vencimiento: "2026-06-25", aviso_vencimiento_en: "2026-06-14T13:00:00Z" }),
      pedido({ id: "sin-avisar", fecha_vencimiento: "2026-06-25" }),
    ],
    HOY
  );

  assert.deepEqual(
    aAvisar.map((p) => p.id),
    ["sin-avisar"],
    "el equipo no puede recibir el mismo correo cada mañana"
  );
});

test("no se toca lo que aún no se ha entregado ni lo ya vencido", () => {
  const { aMarcarVencidas, aAvisar } = repasarVencimientos(
    [
      pedido({ id: "en-diseno", estado: "en_diseno", fecha_vencimiento: "2026-06-01" }),
      pedido({ id: "nuevo", estado: "nuevo", fecha_vencimiento: "2026-06-20" }),
      pedido({ id: "ya-vencida", estado: "vencida", fecha_vencimiento: "2026-01-01" }),
    ],
    HOY
  );

  assert.deepEqual(aMarcarVencidas, [], "solo se marcan las que están publicadas");
  assert.deepEqual(aAvisar, []);
});

test("un pedido sin fecha de vencimiento se ignora", () => {
  const { aMarcarVencidas, aAvisar } = repasarVencimientos(
    [pedido({ id: "sin-fecha", estado: "activa" })],
    HOY
  );
  assert.deepEqual(aMarcarVencidas, []);
  assert.deepEqual(aAvisar, []);
});

test("una invitación en estado activa también entra en el repaso", () => {
  const { aMarcarVencidas } = repasarVencimientos(
    [pedido({ id: "activa", estado: "activa", fecha_vencimiento: "2026-06-01" })],
    HOY
  );
  assert.deepEqual(aMarcarVencidas.map((p) => p.id), ["activa"]);
});

/* ---------- Recálculo al cambiar la política ---------- */

function entregado(
  id: string,
  plan: Plan,
  fechaEntrega: string,
  fechaVencimiento: string | null,
  estado: PedidoRecalculo["estado"] = "entregada"
): PedidoRecalculo {
  return { id, plan, estado, fecha_entrega: fechaEntrega, fecha_vencimiento: fechaVencimiento };
}

test("el recálculo alarga a quien la política nueva favorece", () => {
  // Entregado con la política vieja (Premium = 3 meses); ahora son 9.
  const { aAlargar } = planificarRecalculo(
    [entregado("premium", "premium", "2026-05-10", "2026-08-10")],
    HOY
  );

  assert.equal(aAlargar.length, 1);
  assert.equal(aAlargar[0].antes, "2026-08-10");
  assert.equal(aAlargar[0].despues, "2027-02-10", "9 meses desde la entrega");
});

test("el recálculo NUNCA acorta la vigencia de un cliente", () => {
  // Un pedido con una fecha más generosa de la que tocaría: se respeta.
  const { aAlargar, seRespetan } = planificarRecalculo(
    [entregado("regalado", "esencial", "2026-05-10", "2027-12-31")],
    HOY
  );

  assert.deepEqual(aAlargar, [], "no se toca");
  assert.equal(seRespetan.length, 1);
  assert.equal(
    seRespetan[0].pedido.fecha_vencimiento,
    "2027-12-31",
    "al cliente no se le quita algo ya prometido"
  );
});

test("un pedido que ya cuadra con la política no se toca", () => {
  const correcto = calcularVencimiento("2026-05-10", "popular");
  const { aAlargar, seRespetan } = planificarRecalculo(
    [entregado("ok", "popular", "2026-05-10", correcto)],
    HOY
  );
  assert.deepEqual(aAlargar, []);
  assert.deepEqual(seRespetan, []);
});

test("una invitación vencida que la política nueva revive queda marcada", () => {
  // Entregada hace 8 meses con 3 de vigencia: vencida. Con 9 meses, revive.
  const { aAlargar } = planificarRecalculo(
    [entregado("revive", "premium", "2025-10-15", "2026-01-15", "vencida")],
    HOY
  );

  assert.equal(aAlargar.length, 1);
  assert.equal(aAlargar[0].revive, true, "hay que devolverla a estado activa");
  assert.ok(aAlargar[0].despues > "2026-06-15", "la fecha nueva está en el futuro");
});

test("una invitación vencida que sigue vencida no se marca como reviviendo", () => {
  // Entregada hace mucho: ni con 9 meses llega a hoy.
  const { aAlargar } = planificarRecalculo(
    [entregado("vieja", "premium", "2024-01-10", "2024-04-10", "vencida")],
    HOY
  );

  assert.equal(aAlargar.length, 1, "se le corrige la fecha igualmente");
  assert.equal(aAlargar[0].revive, false, "sigue vencida, no hay que reactivarla");
});

test("un pedido sin fecha de entrega se ignora", () => {
  const { aAlargar, seRespetan } = planificarRecalculo(
    [{ id: "sin-entregar", plan: "popular", estado: "en_diseno", fecha_entrega: null, fecha_vencimiento: null }],
    HOY
  );
  assert.deepEqual(aAlargar, []);
  assert.deepEqual(seRespetan, []);
});

test("un pedido entregado sin fecha de vencimiento recibe una", () => {
  const { aAlargar } = planificarRecalculo(
    [entregado("sin-fecha", "luxury", "2026-05-10", null)],
    HOY
  );
  assert.equal(aAlargar.length, 1);
  assert.equal(aAlargar[0].antes, null);
  assert.equal(aAlargar[0].despues, "2027-05-10");
});

test("el mensaje de renovación lleva lo que el cliente necesita saber", () => {
  const mensaje = mensajeWhatsAppRenovacion(
    "Camila Rodríguez",
    "popular",
    "2026-06-30",
    "https://invifty.com/i/camila-y-lucas"
  );

  assert.match(mensaje, /Camila/, "saluda por su nombre");
  assert.match(mensaje, /30 de junio de 2026/, "dice hasta cuándo está en línea");
  assert.match(mensaje, /camila-y-lucas/, "incluye el enlace");
  assert.match(mensaje, /Popular/, "menciona su plan");
  assert.doesNotMatch(mensaje, /undefined|null|NaN/);
});

test("el mensaje funciona aunque no se haya guardado la URL", () => {
  const mensaje = mensajeWhatsAppRenovacion("Ana", "esencial", "2026-06-30", null);
  assert.doesNotMatch(mensaje, /undefined|null/);
  assert.match(mensaje, /Ana/);
});
