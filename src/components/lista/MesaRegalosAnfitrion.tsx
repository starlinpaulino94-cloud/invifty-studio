"use client";

import { useEffect, useState, useCallback } from "react";
import {
  lineaTotal,
  mensajeWhatsAppRegalos,
  resumenAportes,
  MAX_CUENTAS_REGALO,
  type CuentaRegalo,
} from "@/lib/regalos";
import { formatoDOP } from "@/lib/planes";
import { Loader2, Gift, Copy, Check, Eye, EyeOff, Trash2, Save } from "lucide-react";

interface AporteDeLista {
  id: string;
  nombre: string;
  monto: number | null;
  mensaje: string | null;
  estado: "visible" | "oculta";
  creado_en: string;
}

type CuentaEditable = { banco: string; numero: string; titular: string; documento: string };

const CUENTA_VACIA: CuentaEditable = { banco: "", numero: "", titular: "", documento: "" };

/**
 * LA MESA DE REGALOS, DEL LADO DEL ANFITRIÓN: sus cuentas bancarias
 * (suyas, no de Invifty), el enlace para compartir, y la lista de
 * agradecimientos con el total declarado — con ocultar y borrar.
 */
export default function MesaRegalosAnfitrion({
  token,
  slug,
}: {
  token: string;
  slug: string;
}) {
  const [cuentas, setCuentas] = useState<CuentaEditable[]>([{ ...CUENTA_VACIA }]);
  const [aportes, setAportes] = useState<AporteDeLista[]>([]);
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const [copiado, setCopiado] = useState(false);
  const [guardado, setGuardado] = useState(false);

  const urlMesa =
    typeof window !== "undefined" ? `${window.location.origin}/regalos/${slug}` : `/regalos/${slug}`;

  const cargar = useCallback(async () => {
    try {
      const r = await fetch(`/api/lista/${token}/regalos`);
      const cuerpo = await r.json();
      if (r.ok) {
        setAportes(cuerpo.aportes ?? []);
        const guardadas = (cuerpo.cuentas ?? []) as CuentaRegalo[];
        setCuentas(
          guardadas.length
            ? guardadas.map((c) => ({ ...CUENTA_VACIA, ...c }))
            : [{ ...CUENTA_VACIA }]
        );
      }
    } catch {
      // La sección no tumba el panel del anfitrión.
    } finally {
      setCargando(false);
    }
  }, [token]);

  useEffect(() => {
    // Diferido: la carga inicial no dispara estados dentro del efecto.
    const temporizador = setTimeout(() => void cargar(), 0);
    return () => clearTimeout(temporizador);
  }, [cargar]);

  const llamar = async (init: RequestInit) => {
    setError("");
    setOcupado(true);
    try {
      const r = await fetch(`/api/lista/${token}/regalos`, {
        headers: { "Content-Type": "application/json" },
        ...init,
      });
      const cuerpo = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(cuerpo.error ?? "No se pudo completar la acción.");
      await cargar();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo completar la acción.");
      return false;
    } finally {
      setOcupado(false);
    }
  };

  const guardarCuentas = async () => {
    const ok = await llamar({ method: "PATCH", body: JSON.stringify({ cuentas }) });
    if (ok) {
      setGuardado(true);
      setTimeout(() => setGuardado(false), 2000);
    }
  };

  const copiarMensaje = async () => {
    await navigator.clipboard.writeText(mensajeWhatsAppRegalos(urlMesa));
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  const editarCuenta = (i: number, campo: keyof CuentaEditable, valor: string) => {
    const nuevas = cuentas.map((c, j) => (j === i ? { ...c, [campo]: valor } : c));
    setCuentas(nuevas);
  };

  const resumen = resumenAportes(aportes);
  const campo =
    "bg-black/30 border border-white/15 focus:border-[#D4AF37] rounded-lg px-2.5 py-2 text-white text-[11px] focus:outline-none w-full";

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mt-6">
      <div className="flex items-center justify-between gap-3 mb-1 flex-wrap">
        <h2 className="text-white text-sm font-medium flex items-center gap-2">
          <Gift className="w-4 h-4 text-[#D4AF37]" /> Mesa de regalos
        </h2>
        <button
          onClick={copiarMensaje}
          className="inline-flex items-center gap-1.5 text-[#D4AF37] hover:text-[#F2D06B] text-[11px] font-semibold uppercase tracking-[0.12em]"
        >
          {copiado ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copiado ? "Copiado" : "Copiar mensaje para compartir"}
        </button>
      </div>
      <p className="text-white/40 text-xs mb-4">
        Tus cuentas para recibir los regalos (el dinero llega directo a ti) y
        la lista de quién te regaló, para los agradecimientos.
      </p>

      {/* Las cuentas del anfitrión */}
      <div className="space-y-2 mb-3">
        {cuentas.map((c, i) => (
          <div key={i} className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            <input placeholder="Banco" value={c.banco} maxLength={40} className={campo}
              onChange={(e) => editarCuenta(i, "banco", e.target.value)} />
            <input placeholder="Número de cuenta" value={c.numero} maxLength={34} className={campo}
              onChange={(e) => editarCuenta(i, "numero", e.target.value)} />
            <input placeholder="Titular" value={c.titular} maxLength={80} className={campo}
              onChange={(e) => editarCuenta(i, "titular", e.target.value)} />
            <input placeholder="Cédula (opcional)" value={c.documento} maxLength={30} className={campo}
              onChange={(e) => editarCuenta(i, "documento", e.target.value)} />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button
          onClick={guardarCuentas}
          disabled={ocupado}
          className="bg-[#D4AF37] hover:bg-[#F2D06B] disabled:opacity-50 text-black font-semibold text-[11px] uppercase tracking-[0.15em] px-4 py-2.5 rounded-xl inline-flex items-center gap-1.5"
        >
          {ocupado ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : guardado ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
          {guardado ? "Guardado" : "Guardar cuentas"}
        </button>
        {cuentas.length < MAX_CUENTAS_REGALO && (
          <button
            onClick={() => setCuentas([...cuentas, { ...CUENTA_VACIA }])}
            className="text-white/50 hover:text-white text-[11px] uppercase tracking-[0.12em]"
          >
            + Otra cuenta
          </button>
        )}
      </div>

      {error && <p className="text-red-300 text-xs mb-3">{error}</p>}

      {/* La lista de agradecimientos */}
      {cargando ? (
        <p className="text-white/40 text-xs flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Cargando tu mesa…
        </p>
      ) : aportes.length === 0 ? (
        <p className="text-white/30 text-xs">
          Cuando alguien registre su regalo, aquí verás su nombre y su mensaje.
        </p>
      ) : (
        <>
          <p className="text-white/60 text-xs font-semibold mb-2">{lineaTotal(resumen)}</p>
          <ul className="divide-y divide-white/5">
            {aportes.map((a) => (
              <li key={a.id} className={`py-2.5 ${a.estado === "oculta" ? "opacity-40" : ""}`}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-white/80 text-xs font-medium truncate">
                    {a.nombre}
                    {a.monto !== null && (
                      <span className="text-[#D4AF37] font-semibold"> · {formatoDOP(Number(a.monto))}</span>
                    )}
                  </p>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      title={a.estado === "oculta" ? "Mostrar" : "Ocultar de la lista"}
                      disabled={ocupado}
                      onClick={() =>
                        llamar({
                          method: "PATCH",
                          body: JSON.stringify({
                            aporteId: a.id,
                            estado: a.estado === "oculta" ? "visible" : "oculta",
                          }),
                        })
                      }
                      className="text-white/50 hover:text-white"
                    >
                      {a.estado === "oculta" ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      title="Eliminar"
                      disabled={ocupado}
                      onClick={() => {
                        if (window.confirm("¿Eliminar este registro para siempre?")) {
                          void llamar({ method: "DELETE", body: JSON.stringify({ aporteId: a.id }) });
                        }
                      }}
                      className="text-red-300/70 hover:text-red-300"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {a.mensaje && <p className="text-white/40 text-[11px] mt-0.5">“{a.mensaje}”</p>}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
