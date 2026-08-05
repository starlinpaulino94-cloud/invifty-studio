import { createServerClient } from "@supabase/ssr";
import { supabaseUrl, supabaseClaveAnon } from "@/lib/entorno";
import { cookies } from "next/headers";

// Cliente de Supabase para Server Components y Server Actions del panel.
// Respeta la sesión del usuario autenticado (cookies).
export async function crearClienteServidor() {
  const cookieStore = await cookies();

  return createServerClient(
    supabaseUrl(),
    supabaseClaveAnon(),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Ignorado en Server Components (el proxy refresca la sesión).
          }
        },
      },
    }
  );
}
