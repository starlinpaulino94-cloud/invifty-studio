import test from "node:test";
import assert from "node:assert/strict";

import {
  autorLimpio,
  estadoDeGaleria,
  MAX_AUTOR,
  mensajeWhatsAppGaleria,
  rutaGaleria,
  rutaGaleriaMiniatura,
  tieneGaleria,
} from "@/lib/galeria";
import { contratoDePedido, snapshotDeContrato } from "@/lib/capacidades";
import { CATALOGO, EXTRAS } from "@/lib/planes";

/**
 * LA GALERÍA COLABORATIVA
 * ========================
 * Lo que estas pruebas cuidan: que la tenga exactamente quien la pagó
 * (incluidos los contratos VIEJOS que la compraron cuando decía "vendida
 * sin implementar"), que una galería cerrada o de un borrador no exista
 * para el público, y que el catálogo ya no venda humo.
 */

test("el catálogo ya no la vende sin tenerla", () => {
  // La razón de ser de este módulo: cerrar la brecha declarada.
  const extra = EXTRAS.find((e) => e.id === "galeria_post_evento");
  assert.equal(extra?.estado, "activa", "el extra sigue como vendido sin implementar");
  const capacidad = CATALOGO.luxury.capacidades.find((c) => c.id === "galeria_post_evento");
  assert.equal(capacidad?.estado, "activa", "la capacidad de Luxury sigue como humo");
});

test("la tiene quien compró el extra, en cualquier plan", () => {
  const contrato = contratoDePedido({ plan: "esencial" });
  assert.equal(tieneGaleria({ extras: ["galeria_post_evento"] }, contrato), true);
  assert.equal(tieneGaleria({ extras: [] }, contrato), false, "Esencial sin extra no la tiene");
  assert.equal(tieneGaleria({ extras: ["bilingue"] }, contrato), false, "otro extra no cuenta");
});

test("Luxury la tiene por contrato, nuevo o viejo", () => {
  // Contrato NUEVO: la foto ya la congela como activa.
  const nuevo = contratoDePedido({
    plan: "luxury",
    capacidades_contratadas: JSON.parse(
      JSON.stringify(snapshotDeContrato("luxury", new Date("2026-08-26T12:00:00Z")))
    ),
  });
  assert.equal(tieneGaleria({ extras: [] }, nuevo), true);

  // Contrato VIEJO: su foto la congeló como "vendida_sin_implementar".
  // La pagó cuando era una promesa; ahora que existe, se le honra.
  const fotoVieja = JSON.parse(
    JSON.stringify(snapshotDeContrato("luxury", new Date("2026-08-20T12:00:00Z")))
  );
  for (const c of fotoVieja.capacidades) {
    if (c.id === "galeria_post_evento") c.estado = "vendida_sin_implementar";
  }
  const viejo = contratoDePedido({ plan: "luxury", capacidades_contratadas: fotoVieja });
  assert.equal(
    tieneGaleria({ extras: [] }, viejo),
    true,
    "negarla por el estado congelado castigaría al que confió primero"
  );
});

test("tres puertas a la vez: incluida, publicada y abierta", () => {
  const publicadaAbierta = { estado: "publicada", galeria_abierta: true };
  assert.equal(estadoDeGaleria(true, publicadaAbierta), "abierta");
  assert.equal(
    estadoDeGaleria(true, { estado: "publicada", galeria_abierta: false }),
    "cerrada",
    "cerrada se anuncia (vuelve pronto), no se esconde"
  );
  assert.equal(
    estadoDeGaleria(true, { estado: "borrador", galeria_abierta: true }),
    "no_disponible",
    "la galería de un borrador no existe para el público"
  );
  assert.equal(estadoDeGaleria(false, publicadaAbierta), "no_disponible", "sin contratarla, no hay álbum");
});

test("el nombre del invitado entra limpio o no entra", () => {
  assert.equal(autorLimpio("  Tía Rosa  "), "Tía Rosa");
  assert.equal(autorLimpio(""), null);
  assert.equal(autorLimpio("   "), null);
  assert.equal(autorLimpio(42), null);
  assert.equal(autorLimpio("a\u0001bc"), "abc", "sin caracteres de control");
  assert.equal(autorLimpio("x".repeat(200))!.length, MAX_AUTOR, "recortado al tope");
});

test("las rutas del bucket separan galería de las fotos del pedido", () => {
  // Las fotos del cliente viven en <pedidoId>/; las de la galería en
  // galeria/<invitacionId>/ — borrar un pedido barre carpetas distintas.
  assert.equal(rutaGaleria("inv1", "abc"), "galeria/inv1/abc.webp");
  assert.equal(rutaGaleriaMiniatura("inv1", "abc"), "galeria/inv1/min-abc.webp");
});

test("el mensaje para invitados lleva el enlace y nada más raro", () => {
  const msj = mensajeWhatsAppGaleria("https://studio.invifty.com/galeria/ana-y-luis");
  assert.ok(msj.includes("https://studio.invifty.com/galeria/ana-y-luis"));
  assert.match(msj, /fotos/i);
});
