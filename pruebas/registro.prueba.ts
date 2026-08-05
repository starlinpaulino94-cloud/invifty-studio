import test from "node:test";
import assert from "node:assert/strict";

import { registrarError } from "@/lib/registro";

/**
 * EL REGISTRO DE ERRORES
 * =======================
 * Su promesa central no es registrar: es NO FILTRAR. Un error de Supabase
 * puede traer dentro un JWT o un token de la propia petición, y ese log
 * acaba en Vercel, donde lo lee cualquiera con acceso al proyecto. Aquí se
 * prueba que lo que sale por el log ya va tapado.
 */

/** Captura lo que registrarError escribe, restaurando console.error al salir. */
function capturar(fn: () => void): string {
  const original = console.error;
  let salida = "";
  console.error = (...args: unknown[]) => {
    salida += args.join(" ");
  };
  try {
    fn();
  } finally {
    console.error = original;
  }
  return salida;
}

test("un JWT dentro del error sale tapado", () => {
  const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.abcdefghij";
  const salida = capturar(() => registrarError("prueba", new Error(`falló con ${jwt}`)));
  assert.ok(!salida.includes(jwt), "el JWT salió entero al log");
  assert.ok(salida.includes("[JWT]"));
});

test("una clave sb_secret sale tapada", () => {
  const salida = capturar(() =>
    registrarError("prueba", new Error("auth: sb_secret_AbC123xyz no válida"))
  );
  assert.ok(!salida.includes("sb_secret_AbC123xyz"));
  assert.ok(salida.includes("[CLAVE]"));
});

test("un token largo hexadecimal (como los de formulario o lista) sale tapado", () => {
  const token = "a".repeat(16) + "b".repeat(16); // 32 hex, la forma de nuestros tokens
  const salida = capturar(() => registrarError("prueba", new Error(`token ${token} rechazado`)));
  assert.ok(!salida.includes(token), "el token salió entero al log");
});

test("el ámbito y el contexto sí salen, que para eso están", () => {
  const salida = capturar(() =>
    registrarError("rsvp", new Error("duplicado"), { slug: "boda-x", codigo: "23505" })
  );
  assert.ok(salida.includes("[rsvp]"));
  assert.ok(salida.includes("slug=boda-x"));
  assert.ok(salida.includes("codigo=23505"));
});

test("un error que no es Error tampoco lo tumba", () => {
  const salida = capturar(() => registrarError("prueba", "cadena suelta"));
  assert.ok(salida.includes("cadena suelta"));
  const salida2 = capturar(() => registrarError("prueba", undefined));
  assert.ok(salida2.includes("desconocido"));
});
