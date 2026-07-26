/**
 * Resuelve los imports del proyecto cuando el código corre fuera de Next:
 * las pruebas y los scripts de mantenimiento.
 *
 * Hacen falta dos traducciones que el empaquetador hace solo y Node no:
 *  - el alias "@/…" que define tsconfig.json → la carpeta src/
 *  - los imports sin extensión ("./tipos") → el archivo .ts real, porque
 *    en ESM la extensión es obligatoria
 *
 * Sin esto, `npm run vencimientos:simular` muere con ERR_MODULE_NOT_FOUND
 * antes de conectarse a nada. Se carga con --import desde package.json.
 */

import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const raiz = path.resolve(import.meta.dirname, "..");

/** Prueba las extensiones habituales hasta dar con el archivo real. */
function resolverArchivo(base) {
  const candidatos = [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`];
  return candidatos.find((c) => existsSync(c));
}

registerHooks({
  resolve(especificador, contexto, siguiente) {
    // Alias del proyecto: "@/lib/fechas" → src/lib/fechas.ts
    if (especificador.startsWith("@/")) {
      const archivo = resolverArchivo(path.join(raiz, "src", especificador.slice(2)));
      if (!archivo) {
        throw new Error(`No se encontró el módulo para el alias "${especificador}"`);
      }
      return siguiente(pathToFileURL(archivo).href, contexto);
    }

    // Import relativo sin extensión: "./tipos" → ./tipos.ts
    if (especificador.startsWith(".") && !path.extname(especificador)) {
      const base = fileURLToPath(new URL(especificador, contexto.parentURL));
      const archivo = resolverArchivo(base);
      if (archivo) return siguiente(pathToFileURL(archivo).href, contexto);
    }

    return siguiente(especificador, contexto);
  },
});
