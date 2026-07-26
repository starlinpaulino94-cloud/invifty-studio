import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

/**
 * CONFIGURACIÓN DE DESPLIEGUE
 * ============================
 * `npm run build` no valida vercel.json: su esquema lo comprueba Vercel al
 * desplegar, así que un error ahí pasa todas las comprobaciones locales y
 * rompe el despliegue. Ya ocurrió una vez, por meter una clave "//" a modo
 * de comentario dentro del cron. Estas pruebas cierran ese hueco.
 */

const raiz = path.resolve(import.meta.dirname, "..");
const rutaVercel = path.join(raiz, "vercel.json");

/** Lo único que Vercel acepta dentro de cada entrada de `crons`. */
const CLAVES_DE_CRON = new Set(["path", "schedule"]);

test("vercel.json es JSON válido", () => {
  assert.ok(existsSync(rutaVercel), "falta vercel.json");
  assert.doesNotThrow(() => JSON.parse(readFileSync(rutaVercel, "utf8")));
});

test("las tareas programadas solo llevan las claves que Vercel admite", () => {
  const config = JSON.parse(readFileSync(rutaVercel, "utf8"));

  for (const [i, cron] of (config.crons ?? []).entries()) {
    for (const clave of Object.keys(cron)) {
      assert.ok(
        CLAVES_DE_CRON.has(clave),
        `crons[${i}] tiene la propiedad "${clave}", que Vercel rechaza. ` +
          `JSON no admite comentarios: si hay que explicar algo, va en el código de la ruta.`
      );
    }
    assert.ok(cron.path?.startsWith("/"), `crons[${i}].path debe ser una ruta absoluta`);
    assert.match(
      cron.schedule ?? "",
      /^\S+ \S+ \S+ \S+ \S+$/,
      `crons[${i}].schedule debe tener los cinco campos de cron`
    );
  }
});

test("cada tarea programada apunta a una ruta que existe", () => {
  const config = JSON.parse(readFileSync(rutaVercel, "utf8"));

  for (const cron of config.crons ?? []) {
    const archivo = path.join(raiz, "src/app", cron.path, "route.ts");
    assert.ok(
      existsSync(archivo),
      `${cron.path} no tiene su archivo en src/app${cron.path}/route.ts: ` +
        `Vercel llamaría a una ruta inexistente todos los días`
    );
  }
});
