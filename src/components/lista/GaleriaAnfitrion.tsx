"use client";

import { useEffect, useState, useCallback } from "react";
import { mensajeWhatsAppGaleria } from "@/lib/galeria";
import { Loader2, Camera, Copy, Check, Eye, EyeOff, Trash2 } from "lucide-react";

interface FotoModeracion {
  id: string;
  autor: string | null;
  estado: "visible" | "oculta";
  miniatura: string | null;
}

/**
 * LA GALERÍA, DEL LADO DEL ANFITRIÓN: abrirla y cerrarla, compartir el
 * enlace del álbum, y moderar — ocultar (sale del álbum sin borrarse) o
 * eliminar del todo. Autenticado por el mismo token secreto de su lista.
 */
export default function GaleriaAnfitrion({
  token,
  slug,
  abiertaInicial,
}: {
  token: string;
  slug: string;
  abiertaInicial: boolean;
}) {
  const [abierta, setAbierta] = useState(abiertaInicial);
  const [fotos, setFotos] = useState<FotoModeracion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const [copiado, setCopiado] = useState(false);

  const urlAlbum = typeof window !== "undefined" ? `${window.location.origin}/galeria/${slug}` : `/galeria/${slug}`;

  const cargar = useCallback(async () => {
    try {
      const r = await fetch(`/api/lista/${token}/galeria`);
      const cuerpo = await r.json();
      if (r.ok) {
        setFotos(cuerpo.fotos ?? []);
        setAbierta(Boolean(cuerpo.abierta));
      }
    } catch {
      // La sección no tumba el panel del anfitrión.
    } finally {
      setCargando(false);
    }
  }, [token]);

  useEffect(() => {
    // Diferido a la siguiente vuelta: la carga inicial no dispara estados
    // dentro del propio efecto (regla react-hooks/set-state-in-effect).
    const temporizador = setTimeout(() => void cargar(), 0);
    return () => clearTimeout(temporizador);
  }, [cargar]);

  const llamar = async (init: RequestInit) => {
    setError("");
    setOcupado(true);
    try {
      const r = await fetch(`/api/lista/${token}/galeria`, {
        headers: { "Content-Type": "application/json" },
        ...init,
      });
      const cuerpo = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(cuerpo.error ?? "No se pudo completar la acción.");
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo completar la acción.");
    } finally {
      setOcupado(false);
    }
  };

  const copiarMensaje = async () => {
    await navigator.clipboard.writeText(mensajeWhatsAppGaleria(urlAlbum));
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  return (
    <section className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4 mt-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-white text-sm font-medium flex items-center gap-2">
          <Camera className="w-4 h-4 text-[#D4AF37]" /> Álbum del evento
        </h2>
        <label className="flex items-center gap-2 text-xs text-white/60 cursor-pointer">
          <input
            type="checkbox"
            checked={abierta}
            disabled={ocupado}
            onChange={(e) => llamar({ method: "PATCH", body: JSON.stringify({ abierta: e.target.checked }) })}
            className="accent-[#D4AF37]"
          />
          {abierta ? "Abierto: los invitados pueden subir fotos" : "Cerrado"}
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <code className="bg-black/30 border border-white/10 rounded-lg px-2 py-1 break-all text-white/60">{urlAlbum}</code>
        <button
          onClick={copiarMensaje}
          className="inline-flex items-center gap-1.5 text-[#D4AF37] hover:text-[#F2D06B] font-semibold uppercase tracking-[0.12em] text-[11px]"
        >
          {copiado ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copiado ? "Copiado" : "Copiar mensaje para invitados"}
        </button>
      </div>

      {error && <p className="text-red-300 text-xs">{error}</p>}

      {cargando ? (
        <p className="text-white/40 text-xs flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Cargando el álbum…
        </p>
      ) : fotos.length === 0 ? (
        <p className="text-white/40 text-xs">
          Aún no hay fotos. Comparte el enlace el día del evento y el álbum se llena solo.
        </p>
      ) : (
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
          {fotos.map((f) => (
            <div key={f.id} className="relative aspect-square rounded-lg overflow-hidden group bg-black/30">
              {f.miniatura && (
                // eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal
                <img
                  src={f.miniatura}
                  alt={f.autor ? `Foto de ${f.autor}` : "Foto del evento"}
                  className={`w-full h-full object-cover ${f.estado === "oculta" ? "opacity-30" : ""}`}
                  loading="lazy"
                />
              )}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                <button
                  title={f.estado === "oculta" ? "Mostrar" : "Ocultar del álbum"}
                  disabled={ocupado}
                  onClick={() =>
                    llamar({
                      method: "PATCH",
                      body: JSON.stringify({ fotoId: f.id, estado: f.estado === "oculta" ? "visible" : "oculta" }),
                    })
                  }
                  className="text-white/90 hover:text-white"
                >
                  {f.estado === "oculta" ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
                <button
                  title="Eliminar para siempre"
                  disabled={ocupado}
                  onClick={() => {
                    if (window.confirm("¿Eliminar esta foto para siempre?")) {
                      void llamar({ method: "DELETE", body: JSON.stringify({ fotoId: f.id }) });
                    }
                  }}
                  className="text-red-300 hover:text-red-200"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              {f.estado === "oculta" && (
                <span className="absolute top-1 left-1 bg-black/60 text-white text-[9px] uppercase tracking-wide rounded px-1">
                  oculta
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
