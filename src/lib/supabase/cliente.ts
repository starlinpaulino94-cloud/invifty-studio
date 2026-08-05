"use client";

import { createBrowserClient } from "@supabase/ssr";
import { supabaseUrl, supabaseClaveAnon } from "@/lib/entorno";

// Cliente de Supabase para el navegador (login del panel).
export function crearClienteNavegador() {
  return createBrowserClient(
    supabaseUrl(),
    supabaseClaveAnon()
  );
}
