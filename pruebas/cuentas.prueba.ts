import test from "node:test";
import assert from "node:assert/strict";

import {
  DIAS_ACTIVACION,
  expiraActivacion,
  activacionVigente,
  passwordValida,
  MIN_PASSWORD,
  mensajeWhatsAppActivacion,
} from "@/lib/cuentas";

/**
 * LA ACTIVACIÓN DEL PORTAL
 * =========================
 * Si estas reglas fallan, no da error en ninguna pantalla: deja un
 * enlace de activación eterno rodando por WhatsApp — una llave sin
 * fecha de cambio — o re-activa cuentas que ya no debían activarse.
 */

const AHORA = new Date("2026-08-14T12:00:00Z");

test("el enlace caduca exactamente a los 7 días", () => {
  const expira = new Date(expiraActivacion(AHORA));
  const dias = (expira.getTime() - AHORA.getTime()) / (24 * 60 * 60 * 1000);
  assert.equal(dias, DIAS_ACTIVACION);
});

test("una activación vigente exige las tres cosas a la vez", () => {
  const manana = new Date(AHORA.getTime() + 24 * 60 * 60 * 1000).toISOString();
  const ayer = new Date(AHORA.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const buena = { estado: "pendiente", token_activacion: "abc", activacion_expira: manana };
  assert.equal(activacionVigente(buena, AHORA), true);

  // Caducada: el enlace viejo de WhatsApp ya no abre nada.
  assert.equal(activacionVigente({ ...buena, activacion_expira: ayer }, AHORA), false);

  // Sin token o sin fecha: nunca vigente.
  assert.equal(activacionVigente({ ...buena, token_activacion: null }, AHORA), false);
  assert.equal(activacionVigente({ ...buena, activacion_expira: null }, AHORA), false);

  // Una cuenta ya activa o suspendida no se re-activa con un enlace viejo:
  // el token es de UN solo uso.
  assert.equal(activacionVigente({ ...buena, estado: "activa" }, AHORA), false);
  assert.equal(activacionVigente({ ...buena, estado: "suspendida" }, AHORA), false);
});

test("el borde exacto de la caducidad no abre", () => {
  const justoAhora = AHORA.toISOString();
  const cuenta = { estado: "pendiente", token_activacion: "abc", activacion_expira: justoAhora };
  assert.equal(activacionVigente(cuenta, AHORA), false, "expira > ahora, no >=");
});

test("la contraseña mínima es la que decimos", () => {
  assert.equal(passwordValida("a".repeat(MIN_PASSWORD)), true);
  assert.equal(passwordValida("a".repeat(MIN_PASSWORD - 1)), false);
  assert.equal(passwordValida(""), false);
});

test("el mensaje de WhatsApp lleva el enlace, la caducidad y la advertencia", () => {
  const msj = mensajeWhatsAppActivacion("María Pérez", "https://studio.invifty.com/activar/tok123");

  assert.ok(msj.includes("María"), "saluda por el primer nombre");
  assert.ok(msj.includes("https://studio.invifty.com/activar/tok123"));
  assert.ok(msj.includes(`${DIAS_ACTIVACION} días`), "avisa que el enlace vence");
  assert.ok(msj.includes("Nunca te pediremos tu contraseña"), "la advertencia anti-phishing va siempre");
  assert.ok(!/contraseña:\s*\S+@/.test(msj), "jamás viaja una contraseña en el mensaje");
});
