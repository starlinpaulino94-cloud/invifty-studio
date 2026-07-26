import { crearClienteServidor } from "./supabase/servidor";

/**
 * ¿Hay alguien del equipo con la sesión iniciada?
 *
 * El layout de /panel ya redirige a quien no tiene sesión, pero las rutas de
 * /api no pasan por ese layout: cada una tiene que comprobarlo por su cuenta.
 * Sin esto, las rutas de mantenimiento quedarían abiertas a cualquiera que
 * adivinara la URL, y una de ellas reescribe fechas de vencimiento.
 */
export async function haySesion(): Promise<boolean> {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return !!user;
}
