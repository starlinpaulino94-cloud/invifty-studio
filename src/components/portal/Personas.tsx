"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  invitarColaborador,
  revocarInvitacionColaborador,
  quitarColaborador,
  actualizarPermisosColaborador,
} from "@/lib/acciones-portal";
import {
  PERMISOS_COLABORADOR,
  invitacionVigente,
  mensajeWhatsAppInvitacionColaborador,
  tienePermiso,
  type PermisoColaborador,
} from "@/lib/cuentas";
import { Loader2, UserPlus, Copy, Check, X } from "lucide-react";

interface Miembro {
  id: string;
  usuario_id: string;
  rol: string;
  permisos: Record<string, unknown> | null;
  email: string | null;
}

interface Invitacion {
  id: string;
  email: string;
  permisos: Record<string, unknown> | null;
  token: string;
  expira_en: string;
  usado_en: string | null;
  revocada_en: string | null;
}

/**
 * La gestión de acceso del propietario: miembros actuales, invitaciones
 * pendientes (con su mensaje de WhatsApp listo) e invitar con permisos
 * acotados. Cada acción vuelve a validar en el servidor que quien firma
 * es el propietario — estos botones solo son la parte visible.
 */
export default function Personas({
  miembros,
  invitaciones,
  miUsuarioId,
  base,
}: {
  miembros: Miembro[];
  invitaciones: Invitacion[];
  miUsuarioId: string;
  base: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [permisos, setPermisos] = useState<Partial<Record<PermisoColaborador, boolean>>>({});
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const [copiado, setCopiado] = useState("");

  const ahora = new Date();
  const pendientes = invitaciones.filter((i) => invitacionVigente(i, ahora));

  const ejecutar = async (accion: () => Promise<unknown>) => {
    setError("");
    setCargando(true);
    try {
      await accion();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo completar la acción.");
    } finally {
      setCargando(false);
    }
  };

  const invitar = (e: FormEvent) => {
    e.preventDefault();
    void ejecutar(async () => {
      await invitarColaborador(email, permisos);
      setEmail("");
      setPermisos({});
    });
  };

  const copiarMensaje = async (invitacion: Invitacion) => {
    await navigator.clipboard.writeText(
      mensajeWhatsAppInvitacionColaborador(`${base}/activar/${invitacion.token}`)
    );
    setCopiado(invitacion.id);
    setTimeout(() => setCopiado(""), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Quiénes ya entran */}
      <section className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-3">
        <h2 className="text-white text-sm font-semibold">En la cuenta</h2>
        <ul className="divide-y divide-white/5">
          {miembros.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 py-3">
              <div>
                <p className="text-white/80 text-xs">
                  {m.email ?? "—"}
                  {m.usuario_id === miUsuarioId && (
                    <span className="text-white/35"> (tú)</span>
                  )}
                </p>
                {m.rol === "propietario" ? (
                  <p className="text-white/35 text-[11px]">Propietario — acceso completo</p>
                ) : (
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                    {/* Cambiar aquí cambia YA: mi_permiso() en la base lee la fila viva. */}
                    {PERMISOS_COLABORADOR.map((p) => (
                      <label
                        key={p.id}
                        className="flex items-center gap-1.5 text-white/45 text-[11px] cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={tienePermiso(m, p.id)}
                          disabled={cargando}
                          onChange={(e) =>
                            ejecutar(() =>
                              actualizarPermisosColaborador(m.id, {
                                ...Object.fromEntries(
                                  PERMISOS_COLABORADOR.map((otro) => [otro.id, tienePermiso(m, otro.id)])
                                ),
                                [p.id]: e.target.checked,
                              })
                            )
                          }
                          className="accent-[#D4AF37]"
                        />
                        {p.nombre}
                      </label>
                    ))}
                  </div>
                )}
              </div>
              {m.rol === "colaborador" && (
                <button
                  onClick={() => ejecutar(() => quitarColaborador(m.id))}
                  disabled={cargando}
                  className="text-red-300/80 hover:text-red-300 text-[11px] uppercase tracking-[0.15em] disabled:opacity-60"
                >
                  Quitar
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* Invitaciones pendientes */}
      {pendientes.length > 0 && (
        <section className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-3">
          <h2 className="text-white text-sm font-semibold">Invitaciones pendientes</h2>
          <ul className="divide-y divide-white/5">
            {pendientes.map((i) => (
              <li key={i.id} className="py-3 space-y-2">
                <p className="text-white/80 text-xs">{i.email}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => copiarMensaje(i)}
                    className="inline-flex items-center gap-1.5 text-[#D4AF37] hover:text-[#F2D06B] text-[11px] font-semibold uppercase tracking-[0.15em]"
                  >
                    {copiado === i.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiado === i.id ? "Copiado" : "Copiar mensaje de WhatsApp"}
                  </button>
                  <button
                    onClick={() => ejecutar(() => revocarInvitacionColaborador(i.id))}
                    disabled={cargando}
                    className="inline-flex items-center gap-1 text-red-300/80 hover:text-red-300 text-[11px] uppercase tracking-[0.15em] disabled:opacity-60"
                  >
                    <X className="w-3.5 h-3.5" /> Revocar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Invitar */}
      <section className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4">
        <h2 className="text-white text-sm font-semibold">Invitar a alguien</h2>
        <form onSubmit={invitar} className="space-y-3">
          <input
            type="email"
            required
            placeholder="correo del colaborador"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-black/30 border border-white/15 focus:border-[#D4AF37] rounded-xl px-4 py-3 text-white text-sm focus:outline-none"
          />
          {PERMISOS_COLABORADOR.map((p) => (
            <label key={p.id} className="flex items-center gap-2.5 text-white/60 text-xs">
              <input
                type="checkbox"
                checked={permisos[p.id] ?? false}
                onChange={(e) => setPermisos({ ...permisos, [p.id]: e.target.checked })}
                className="accent-[#D4AF37]"
              />
              {p.nombre}
            </label>
          ))}
          {error && (
            <p className="text-red-300 text-xs bg-red-950/40 border border-red-500/30 rounded-xl py-2 px-3">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={cargando}
            className="bg-[#D4AF37] hover:bg-[#F2D06B] disabled:opacity-60 text-black font-semibold text-xs uppercase tracking-[0.2em] py-3 px-5 rounded-xl flex items-center gap-2"
          >
            {cargando ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            Invitar
          </button>
        </form>
        <p className="text-white/30 text-[11px]">
          El enlace vence en 7 días y se usa una vez. Tu colaborador elige su
          propia contraseña al activar.
        </p>
      </section>
    </div>
  );
}
