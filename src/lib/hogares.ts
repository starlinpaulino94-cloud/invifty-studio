import type { SupabaseClient } from "@supabase/supabase-js";
import type { HogarInvitado } from "@/components/invitacion/base/Contexto";

/**
 * EL ENLACE PERSONAL DEL HOGAR
 * =============================
 * /i/<slug>?h=<token> es la misma invitación de siempre con una cosa
 * más: el sistema sabe QUIÉN llegó. La confirmación sale con el nombre
 * del hogar puesto y su cupo como tope, y la puerta del evento puede
 * cruzar la entrada con lo confirmado.
 *
 * Resolver el token aquí, en el servidor, tiene dos porqués:
 *  - el token debe pertenecer a ESTA invitación (uno de otra boda, por
 *    válido que sea, no abre nada aquí);
 *  - un token malo se ignora en silencio y la invitación se enseña
 *    normal: el primo que recibió el enlace reenviado no ve un error,
 *    ve la invitación.
 */
export async function hogarDeEnlace(
  admin: SupabaseClient,
  invitacionId: string,
  token: string | undefined
): Promise<HogarInvitado | undefined> {
  // Los tokens reales son 32 hex; lo demás ni se consulta.
  if (!token || !/^[0-9a-f]{16,64}$/.test(token)) return undefined;

  const { data } = await admin
    .from("hogares")
    .select("nombre, cupo, token")
    .eq("invitacion_id", invitacionId)
    .eq("token", token)
    .maybeSingle();

  // Tabla sin migrar o token ajeno: la invitación se enseña igual.
  return (data as HogarInvitado | null) ?? undefined;
}
