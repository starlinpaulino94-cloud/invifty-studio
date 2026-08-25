"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  crearAccesoPortal,
  reenviarActivacion,
  suspenderCuenta,
  reactivarCuenta,
  generarRecuperacion,
} from "@/lib/acciones-cuentas";
import {
  mensajeWhatsAppActivacion,
  mensajeWhatsAppRecuperacion,
  activacionVigente,
  HORAS_RECUPERACION,
} from "@/lib/cuentas";
import { BotonCopiar } from "@/components/panel/Interactivos";
import { Loader2, UserPlus, RefreshCw, Ban, Undo2, KeyRound } from "lucide-react";

interface CuentaPortal {
  estado: string;
  email: string;
  token_activacion: string | null;
  activacion_expira: string | null;
}

/**
 * LA TARJETA DEL ACCESO AL PORTAL en la ficha del pedido: crear el
 * acceso (con el correo que será el usuario), copiar el mensaje de
 * WhatsApp con el enlace de activación, reenviar cuando venza, y
 * suspender/reactivar. Las contraseñas no aparecen por ningún lado:
 * el cliente la elige él, al activar.
 */
export default function AccesoPortal({
  clienteId,
  nombreCliente,
  emailSugerido,
  cuenta,
  urlBase,
}: {
  clienteId: string;
  nombreCliente: string;
  emailSugerido: string;
  cuenta: CuentaPortal | null;
  urlBase: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState(emailSugerido);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  // El token recién creado/renovado: el servidor solo lo devuelve a quien
  // acaba de ejecutar la acción; al recargar, se lee de la cuenta.
  const [tokenFresco, setTokenFresco] = useState("");
  // El de recuperación solo vive en esta pantalla: la tabla no se relee.
  const [tokenRecuperacion, setTokenRecuperacion] = useState("");

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

  const crear = async (e: FormEvent) => {
    e.preventDefault();
    await ejecutar(async () => {
      const { token } = await crearAccesoPortal(clienteId, email);
      setTokenFresco(token);
    });
  };

  const token = tokenFresco || cuenta?.token_activacion || "";
  const urlActivacion = token ? `${urlBase}/activar/${token}` : "";
  const urlRecuperacion = tokenRecuperacion ? `${urlBase}/recuperar/${tokenRecuperacion}` : "";
  const vigente =
    cuenta !== null &&
    activacionVigente(
      { ...cuenta, token_activacion: token || cuenta.token_activacion },
      new Date()
    );

  return (
    <section className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-lg text-gray-900">Portal del cliente</h2>
        {cuenta && (
          <span
            className={`text-[10px] uppercase tracking-[0.15em] rounded-full px-3 py-1 ${
              cuenta.estado === "activa"
                ? "bg-green-100 text-green-700"
                : cuenta.estado === "suspendida"
                  ? "bg-red-100 text-red-600"
                  : "bg-amber-100 text-amber-700"
            }`}
          >
            {cuenta.estado === "pendiente" ? "activación pendiente" : cuenta.estado}
          </span>
        )}
      </div>

      {!cuenta ? (
        <form onSubmit={crear} className="space-y-3">
          <p className="text-xs text-gray-500">
            Crea el acceso y mándale el enlace de activación por WhatsApp. La
            contraseña la elige el cliente al activar — nunca viaja por chat.
          </p>
          <div className="flex gap-2">
            <input
              type="email"
              required
              placeholder="correo del cliente"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#D4AF37]"
            />
            <button
              type="submit"
              disabled={cargando}
              className="bg-gray-900 hover:bg-black disabled:opacity-60 text-white text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-2"
            >
              {cargando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
              Crear acceso
            </button>
          </div>
        </form>
      ) : cuenta.estado === "pendiente" ? (
        <div className="space-y-3">
          <p className="text-xs text-gray-500">
            Usuario: <span className="text-gray-800">{cuenta.email}</span>.{" "}
            {vigente
              ? "El enlace de activación está vigente."
              : "El enlace venció: genera uno nuevo y reenvíalo."}
          </p>
          {vigente && urlActivacion && (
            <div className="flex flex-wrap items-center gap-2">
              <code className="text-[11px] bg-gray-50 border border-gray-100 rounded-lg px-2 py-1 break-all">
                {urlActivacion}
              </code>
              <BotonCopiar
                texto={mensajeWhatsAppActivacion(nombreCliente, urlActivacion)}
                etiqueta="Copiar mensaje de WhatsApp"
              />
            </div>
          )}
          <button
            onClick={() =>
              ejecutar(async () => {
                const { token } = await reenviarActivacion(clienteId);
                setTokenFresco(token);
              })
            }
            disabled={cargando}
            className="text-xs font-semibold text-gray-700 border border-gray-200 hover:border-gray-400 rounded-xl px-3 py-2 flex items-center gap-2 disabled:opacity-60"
          >
            {cargando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Generar enlace nuevo
          </button>
        </div>
      ) : cuenta.estado === "activa" ? (
        <div className="space-y-3">
          <p className="text-xs text-gray-500">
            Cuenta activa con el correo <span className="text-gray-800">{cuenta.email}</span>. El
            cliente entra por <span className="text-gray-800">{urlBase}/portal</span>.
          </p>
          {urlRecuperacion && (
            <div className="flex flex-wrap items-center gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
              <code className="text-[11px] break-all">{urlRecuperacion}</code>
              <BotonCopiar
                texto={mensajeWhatsAppRecuperacion(nombreCliente, urlRecuperacion)}
                etiqueta="Copiar mensaje de WhatsApp"
              />
              <span className="text-[10px] text-amber-700 w-full">
                Vence en {HORAS_RECUPERACION} horas y se usa una sola vez.
              </span>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() =>
                ejecutar(async () => {
                  const { token } = await generarRecuperacion(clienteId);
                  setTokenRecuperacion(token);
                })
              }
              disabled={cargando}
              className="text-xs font-semibold text-gray-700 border border-gray-200 hover:border-gray-400 rounded-xl px-3 py-2 flex items-center gap-2 disabled:opacity-60"
            >
              {cargando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
              Enlace de recuperación
            </button>
            <button
              onClick={() => ejecutar(() => suspenderCuenta(clienteId))}
              disabled={cargando}
              className="text-xs font-semibold text-red-600 border border-red-200 hover:border-red-400 rounded-xl px-3 py-2 flex items-center gap-2 disabled:opacity-60"
            >
              {cargando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
              Suspender acceso
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-gray-500">
            El acceso está suspendido: el cliente no puede entrar, pero no se borró nada.
          </p>
          <button
            onClick={() => ejecutar(() => reactivarCuenta(clienteId))}
            disabled={cargando}
            className="text-xs font-semibold text-gray-700 border border-gray-200 hover:border-gray-400 rounded-xl px-3 py-2 flex items-center gap-2 disabled:opacity-60"
          >
            {cargando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Undo2 className="w-3.5 h-3.5" />}
            Reactivar acceso
          </button>
        </div>
      )}

      {error && (
        <p className="text-red-600 text-xs bg-red-50 border border-red-100 rounded-xl px-3 py-2">
          {error}
        </p>
      )}
    </section>
  );
}
