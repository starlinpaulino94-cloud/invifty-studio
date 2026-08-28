"use client";

import { useState, useRef } from "react";
import { GALERIA_MAX_MB } from "@/lib/galeria";
import { Loader2, Camera, X } from "lucide-react";

interface FotoGaleria {
  id: string;
  autor: string | null;
  url: string | null;
  miniatura: string | null;
}

/**
 * EL ÁLBUM COLABORATIVO, para los invitados: subir su foto (con su
 * nombre si quieren) y ver las de todos. Sin cuentas — la credencial es
 * el enlace, y el servidor valida todo lo demás.
 */
export default function GaleriaEvento({
  slug,
  abierta,
  fotosIniciales,
}: {
  slug: string;
  abierta: boolean;
  fotosIniciales: FotoGaleria[];
}) {
  const [fotos, setFotos] = useState(fotosIniciales);
  const [autor, setAutor] = useState("");
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState("");
  const [ampliada, setAmpliada] = useState<FotoGaleria | null>(null);
  const entrada = useRef<HTMLInputElement>(null);

  const recargar = async () => {
    try {
      const r = await fetch(`/api/galeria/${slug}/fotos`);
      const cuerpo = await r.json();
      if (r.ok) setFotos(cuerpo.fotos ?? []);
    } catch {
      // El álbum ya visible no se rompe por un refresco fallido.
    }
  };

  const subir = async (archivo: File) => {
    setError("");
    setSubiendo(true);
    try {
      const datos = new FormData();
      datos.append("archivo", archivo);
      if (autor.trim()) datos.append("autor", autor.trim());
      const r = await fetch(`/api/galeria/${slug}/fotos`, { method: "POST", body: datos });
      const cuerpo = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(cuerpo.error ?? "No se pudo subir la foto.");
      await recargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir la foto.");
    } finally {
      setSubiendo(false);
      if (entrada.current) entrada.current.value = "";
    }
  };

  return (
    <div className="space-y-6">
      {abierta ? (
        <div className="bg-white/5 border border-white/10 rounded-3xl p-5 space-y-3">
          <input
            type="text"
            value={autor}
            onChange={(e) => setAutor(e.target.value)}
            maxLength={60}
            placeholder="Tu nombre (opcional)"
            className="w-full bg-black/30 border border-white/15 focus:border-[#D4AF37] rounded-xl px-4 py-3 text-white text-sm focus:outline-none"
          />
          <input
            ref={entrada}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const archivo = e.target.files?.[0];
              if (archivo) void subir(archivo);
            }}
          />
          <button
            onClick={() => entrada.current?.click()}
            disabled={subiendo}
            className="w-full bg-[#D4AF37] hover:bg-[#F2D06B] disabled:opacity-60 text-black font-semibold text-xs uppercase tracking-[0.2em] py-3.5 rounded-xl flex items-center justify-center gap-2"
          >
            {subiendo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
            {subiendo ? "Subiendo tu foto…" : "Subir mi foto"}
          </button>
          <p className="text-white/30 text-[11px] text-center">
            JPG, PNG o la foto tal cual de tu celular · máx. {GALERIA_MAX_MB} MB
          </p>
          {error && (
            <p className="text-red-300 text-xs text-center bg-red-950/40 border border-red-500/30 rounded-xl py-2 px-3">
              {error}
            </p>
          )}
        </div>
      ) : (
        <p className="text-white/40 text-sm text-center bg-white/5 border border-white/10 rounded-3xl p-5">
          El álbum está cerrado por ahora — vuelve pronto para ver las fotos.
        </p>
      )}

      {fotos.length === 0 ? (
        abierta && (
          <p className="text-white/30 text-sm text-center">
            Aún no hay fotos. ¡Sé quien empiece el álbum!
          </p>
        )
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
          {fotos.map((f) =>
            f.miniatura ? (
              <button
                key={f.id}
                onClick={() => setAmpliada(f)}
                className="relative aspect-square overflow-hidden rounded-lg group"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal */}
                <img
                  src={f.miniatura}
                  alt={f.autor ? `Foto de ${f.autor}` : "Foto del evento"}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  loading="lazy"
                />
                {f.autor && (
                  <span className="absolute bottom-0 inset-x-0 bg-black/50 text-white/90 text-[10px] px-1.5 py-0.5 truncate text-left">
                    {f.autor}
                  </span>
                )}
              </button>
            ) : null
          )}
        </div>
      )}

      {ampliada?.url && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setAmpliada(null)}
        >
          <button
            aria-label="Cerrar"
            className="absolute top-4 right-4 text-white/70 hover:text-white"
            onClick={() => setAmpliada(null)}
          >
            <X className="w-7 h-7" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal */}
          <img
            src={ampliada.url}
            alt={ampliada.autor ? `Foto de ${ampliada.autor}` : "Foto del evento"}
            className="max-w-full max-h-full rounded-xl"
          />
          {ampliada.autor && (
            <p className="absolute bottom-5 inset-x-0 text-center text-white/70 text-sm">
              Foto de {ampliada.autor}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
