"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { crearClienteNavegador } from "@/lib/supabase/cliente";
import { Loader2, Lock } from "lucide-react";

export default function PaginaLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const entrar = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setCargando(true);

    const supabase = crearClienteNavegador();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError("Correo o contraseña incorrectos.");
      setCargando(false);
      return;
    }
    router.push("/panel");
    router.refresh();
  };

  return (
    <div className="min-h-dvh bg-[#0D0D0F] flex items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <span className="font-serif text-3xl tracking-[0.3em] text-white uppercase block">
            Invifty
          </span>
          <span className="text-[10px] uppercase tracking-[0.4em] text-[#D4AF37] font-semibold">
            Studio · Sistema interno
          </span>
        </div>

        <form
          onSubmit={entrar}
          className="bg-white/5 border border-white/10 rounded-3xl p-8 space-y-5"
        >
          <div>
            <label htmlFor="email" className="block text-xs text-white/60 mb-2 font-medium">
              Correo electrónico
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-black/30 border border-white/15 focus:border-[#D4AF37] rounded-xl px-4 py-3 text-white text-sm focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-xs text-white/60 mb-2 font-medium">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-black/30 border border-white/15 focus:border-[#D4AF37] rounded-xl px-4 py-3 text-white text-sm focus:outline-none"
            />
          </div>

          {error && (
            <p className="text-red-300 text-xs text-center bg-red-950/40 border border-red-500/30 rounded-xl py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={cargando}
            className="w-full bg-[#D4AF37] hover:bg-[#F2D06B] disabled:opacity-60 text-black font-semibold text-xs uppercase tracking-[0.2em] py-3.5 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {cargando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
            Entrar al panel
          </button>
        </form>

        <p className="text-white/25 text-[11px] text-center mt-6">
          Acceso exclusivo del equipo Invifty.
        </p>
      </div>
    </div>
  );
}
