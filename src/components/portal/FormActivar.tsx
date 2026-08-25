"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { crearClienteNavegador } from "@/lib/supabase/cliente";
import { activarCuenta } from "@/lib/acciones-cuentas";
import { MIN_PASSWORD } from "@/lib/cuentas";
import { Loader2, KeyRound } from "lucide-react";

/**
 * El cliente elige su contraseña y activa la cuenta. La acción del
 * servidor valida el token (un solo uso, con fecha) y crea el usuario;
 * después se firma aquí mismo y entra directo al portal.
 */
export default function FormActivar({ token, email }: { token: string; email: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const activar = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < MIN_PASSWORD) {
      setError(`La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`);
      return;
    }
    if (password !== confirmacion) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setCargando(true);
    try {
      const { email: correo } = await activarCuenta(token, password);
      const supabase = crearClienteNavegador();
      const { error: errorFirma } = await supabase.auth.signInWithPassword({
        email: correo,
        password,
      });
      if (errorFirma) {
        // La cuenta quedó activa: que entre por la puerta normal.
        router.push("/portal/entrar");
        return;
      }
      router.push("/portal");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos activar tu cuenta.");
      setCargando(false);
    }
  };

  return (
    <form
      onSubmit={activar}
      className="bg-white/5 border border-white/10 rounded-3xl p-8 space-y-5"
    >
      <div>
        <p className="text-white text-sm mb-1">Elige tu contraseña</p>
        <p className="text-white/40 text-xs">
          Tu usuario es <span className="text-white/70">{email}</span>. La
          contraseña la eliges tú y solo la sabes tú.
        </p>
      </div>

      <div>
        <label htmlFor="password" className="block text-xs text-white/60 mb-2 font-medium">
          Contraseña (mínimo {MIN_PASSWORD} caracteres)
        </label>
        <input
          id="password"
          type="password"
          required
          minLength={MIN_PASSWORD}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-black/30 border border-white/15 focus:border-[#D4AF37] rounded-xl px-4 py-3 text-white text-sm focus:outline-none"
        />
      </div>
      <div>
        <label htmlFor="confirmacion" className="block text-xs text-white/60 mb-2 font-medium">
          Repítela
        </label>
        <input
          id="confirmacion"
          type="password"
          required
          minLength={MIN_PASSWORD}
          autoComplete="new-password"
          value={confirmacion}
          onChange={(e) => setConfirmacion(e.target.value)}
          className="w-full bg-black/30 border border-white/15 focus:border-[#D4AF37] rounded-xl px-4 py-3 text-white text-sm focus:outline-none"
        />
      </div>

      {error && (
        <p className="text-red-300 text-xs text-center bg-red-950/40 border border-red-500/30 rounded-xl py-2 px-3">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={cargando}
        className="w-full bg-[#D4AF37] hover:bg-[#F2D06B] disabled:opacity-60 text-black font-semibold text-xs uppercase tracking-[0.2em] py-3.5 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
      >
        {cargando ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
        Activar mi portal
      </button>
    </form>
  );
}
