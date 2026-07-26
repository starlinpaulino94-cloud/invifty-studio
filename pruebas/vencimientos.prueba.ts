import test from "node:test";
import assert from "node:assert/strict";

import {
  diasHasta, estadoVigencia, textoVigencia, repasarVencimientos, DIAS_DE_AVISO,
  type PedidoVigencia,
} from "@/lib/vencimientos";
import { mensajeWhatsAppRenovacion } from "@/lib/planes";

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
