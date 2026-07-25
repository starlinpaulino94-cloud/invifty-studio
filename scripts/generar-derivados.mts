/**
 * GENERAR VERSIONES LIGERAS DE LAS FOTOS YA SUBIDAS
 * =================================================
 * Las fotos subidas antes de esta mejora no tienen versiones ligeras, así
 * que se siguen sirviendo desde el original (pesado). Este script las
 * procesa una sola vez, para que las invitaciones ya entregadas también
 * carguen rápido.
 *
 * Cómo ejecutarlo (desde la raíz del proyecto, con el .env.local puesto):
 *
 *   node --experimental-strip-types --env-file=.env.local scripts/generar-derivados.mts
 *
 * Es seguro repetirlo: salta las fotos que ya tienen sus derivados y
 * nunca modifica ni borra el original.
 *
 * Requiere Node 22.6 o superior (por --experimental-strip-types) y las
 * variables NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SECRET_KEY (o
 * SUPABASE_SERVICE_ROLE_KEY).
 */

import { createClient } from "@supabase/supabase-js";
import { generarDerivados } from "../src/lib/imagenes.ts";

const BUCKET = "fotos-pedidos";
const CARPETA_DERIVADOS = "derivados";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const clave = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;

if (!url || !clave) {
  console.error(
    "Faltan las variables de entorno. Ejecuta con:\n" +
      "  node --experimental-strip-types --env-file=.env.local scripts/generar-derivados.mts"
  );
  process.exit(1);
}

const supabase = createClient(url, clave, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const esVideo = (nombre: string) => nombre.startsWith("video-");

let procesadas = 0;
let saltadas = 0;
let fallidas = 0;

const { data: pedidos, error } = await supabase.from("pedidos").select("id");
if (error) {
  console.error("No se pudieron leer los pedidos:", error.message);
  process.exit(1);
}

console.log(`Revisando ${pedidos?.length ?? 0} pedido(s)…\n`);

for (const pedido of pedidos ?? []) {
  const [{ data: raiz }, { data: derivados }] = await Promise.all([
    supabase.storage.from(BUCKET).list(pedido.id, { limit: 500 }),
    supabase.storage.from(BUCKET).list(`${pedido.id}/${CARPETA_DERIVADOS}`, { limit: 1000 }),
  ]);

  const yaHechas = new Set((derivados ?? []).map((d) => d.name));
  // Las carpetas aparecen en el listado con id nulo: aquí solo queremos archivos.
  const fotos = (raiz ?? []).filter((a) => a.id !== null && !esVideo(a.name));

  for (const foto of fotos) {
    if (yaHechas.has(`web-${foto.name}.webp`)) {
      saltadas++;
      continue;
    }

    const { data: descarga, error: errorDescarga } = await supabase.storage
      .from(BUCKET)
      .download(`${pedido.id}/${foto.name}`);

    if (errorDescarga || !descarga) {
      console.warn(`  ✗ ${foto.name}: no se pudo descargar`);
      fallidas++;
      continue;
    }

    const resultado = await generarDerivados(Buffer.from(await descarga.arrayBuffer()));
    if (!resultado) {
      console.warn(`  ✗ ${foto.name}: formato no soportado, se deja el original`);
      fallidas++;
      continue;
    }

    const subidas = await Promise.all([
      supabase.storage
        .from(BUCKET)
        .upload(`${pedido.id}/${CARPETA_DERIVADOS}/web-${foto.name}.webp`, resultado.web, {
          contentType: "image/webp",
          upsert: true,
        }),
      supabase.storage
        .from(BUCKET)
        .upload(`${pedido.id}/${CARPETA_DERIVADOS}/min-${foto.name}.webp`, resultado.miniatura, {
          contentType: "image/webp",
          upsert: true,
        }),
    ]);

    if (subidas.some((s) => s.error)) {
      console.warn(`  ✗ ${foto.name}: no se pudieron subir los derivados`);
      fallidas++;
      continue;
    }

    procesadas++;
    process.stdout.write(`\r  Procesadas: ${procesadas}`);
  }
}

console.log(
  `\n\nListo. ${procesadas} foto(s) procesada(s), ${saltadas} ya la(s) tenía(n), ${fallidas} sin procesar.`
);
