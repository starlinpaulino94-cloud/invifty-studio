import { crearClienteAdmin } from "./supabase/admin";
import { BUCKET, HORAS_FIRMA } from "./fotos";
import { idsDeMedios, rutaDeMedioCodigo } from "./codigo-medios";

type ClienteAdmin = ReturnType<typeof crearClienteAdmin>;

/**
 * Direcciones firmadas de los archivos que el HTML referencia con marcador
 * `{{MEDIO_…}}` (ver lib/codigo-medios.ts). Frescas en cada render, igual que
 * las fotos del cliente. Un archivo que ya no existe simplemente no aparece
 * en el resultado, y su marcador se queda en blanco.
 */
export async function urlsDeMedios(
  admin: ClienteAdmin,
  pedidoId: string,
  html: string | null | undefined
): Promise<Record<string, string>> {
  const ids = html ? idsDeMedios(html) : [];
  if (!ids.length) return {};

  const { data } = await admin.storage
    .from(BUCKET)
    .createSignedUrls(ids.map((id) => rutaDeMedioCodigo(pedidoId, id)), HORAS_FIRMA * 3600);

  const urls: Record<string, string> = {};
  ids.forEach((id, i) => {
    const url = data?.[i]?.signedUrl;
    if (url) urls[id] = url;
  });
  return urls;
}

/** Cuáles de estos ids ya están alojados para el pedido. */
export async function idsYaAlojados(
  admin: ClienteAdmin,
  pedidoId: string,
  ids: string[]
): Promise<Set<string>> {
  const { data } = await admin.storage
    .from(BUCKET)
    .list(`${pedidoId}/codigo`, { limit: 1000 });
  const existentes = new Set((data ?? []).map((a) => a.name));
  return new Set(ids.filter((id) => existentes.has(id)));
}
