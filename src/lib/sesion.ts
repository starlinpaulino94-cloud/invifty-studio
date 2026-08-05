import { crearClienteServidor } from "./supabase/servidor";
import { decidirAcceso } from "./equipo";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * ¿Hay alguien DEL EQUIPO con la sesión iniciada?
 *
 * Ojo con la diferencia entre "tiene sesión" y "es del equipo". La clave
 * anon viaja en el navegador, así que cualquiera puede registrarse contra
 * nuestro proyecto de Supabase y quedar autenticado. Por eso no basta con
 * mirar si hay usuario: hay que mirar si está en la lista blanca `equipo`
 * (ver supabase/migrations/20260726135300_cerrar-acceso-equipo.sql).
 *
 * Quien de verdad protege los datos es la RLS de la base: aunque esta
 * comprobación fallara, un extraño no leería una sola fila. Esto está para
 * que vea un "no autorizado" claro en vez de un panel vacío y confuso.
 *
 * El layout de /panel ya redirige a quien no tiene sesión, pero las rutas
 * de /api no pasan por ese layout: cada una tiene que comprobarlo por su
 * cuenta. Sin esto, las rutas de mantenimiento quedarían abiertas a
 * cualquiera que adivinara la URL, y una de ellas reescribe fechas de
 * vencimiento.
 */
export async function haySesion(): Promise<boolean> {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  return esDelEquipo(supabase, user.id);
}

/**
 * ¿Está este usuario en la lista del equipo? La regla —y por qué cede
 * cuando la tabla todavía no existe— vive en lib/equipo.ts.
 */
export async function esDelEquipo(
  supabase: SupabaseClient,
  usuarioId: string
): Promise<boolean> {
  // La propia RLS de `equipo` deja que cada quien se vea solo a sí mismo,
  // así que esta consulta responde exactamente a "¿estoy yo en la lista?".
  const { data, error } = await supabase
    .from("equipo")
    .select("usuario_id")
    .eq("usuario_id", usuarioId)
    .maybeSingle();

  return decidirAcceso(data, error);
}
