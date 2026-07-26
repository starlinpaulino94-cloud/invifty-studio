"use client";

import { DatosInvitacion } from "@/lib/tipos";
import Marco, { fechaLarga, hora12 } from "../base/Marco";
import { CuerpoEstandar } from "../base/Secciones";
import { Revelar } from "../base/Efectos";
import { MarcoDeco, DivisorDeco, inicialesDe } from "../base/Ornamentos";
import Texto from "../base/Texto";

/**
 * ART DÉCO
 * Marco geométrico escalonado estilo años 20, rayos dorados de fondo
 * y monograma en rombo. Pensada para 15 años y galas.
 */
export default function Deco({
  datos,
  fotos,
  esBorrador,
}: {
  datos: DatosInvitacion;
  fotos: { nombre: string; url?: string }[];
  esBorrador?: boolean;
}) {
  const portada = fotos[0];
  const iniciales = (datos.monograma?.trim() || inicialesDe(datos.titulo)).slice(0, 7);

  return (
    <Marco datos={datos} esBorrador={esBorrador}>
      <header className="relative min-h-[100dvh] flex items-center justify-center px-5 py-16 overflow-hidden">
        {/* Rayos radiales de fondo */}
        <div className="absolute inset-0 overflow-hidden" aria-hidden>
          <svg viewBox="0 0 400 400" className="absolute left-1/2 top-1/2 w-[160vmax] h-[160vmax] -translate-x-1/2 -translate-y-1/2" style={{ opacity: 0.09 }}>
            {Array.from({ length: 24 }).map((_, i) => (
              <path
                key={i}
                d="M200 200L200 0L216 0Z"
                fill="var(--inv-acento)"
                transform={`rotate(${i * 15} 200 200)`}
              />
            ))}
          </svg>
        </div>

        {portada?.url && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={portada.url} alt="" className="absolute inset-0 w-full h-full object-cover" style={{ opacity: 0.22 }} />
            <div
              className="absolute inset-0"
              style={{ background: "radial-gradient(ellipse at center, transparent 30%, var(--inv-fondo) 85%)" }}
            />
          </>
        )}

        <Revelar desde="escala" className="relative z-10 w-full max-w-md">
          <div className="relative px-8 py-16 text-center">
            {/* Marco déco */}
            <div className="absolute inset-0 pointer-events-none" style={{ color: "var(--inv-acento)" }}>
              <MarcoDeco />
            </div>

            <div className="relative">
              {/* Monograma en rombo */}
              <div className="flex justify-center mb-8">
                <div className="relative w-20 h-20 flex items-center justify-center">
                  <div
                    className="absolute inset-0 rotate-45"
                    style={{ border: "1.5px solid var(--inv-acento)" }}
                  />
                  <div
                    className="absolute inset-2 rotate-45"
                    style={{ border: "1px solid color-mix(in srgb, var(--inv-acento) 45%, transparent)" }}
                  />
                  <span
                    className="relative text-lg tracking-[0.1em]"
                    style={{ fontFamily: "var(--inv-display)", color: "var(--inv-acento)" }}
                  >
                    {iniciales}
                  </span>
                </div>
              </div>

              {datos.subtitulo && (
                <p
                  className="text-[10px] uppercase tracking-[0.5em] mb-6"
                  style={{ color: "var(--inv-acento)" }}
                >
                  <Texto ruta="subtitulo">{datos.subtitulo}</Texto>
                </p>
              )}

              <h1
                className="text-4xl sm:text-5xl leading-tight mb-6 uppercase"
                style={{ fontFamily: "var(--inv-display)", color: "var(--inv-texto)", letterSpacing: "0.06em" }}
              >
                <Texto ruta="titulo">{datos.titulo}</Texto>
              </h1>

              <div className="flex justify-center mb-6" style={{ color: "var(--inv-acento)" }}>
                <DivisorDeco />
              </div>

              {datos.frase && (
                <p
                  className="text-lg sm:text-xl mb-7 leading-relaxed"
                  style={{ fontFamily: "var(--inv-script)", color: "var(--inv-texto-suave)" }}
                >
                  <Texto ruta="frase">{datos.frase}</Texto>
                </p>
              )}

              {datos.fechaEvento && (
                <p
                  className="text-[10px] uppercase tracking-[0.4em] leading-loose"
                  style={{ color: "var(--inv-texto)" }}
                >
                  {fechaLarga(datos.fechaEvento)}
                  {datos.horaEvento && (
                    <>
                      <br />
                      <span style={{ color: "var(--inv-acento)" }}>{hora12(datos.horaEvento)}</span>
                    </>
                  )}
                </p>
              )}
            </div>
          </div>
        </Revelar>
      </header>

      <CuerpoEstandar
        datos={datos}
        fotos={fotos}
        variante="deco"
        estiloContador="tarjetas"
        disposicionGaleria="rejilla"
      />
    </Marco>
  );
}
