import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

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

/* ---------- Scripts de mantenimiento ---------- */

/**
 * Los scripts de scripts/*.mts se ejecutan a mano, cada varios meses. Nadie
 * se acuerda de la línea de `node` con sus cinco banderas, y si falta el
 * resolvedor de imports el script muere con ERR_MODULE_NOT_FOUND antes de
 * conectarse a nada — que es justo lo que pasaba. Por eso cada script tiene
 * su atajo en package.json y estas pruebas comprueban que sigue completo.
 */
const paquete = JSON.parse(readFileSync(path.join(raiz, "package.json"), "utf8"));
const atajos: string[] = Object.values(paquete.scripts ?? {});

test("cada script de mantenimiento tiene su atajo en package.json", () => {
  const scripts = readdirSync(path.join(raiz, "scripts")).filter((f) => f.endsWith(".mts"));
  assert.ok(scripts.length > 0, "no hay scripts que comprobar");

  for (const script of scripts) {
    assert.ok(
      atajos.some((a) => a.includes(`scripts/${script}`)),
      `scripts/${script} no se puede lanzar con npm run: nadie recordará el comando`
    );
  }
});

test("los atajos que corren código del proyecto cargan el resolvedor de imports", () => {
  const conNode = atajos.filter((a) => a.startsWith("node "));
  assert.ok(conNode.length > 0);

  for (const atajo of conNode) {
    assert.match(
      atajo,
      /--import \.\/scripts\/resolver-imports\.mjs/,
      `sin el resolvedor, "${atajo.slice(0, 60)}…" falla al importar src/lib/*`
    );
    assert.match(atajo, /--experimental-strip-types/, "hace falta para leer TypeScript");
  }
});

test("el resolvedor de imports existe donde los atajos lo buscan", () => {
  assert.ok(existsSync(path.join(raiz, "scripts/resolver-imports.mjs")));
});

test("los atajos que tocan la base de datos leen el .env.local", () => {
  for (const nombre of ["fotos:ligeras", "vencimientos:simular", "vencimientos:aplicar"]) {
    const atajo = paquete.scripts?.[nombre];
    assert.ok(atajo, `falta el atajo "${nombre}"`);
    assert.match(atajo, /--env-file=\.env\.local/, `"${nombre}" no encontraría las claves`);
  }
});

test("simular y aplicar no se confunden", () => {
  // Un despiste aquí escribiría en la base de datos creyendo que solo mira.
  assert.doesNotMatch(paquete.scripts["vencimientos:simular"], /--aplicar/);
  assert.match(paquete.scripts["vencimientos:aplicar"], /--aplicar/);
});

/* ---------- Secretos fuera del repositorio ---------- */

/**
 * `.gitignore` NO desrastrea lo que ya está rastreado. Por eso `.env.local`
 * llegó a subirse con la clave secreta de Supabase dentro y siguió ahí
 * commit tras commit, aunque el patrón `.env*` estuviera puesto desde el
 * principio. Esta prueba mira lo único que importa: qué archivos rastrea git
 * de verdad.
 */
test("ningún archivo de variables de entorno está rastreado por git", () => {
  const rastreados = execFileSync("git", ["ls-files"], {
    cwd: raiz,
    encoding: "utf8",
  }).split("\n");

  const secretos = rastreados.filter(
    (f) => /(^|\/)\.env/.test(f) && !f.endsWith(".env.example")
  );

  assert.deepEqual(
    secretos,
    [],
    `Estos archivos llevan credenciales y están en el repositorio: ${secretos.join(", ")}. ` +
      `Sácalos con "git rm --cached <archivo>" y ROTA las claves que hubiera dentro: ` +
      `siguen legibles en el historial.`
  );
});

test(".env.example no lleva ningún valor rellenado", () => {
  // Es la plantilla que se copia: si alguien pega ahí una clave de verdad,
  // se sube sin que nadie lo note porque este sí está rastreado a propósito.
  const lineas = readFileSync(path.join(raiz, ".env.example"), "utf8").split("\n");

  for (const linea of lineas) {
    const m = /^([A-Z_]+)=(.+)$/.exec(linea.trim());
    if (!m) continue;
    const [, clave, valor] = m;
    // La URL local del sistema sí viene puesta: no es un secreto.
    if (clave === "NEXT_PUBLIC_APP_URL") continue;
    assert.fail(`.env.example trae un valor en ${clave}: "${valor}". Déjalo vacío.`);
  }
});
