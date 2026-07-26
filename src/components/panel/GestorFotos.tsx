"use client";

import type { FotoInvitacion } from "@/lib/tipos";
import { ordenarFotos } from "@/lib/fotos";
import { ChevronLeft, ChevronRight, Star, Eye, EyeOff, ImageOff } from "lucide-react";

/**
 * ORDEN Y PORTADA DE LAS FOTOS
 * =============================
 * Las diez plantillas usan la primera foto como portada, y del Storage
 * llegan ordenadas por nombre de archivo — que es un UUID. Sin este panel
 * la portada de cada invitación salía al azar.
 *
 * Se usan botones en vez de arrastrar: funciona igual en el celular, es
 * accesible con teclado y no depende de librerías.
 */
export default function GestorFotos({
  fotos,
  orden,
  ocultas,
  onCambiar,
}: {
  /** Todas las fotos del pedido, incluidas las ocultas. */
  fotos: FotoInvitacion[];
  orden: string[];
  ocultas: string[];
  onCambiar: (orden: string[], ocultas: string[]) => void;
}) {
  if (!fotos.length) {
    return (
      <p className="text-sm text-gray-400 flex items-center gap-2">
        <ImageOff className="w-4 h-4" />
        El cliente todavía no ha subido fotos.
      </p>
    );
  }

  // Se muestran en el orden real de la invitación, y las ocultas al final.
  const visibles = ordenarFotos(fotos, orden, ocultas);
  const escondidas = fotos.filter((f) => ocultas.includes(f.nombre));

  /** Guarda el orden completo, no solo lo movido, para que no haya huecos. */
  const guardarOrden = (nuevas: FotoInvitacion[]) =>
    onCambiar(nuevas.map((f) => f.nombre), ocultas);

  const mover = (indice: number, direccion: -1 | 1) => {
    const destino = indice + direccion;
    if (destino < 0 || destino >= visibles.length) return;
    const copia = [...visibles];
    [copia[indice], copia[destino]] = [copia[destino], copia[indice]];
    guardarOrden(copia);
  };

  const hacerPortada = (indice: number) => {
    const copia = [...visibles];
    const [elegida] = copia.splice(indice, 1);
    guardarOrden([elegida, ...copia]);
  };

  const ocultar = (nombre: string) => {
    const restantes = visibles.filter((f) => f.nombre !== nombre);
    onCambiar(restantes.map((f) => f.nombre), [...ocultas, nombre]);
  };

  const mostrar = (nombre: string) => {
    const nuevasOcultas = ocultas.filter((n) => n !== nombre);
    // Vuelve al final, para no descolocar lo que ya estaba puesto.
    onCambiar([...visibles.map((f) => f.nombre), nombre], nuevasOcultas);
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {visibles.map((foto, i) => (
          <div
            key={foto.nombre}
            className={`relative rounded-xl overflow-hidden border-2 ${
              i === 0 ? "border-[#D4AF37]" : "border-gray-200"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={foto.urlMiniatura ?? foto.url}
              alt=""
              loading="lazy"
              className="w-full aspect-square object-cover bg-gray-50"
            />

            {i === 0 && (
              <span className="absolute top-1.5 left-1.5 bg-[#D4AF37] text-black text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                <Star className="w-2.5 h-2.5" /> Portada
              </span>
            )}

            <div className="absolute inset-x-0 bottom-0 bg-black/60 backdrop-blur-sm flex items-center justify-between px-1 py-1">
              <button
                type="button"
                onClick={() => mover(i, -1)}
                disabled={i === 0}
                className="text-white/80 hover:text-white disabled:opacity-25 p-1"
                aria-label="Mover a la izquierda"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-0.5">
                {i !== 0 && (
                  <button
                    type="button"
                    onClick={() => hacerPortada(i)}
                    className="text-white/80 hover:text-[#F2D06B] p-1"
                    title="Usar como portada"
                    aria-label="Usar como portada"
                  >
                    <Star className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => ocultar(foto.nombre)}
                  className="text-white/80 hover:text-red-300 p-1"
                  title="No mostrar en la invitación"
                  aria-label="Ocultar foto"
                >
                  <EyeOff className="w-4 h-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => mover(i, 1)}
                disabled={i === visibles.length - 1}
                className="text-white/80 hover:text-white disabled:opacity-25 p-1"
                aria-label="Mover a la derecha"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-gray-400">
        La primera foto es la portada. La galería las muestra en este orden.
      </p>

      {escondidas.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-2">
            Ocultas ({escondidas.length}) — el cliente las subió pero no salen
          </p>
          <div className="flex flex-wrap gap-2">
            {escondidas.map((foto) => (
              <button
                key={foto.nombre}
                type="button"
                onClick={() => mostrar(foto.nombre)}
                className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200 group"
                title="Volver a mostrar"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={foto.urlMiniatura ?? foto.url}
                  alt=""
                  loading="lazy"
                  className="w-full h-full object-cover opacity-40 group-hover:opacity-70 transition-opacity"
                />
                <span className="absolute inset-0 flex items-center justify-center text-gray-700">
                  <Eye className="w-4 h-4" />
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
