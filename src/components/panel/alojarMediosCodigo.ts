import { crearClienteNavegador } from "@/lib/supabase/cliente";
import {
  extraerMediosEmbebidos, tieneMediosEmbebidos,
} from "@/lib/codigo-medios";
import { prepararSubidaMedios, urlsDeMediosDeInvitacion } from "@/lib/acciones-codigo-medios";

/**
 * Saca del HTML pegado sus imágenes, videos, música y tipografías
 * embebidos, los sube directo al almacenamiento y devuelve el HTML ya
 * liviano, con marcadores `{{MEDIO_…}}` en su lugar (lib/codigo-medios.ts).
 *
 * Los archivos NO pasan por una función de servidor: viajan del navegador
 * al almacenamiento con un permiso de subida de un solo uso. Es lo que
 * quita el tope de 4,5 MB de Vercel y deja que quepa un video.
 *
 * Si algo falla a la mitad no se toca el HTML de quien llama: lo ya subido
 * se queda (el id sale del contenido, así que reintentar no duplica).
 */
export async function alojarMediosDelCodigo(
  invitacionId: string,
  html: string,
  avisar: (texto: string) => void
): Promise<
  | { ok: true; html: string; archivos: Record<string, string> }
  | { ok: false; error: string }
> {
  if (!tieneMediosEmbebidos(html)) return { ok: true, html, archivos: {} };

  avisar("Preparando las imágenes y videos del código…");
  const extraido = await extraerMediosEmbebidos(html);

  // Si quedó algo grande dentro (un video de 80 MB, por ejemplo), seguir
  // sería guardar en silencio un HTML que no cabe: se dice por qué.
  if (tieneMediosEmbebidos(extraido.html)) {
    return {
      ok: false,
      error: extraido.omitidos.length
        ? extraido.omitidos.join(" ")
        : "Hay archivos pegados dentro del código que no se pudieron alojar aparte.",
    };
  }

  const permiso = await prepararSubidaMedios(
    invitacionId,
    extraido.medios.map((m) => ({ id: m.id, mime: m.mime, bytes: m.bytes.length }))
  );
  if (!permiso.ok) return { ok: false, error: permiso.error };

  const almacenamiento = crearClienteNavegador().storage.from(permiso.bucket);
  const porId = new Map(extraido.medios.map((m) => [m.id, m]));
  const total = permiso.permisos.length;

  for (let i = 0; i < total; i++) {
    const { id, ruta, token } = permiso.permisos[i];
    const medio = porId.get(id)!;
    const mb = (medio.bytes.length / (1024 * 1024)).toFixed(1).replace(".", ",");
    avisar(`Subiendo archivo ${i + 1} de ${total} (${mb} MB)…`);

    const { error } = await almacenamiento.uploadToSignedUrl(
      ruta,
      token,
      new Blob([medio.bytes], { type: medio.mime }),
      { contentType: medio.mime }
    );
    if (error) {
      return {
        ok: false,
        error: `No se pudo subir el archivo ${i + 1} de ${total} (${mb} MB): ${error.message}. ` +
          "Lo ya subido se conserva; vuelve a guardar para continuar.",
      };
    }
  }

  const archivos = await urlsDeMediosDeInvitacion(invitacionId, extraido.medios.map((m) => m.id));
  return { ok: true, html: extraido.html, archivos };
}
