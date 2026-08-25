import test from "node:test";
import assert from "node:assert/strict";

import {
  DIAS_ACTIVACION,
  HORAS_RECUPERACION,
  expiraActivacion,
  expiraRecuperacion,
  activacionVigente,
  invitacionVigente,
  recuperacionVigente,
  tienePermiso,
  passwordValida,
  MIN_PASSWORD,
  mensajeWhatsAppActivacion,
  mensajeWhatsAppInvitacionColaborador,
  mensajeWhatsAppRecuperacion,
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

/* =====================================================================
 * Colaboradores y recuperación (Fase 4)
 * ===================================================================== */

test("una invitación de colaborador muere por uso, revocación o fecha", () => {
  const manana = new Date(AHORA.getTime() + 24 * 60 * 60 * 1000).toISOString();
  const ayer = new Date(AHORA.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const viva = { expira_en: manana, usado_en: null, revocada_en: null };

  assert.equal(invitacionVigente(viva, AHORA), true);
  // Un solo uso: activada una vez, el enlace de WhatsApp queda muerto.
  assert.equal(invitacionVigente({ ...viva, usado_en: ayer }, AHORA), false);
  // Revocar cierra al instante, aunque no haya vencido.
  assert.equal(invitacionVigente({ ...viva, revocada_en: ayer }, AHORA), false);
  assert.equal(invitacionVigente({ ...viva, expira_en: ayer }, AHORA), false);
  assert.equal(invitacionVigente({ ...viva, expira_en: null }, AHORA), false);
});

test("la recuperación vence en horas, no en días", () => {
  const expira = new Date(expiraRecuperacion(AHORA));
  const horas = (expira.getTime() - AHORA.getTime()) / (60 * 60 * 1000);
  assert.equal(horas, HORAS_RECUPERACION);
  assert.ok(
    horas < DIAS_ACTIVACION * 24,
    "un enlace que cambia contraseñas no puede vivir tanto como uno de activación"
  );
});

test("un enlace de recuperación usado no vuelve a servir", () => {
  const manana = new Date(AHORA.getTime() + 60 * 60 * 1000).toISOString();
  assert.equal(recuperacionVigente({ expira_en: manana, usado_en: null }, AHORA), true);
  assert.equal(
    recuperacionVigente({ expira_en: manana, usado_en: AHORA.toISOString() }, AHORA),
    false
  );
  assert.equal(recuperacionVigente({ expira_en: null, usado_en: null }, AHORA), false);
});

test("el propietario lo puede todo; el colaborador, solo lo concedido", () => {
  assert.equal(tienePermiso({ rol: "propietario", permisos: {} }, "ver_pagos"), true);
  assert.equal(tienePermiso({ rol: "propietario", permisos: null }, "ver_pagos"), true);
  assert.equal(tienePermiso({ rol: "colaborador", permisos: { ver_pagos: true } }, "ver_pagos"), true);
  // Lo no concedido es NO: ni permisos vacíos, ni null, ni valores raros.
  assert.equal(tienePermiso({ rol: "colaborador", permisos: {} }, "ver_pagos"), false);
  assert.equal(tienePermiso({ rol: "colaborador", permisos: null }, "ver_pagos"), false);
  assert.equal(
    tienePermiso({ rol: "colaborador", permisos: { ver_pagos: "true" } }, "ver_pagos"),
    false,
    "solo el booleano true concede; un string no"
  );
});

test("los mensajes nuevos llevan el enlace y la advertencia, nunca una contraseña", () => {
  const invitacion = mensajeWhatsAppInvitacionColaborador("https://x/activar/tok");
  assert.ok(invitacion.includes("https://x/activar/tok"));
  assert.match(invitacion, /nunca te pedirá tu contraseña/i);

  const recuperacion = mensajeWhatsAppRecuperacion("Ana Gómez", "https://x/recuperar/tok");
  assert.ok(recuperacion.includes("Ana"));
  assert.ok(recuperacion.includes("https://x/recuperar/tok"));
  assert.ok(recuperacion.includes(`${HORAS_RECUPERACION} horas`));
  assert.match(recuperacion, /si tú no lo pediste/i, "avisa qué hacer ante un enlace no pedido");
});

test("el mensaje de WhatsApp lleva el enlace, la caducidad y la advertencia", () => {
  const msj = mensajeWhatsAppActivacion("María Pérez", "https://studio.invifty.com/activar/tok123");

  assert.ok(msj.includes("María"), "saluda por el primer nombre");
  assert.ok(msj.includes("https://studio.invifty.com/activar/tok123"));
  assert.ok(msj.includes(`${DIAS_ACTIVACION} días`), "avisa que el enlace vence");
  assert.ok(msj.includes("Nunca te pediremos tu contraseña"), "la advertencia anti-phishing va siempre");
  assert.ok(!/contraseña:\s*\S+@/.test(msj), "jamás viaja una contraseña en el mensaje");
});
