import { createClient } from "@supabase/supabase-js";

/**
 * Cliente administrador (service_role) — SOLO para código del servidor.
 * Lo usan las rutas API del formulario público, que operan sin sesión:
 * el token único del link es la credencial del cliente.
 * NUNCA importar este archivo desde un componente de cliente.
 */
export function crearClienteAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
