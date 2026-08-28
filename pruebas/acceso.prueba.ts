import test from "node:test";
import assert from "node:assert/strict";

import { mensajeErrorAcceso } from "@/lib/acceso";

/**
 * LOS ERRORES DEL LOGIN
 * ======================
 * Pasó de verdad: la pantalla culpaba a la contraseña por un fallo de
 * claves de configuración, y el propietario probó la suya diez veces.
 * Estas pruebas fijan la regla: solo las credenciales malas culpan a
 * las credenciales.
 */

test("solo las credenciales malas culpan a las credenciales", () => {
  assert.equal(
    mensajeErrorAcceso("Invalid login credentials"),
    "Correo o contraseña incorrectos."
  );
});

test("una clave de API mala NO culpa a la contraseña", () => {
  const msj = mensajeErrorAcceso("Invalid API key");
  assert.match(msj, /NO es tu contraseña/);
  assert.match(msj, /Vercel|claves/i, "apunta a dónde mirar");
  assert.ok(!msj.includes("incorrectos"), "no puede sonar a contraseña mala");
});

test("el resto de fallos se enseñan tal cual, sin culpar a nadie", () => {
  assert.match(mensajeErrorAcceso("Email not confirmed"), /no está confirmado/);
  assert.match(mensajeErrorAcceso("Too many requests"), /Espera un minuto/);
  assert.match(mensajeErrorAcceso("fetch failed"), /conexión|internet/i);
  const raro = mensajeErrorAcceso("Database error querying schema");
  assert.ok(raro.includes("Database error querying schema"), "el detalle no se esconde");
  assert.match(raro, /no es necesariamente tu contraseña/i);
  assert.match(mensajeErrorAcceso(undefined), /sin detalle/);
});
