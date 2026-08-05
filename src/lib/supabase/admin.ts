import { createClient } from "@supabase/supabase-js";
import { supabaseUrl, supabaseClaveSecreta } from "@/lib/entorno";

/**
 * Cliente administrador (service_role) — SOLO para código del servidor.
 * Lo usan las rutas API del formulario público, que operan sin sesión:
 * el token único del link es la credencial del cliente.
 * NUNCA importar este archivo desde un componente de cliente.
 */
export function crearClienteAdmin() {
  return createClient(
    supabaseUrl(),
    supabaseClaveSecreta(),
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
