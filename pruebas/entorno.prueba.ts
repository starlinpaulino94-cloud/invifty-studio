import test from "node:test";
import assert from "node:assert/strict";

import { supabaseUrl, supabaseClaveSecreta, secretoCron } from "@/lib/entorno";
import { avisoDeDominio } from "@/lib/url";

/**
 * LAS VARIABLES DE ENTORNO
 * =========================
 * Dos promesas que valen la pena probar: que un despliegue al que le falta
 * una variable lo dice CON SU NOMBRE (y no "Invalid URL" tres capas más
 * adentro), y que las claves secretas revientan si alguien las pide desde
 * un navegador — porque ese error a gritos es lo único que separa un
 * descuido de import de una clave dentro del bundle público.
 */

/** Ejecuta con unas variables puestas y restaura las originales al salir. */
function conEntorno<T>(valores: Record<string, string | undefined>, fn: () => T): T {
  const previos: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(valores)) {
    previos[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    return fn();
  } finally {
    for (const [k, v] of Object.entries(previos)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

test("si falta una variable, el error la nombra", () => {
  conEntorno({ NEXT_PUBLIC_SUPABASE_URL: undefined }, () => {
    assert.throws(() => supabaseUrl(), /NEXT_PUBLIC_SUPABASE_URL/);
  });
});

test("una variable en blanco cuenta como faltante", () => {
  // Pasa al copiar .env.example sin completar: la variable existe, vacía.
  conEntorno({ NEXT_PUBLIC_SUPABASE_URL: "   " }, () => {
    assert.throws(() => supabaseUrl(), /NEXT_PUBLIC_SUPABASE_URL/);
  });
});

test("la clave secreta acepta los dos nombres y prefiere el nuevo", () => {
  conEntorno(
    { SUPABASE_SECRET_KEY: "clave-nueva", SUPABASE_SERVICE_ROLE_KEY: "clave-vieja" },
    () => assert.equal(supabaseClaveSecreta(), "clave-nueva")
  );
  conEntorno(
    { SUPABASE_SECRET_KEY: undefined, SUPABASE_SERVICE_ROLE_KEY: "clave-vieja" },
    () => assert.equal(supabaseClaveSecreta(), "clave-vieja")
  );
});

test("sin ninguna de las dos, el error nombra ambas", () => {
  conEntorno({ SUPABASE_SECRET_KEY: undefined, SUPABASE_SERVICE_ROLE_KEY: undefined }, () => {
    assert.throws(() => supabaseClaveSecreta(), /SUPABASE_SECRET_KEY.*SUPABASE_SERVICE_ROLE_KEY/);
  });
});

test("el error nunca enseña el valor de otra variable", () => {
  conEntorno(
    { SUPABASE_SECRET_KEY: undefined, SUPABASE_SERVICE_ROLE_KEY: undefined, NEXT_PUBLIC_SUPABASE_URL: "https://secreto-interno.supabase.co" },
    () => {
      try {
        supabaseClaveSecreta();
        assert.fail("debió reventar");
      } catch (e) {
        assert.ok(!(e as Error).message.includes("secreto-interno"), "el mensaje filtró un valor");
      }
    }
  );
});

test("pedir la clave secreta desde un navegador revienta a gritos", () => {
  // Si esto no reventara, el descuido de importar código administrativo en
  // un componente cliente pondría la clave dentro del bundle público.
  (globalThis as Record<string, unknown>).window = {};
  try {
    assert.throws(() => supabaseClaveSecreta(), /navegador/);
    assert.throws(() => secretoCron(), /navegador/);
  } finally {
    delete (globalThis as Record<string, unknown>).window;
  }
});

test("sin CRON_SECRET la respuesta es null, que quien llama convierte en puerta cerrada", () => {
  conEntorno({ CRON_SECRET: undefined }, () => assert.equal(secretoCron(), null));
  conEntorno({ CRON_SECRET: "abc" }, () => assert.equal(secretoCron(), "abc"));
});

/* ---------- El aviso de dominio ---------- */

test("el aviso de dominio salta cuando los enlaces salen por otro host", () => {
  const previa = process.env.NEXT_PUBLIC_APP_URL;
  try {
    // El error de dedo que pasó de verdad: .co sin la eme.
    process.env.NEXT_PUBLIC_APP_URL = "https://studio.invifty.co";
    const aviso = avisoDeDominio("studio.invifty.com");
    assert.ok(aviso, "debía avisar");
    assert.equal(aviso!.configurado, "studio.invifty.co");
    assert.equal(aviso!.real, "studio.invifty.com");

    // Cuando todo cuadra, silencio.
    process.env.NEXT_PUBLIC_APP_URL = "https://studio.invifty.com";
    assert.equal(avisoDeDominio("studio.invifty.com"), null);

    // Sin host que comparar o con una base impronunciable, tampoco grita.
    assert.equal(avisoDeDominio(null), null);
    process.env.NEXT_PUBLIC_APP_URL = "esto no es una url";
    assert.equal(avisoDeDominio("studio.invifty.com"), null);
  } finally {
    if (previa === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = previa;
  }
});
