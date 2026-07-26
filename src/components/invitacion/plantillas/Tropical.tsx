"use client";

import { DatosInvitacion } from "@/lib/tipos";
import Marco, { fechaCorta, hora12 } from "../base/Marco";
import { CuerpoEstandar } from "../base/Secciones";
import { Revelar } from "../base/Efectos";
import { DivisorPalma } from "../base/Ornamentos";
import Texto from "../base/Texto";
import MedioPortada from "../base/MedioPortada";

/**
 * TROPICAL CARIBE
 * Fotografía a sangre con degradado cálido, hojas de palma en las
 * esquinas y un sol naciente detrás del título. Luminosa y relajada,
 * pensada para bodas de playa y celebraciones de verano.
 */
export default function Tropical({
  datos,
  fotos,
  esBorrador,
}: {
  datos: DatosInvitacion;
  fotos: { nombre: string; url?: string }[];
  esBorrador?: boolean;
}) {
  const portada = fotos[0];
  const fc = fechaCorta(datos.fechaEvento);

  return (
    <Marco datos={datos} esBorrador={esBorrador}>
      <header className="relative min-h-[100dvh] flex flex-col items-center justify-end text-center px-6 pb-24 pt-32 overflow-hidden">
        {portada?.url && (
          <>
            <MedioPortada medio={portada} className="absolute inset-0 w-full h-full object-cover" style={{ opacity: 0.62 }} />
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(to bottom, color-mix(in srgb, var(--inv-fondo) 35%, transparent) 0%, transparent 40%, var(--inv-fondo) 92%)",
              }}
            />
          </>
        )}

        {/* Sol naciente */}
        <div className="absolute top-[18%] left-1/2 -translate-x-1/2 pointer-events-none" aria-hidden>
          <div
            className="w-52 h-52 sm:w-72 sm:h-72 rounded-full"
            style={{
              background:
                "radial-gradient(circle, color-mix(in srgb, var(--inv-acento-claro) 45%, transparent) 0%, transparent 68%)",
            }}
          />
        </div>

        {/* Hojas de palma en las esquinas superiores */}
        <div className="absolute -top-6 -left-10 rotate-[25deg] opacity-30 pointer-events-none" style={{ color: "var(--inv-acento)" }} aria-hidden>
          <HojaPalma />
        </div>
        <div className="absolute -top-6 -right-10 -rotate-[25deg] scale-x-[-1] opacity-30 pointer-events-none" style={{ color: "var(--inv-acento)" }} aria-hidden>
          <HojaPalma />
        </div>

        <div className="relative z-10 max-w-xl">
          {datos.subtitulo && (
            <Revelar>
              <p
                className="text-[10px] uppercase tracking-[0.5em] mb-6"
                style={{ color: "var(--inv-acento)" }}
              >
                <Texto ruta="subtitulo">{datos.subtitulo}</Texto>
              </p>
            </Revelar>
          )}

          <Revelar retraso={140}>
            <h1
              className="text-5xl sm:text-7xl leading-[1.05] mb-6"
              style={{ fontFamily: "var(--inv-display)", color: "var(--inv-texto)" }}
            >
              <Texto ruta="titulo">{datos.titulo}</Texto>
            </h1>
          </Revelar>

          <Revelar retraso={260}>
            <div className="flex justify-center mb-7" style={{ color: "var(--inv-acento)" }}>
              <DivisorPalma />
            </div>
          </Revelar>

          {datos.frase && (
            <Revelar retraso={340}>
              <p
                className="text-xl sm:text-2xl mb-8 leading-relaxed"
                style={{ fontFamily: "var(--inv-script)", color: "var(--inv-texto-suave)" }}
              >
                <Texto ruta="frase">{datos.frase}</Texto>
              </p>
            </Revelar>
          )}

          {datos.fechaEvento && (
            <Revelar retraso={430}>
              <div
                className="inline-flex items-center gap-4 px-7 py-3.5 rounded-full backdrop-blur-sm"
                style={{
                  backgroundColor: "color-mix(in srgb, var(--inv-tarjeta) 75%, transparent)",
                  border: "1px solid var(--inv-linea)",
                }}
              >
                <span className="text-[11px] uppercase tracking-[0.28em]" style={{ color: "var(--inv-texto)" }}>
                  {fc.dia} {fc.mes} {fc.anio}
                </span>
                {datos.horaEvento && (
                  <>
                    <span className="w-px h-4" style={{ backgroundColor: "var(--inv-linea)" }} />
                    <span className="text-[11px] uppercase tracking-[0.28em]" style={{ color: "var(--inv-acento)" }}>
                      {hora12(datos.horaEvento)}
                    </span>
                  </>
                )}
              </div>
            </Revelar>
          )}
        </div>
      </header>

      <CuerpoEstandar
        datos={datos}
        fotos={fotos}
        variante="tropical"
        estiloContador="circulos"
        disposicionGaleria="tira"
      />
    </Marco>
  );
}

function HojaPalma() {
  return (
    <svg width="230" height="230" viewBox="0 0 200 200" fill="none" aria-hidden>
      <path d="M100 190C100 120 120 60 175 20" stroke="currentColor" strokeWidth="2" />
      {Array.from({ length: 11 }).map((_, i) => {
        const t = i / 10;
        const x = 100 + t * 75;
        const y = 190 - t * 170 + Math.pow(t, 2) * 20;
        const largo = 46 - Math.abs(t - 0.45) * 55;
        return (
          <g key={i} opacity={0.85}>
            <path d={`M${x} ${y}c-${largo * 0.7} -6 -${largo} -22 -${largo * 0.9} -34`} stroke="currentColor" strokeWidth="1.6" />
            <path d={`M${x} ${y}c${largo * 0.7} -6 ${largo} -22 ${largo * 0.9} -34`} stroke="currentColor" strokeWidth="1.6" />
          </g>
        );
      })}
    </svg>
  );
}
