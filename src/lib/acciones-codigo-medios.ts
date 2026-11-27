"use server";

import { crearClienteServidor } from "./supabase/servidor";
import { crearClienteAdmin } from "./supabase/admin";
import { exigirPermiso } from "./auditoria";
import { registrarError } from "./registro";
import { BUCKET } from "./fotos";
import { errorDeMedio, esIdDeMedio, rutaDeMedioCodigo } from "./codigo-medios";
import { idsYaAlojados, urlsDeMedios } from "./codigo-medios-servidor";
import { marcadorDeMedio } from "./codigo-medios";

/**
 * SUBIDA DIRECTA DE LOS ARCHIVOS DEL CÓDIGO PROPIO
 * =================================================
 * Un video no cabe en una función de Vercel (4,5 MB de cuerpo), así que el
 * navegador NO manda aquí los archivos: pide un permiso de subida y los
 * sube él mismo al almacenamiento. Esta acción solo reparte esos permisos,
 * que son pequeños, y por eso es donde se comprueba todo:
 *
 *  - que quien pide pueda editar invitaciones (no basta con un botón);
 *  - que la invitación exista y de ella salga la carpeta (el cliente NO
 *    elige la ruta: la ruta se arma aquí con el pedido y el id);
 *  - que el tipo y el tamaño declarados sean de los permitidos.
 */

export interface PedidoSubida {
  id: string;
  mime: string;
  bytes: number;
}

export interface PermisoSubida {
  id: string;
  ruta: string;
  token: string;
}

export async function prepararSubidaMedios(
  invitacionId: string,
  pedidos: PedidoSubida[]
): Promise<
  | { ok: true; bucket: string; permisos: PermisoSubida[]; yaAlojados: string[] }
  | { ok: false; error: string }
> {
  try {
    const supabase = await crearClienteServidor();
    await exigirPermiso(supabase, "editar_invitaciones");

    if (!Array.isArray(pedidos) || pedidos.length === 0) {
      return { ok: true, bucket: BUCKET, permisos: [], yaAlojados: [] };
    }
    if (pedidos.length > 60) {
      return { ok: false, error: "Demasiados archivos en un solo código (máximo 60)." };
    }

    // La carpeta sale de la invitación, nunca de lo que mande el navegador.
    const { data: invitacion } = await supabase
      .from("invitaciones")
      .select("pedido_id")
      .eq("id", invitacionId)
      .single();
    if (!invitacion) return { ok: false, error: "Invitación no encontrada." };

    for (const p of pedidos) {
      if (!esIdDeMedio(String(p.id))) return { ok: false, error: "Identificador de archivo inválido." };
      const problema = errorDeMedio(String(p.mime), Number(p.bytes));
      if (problema) return { ok: false, error: problema };
    }

    const admin = crearClienteAdmin();
    const alojados = await idsYaAlojados(admin, invitacion.pedido_id, pedidos.map((p) => p.id));

    const permisos: PermisoSubida[] = [];
    for (const p of pedidos) {
      if (alojados.has(p.id)) continue;
      const ruta = rutaDeMedioCodigo(invitacion.pedido_id, p.id);
      const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(ruta);
      if (error || !data) {
        return { ok: false, error: `No se pudo preparar la subida: ${error?.message ?? "sin detalle"}` };
      }
      permisos.push({ id: p.id, ruta, token: data.token });
    }

    return { ok: true, bucket: BUCKET, permisos, yaAlojados: [...alojados] };
  } catch (e) {
    registrarError("codigo-medios", e, { invitacion: invitacionId });
    return { ok: false, error: `No se pudo preparar la subida: ${(e as Error).message}`.slice(0, 300) };
  }
}

/** Direcciones de lectura de los ids dados, para la vista previa tras subirlos. */
export async function urlsDeMediosDeInvitacion(
  invitacionId: string,
  ids: string[]
): Promise<Record<string, string>> {
  try {
    const supabase = await crearClienteServidor();
    await exigirPermiso(supabase, "editar_invitaciones");
    const { data: invitacion } = await supabase
      .from("invitaciones")
      .select("pedido_id")
      .eq("id", invitacionId)
      .single();
    if (!invitacion) return {};
    const limpios = (Array.isArray(ids) ? ids : []).filter((i) => esIdDeMedio(String(i)));
    return await urlsDeMedios(
      crearClienteAdmin(),
      invitacion.pedido_id,
      limpios.map(marcadorDeMedio).join(" ")
    );
  } catch (e) {
    registrarError("codigo-medios", e, { invitacion: invitacionId });
    return {};
  }
}
