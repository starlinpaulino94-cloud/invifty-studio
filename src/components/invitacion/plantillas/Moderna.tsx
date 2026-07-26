"use client";

import { DatosInvitacion } from "@/lib/tipos";
import Marco, { fechaCorta, hora12 } from "../base/Marco";
import { CuerpoEstandar } from "../base/Secciones";
import { Revelar } from "../base/Efectos";
import Texto from "../base/Texto";

/**
 * MODERNA
 * Composición asimétrica a dos columnas: la fotografía ocupa un lado
 * completo y el texto respira en el otro, con tipografía enorme y
 * numeración de fecha en vertical. Minimalismo contemporáneo.
 */
export default function Moderna({
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
      <header className="relative min-h-[100dvh] grid lg:grid-cols-[1.05fr_1fr]">
        {/* Columna de texto */}
        <div className="relative flex flex-col justify-center px-7 sm:px-14 py-20 order-2 lg:order-1">
          <Revelar desde="izquierda">
            {datos.subtitulo && (
              <p
                className="text-[10px] uppercase tracking-[0.6em] mb-10"
                style={{ color: "var(--inv-acento)" }}
              >
                <Texto ruta="subtitulo">{datos.subtitulo}</Texto>
              </p>
            )}
          </Revelar>

          <Revelar desde="izquierda" retraso={140}>
            <h1
              className="text-[15vw] lg:text-[5.5rem] leading-[0.92] mb-10 -ml-1"
              style={{ fontFamily: "var(--inv-display)", color: "var(--inv-texto)" }}
            >
              <Texto ruta="titulo">{datos.titulo}</Texto>
            </h1>
          </Revelar>

          <Revelar desde="izquierda" retraso={260}>
            <div
              className="w-16 h-px mb-10"
              style={{ backgroundColor: "var(--inv-acento)" }}
            />
          </Revelar>

          {datos.fechaEvento && (
            <Revelar desde="izquierda" retraso={340}>
              <div className="flex items-baseline gap-4 mb-6">
                <span
                  className="text-6xl leading-none tabular-nums"
                  style={{ fontFamily: "var(--inv-display)", color: "var(--inv-acento)" }}
                >
                  {fc.dia}
                </span>
                <div className="text-[10px] uppercase tracking-[0.35em] leading-relaxed" style={{ color: "var(--inv-texto-suave)" }}>
                  <span className="block">{fc.mes}</span>
                  <span className="block">{fc.anio}</span>
                  {datos.horaEvento && (
                    <span className="block mt-1" style={{ color: "var(--inv-texto)" }}>
                      {hora12(datos.horaEvento)}
                    </span>
                  )}
                </div>
              </div>
            </Revelar>
          )}

          {datos.frase && (
            <Revelar desde="izquierda" retraso={440}>
              <p
                className="text-base sm:text-lg max-w-sm leading-relaxed"
                style={{ color: "var(--inv-texto-suave)" }}
              >
                <Texto ruta="frase">{datos.frase}</Texto>
              </p>
            </Revelar>
          )}

          {datos.lugares[0] && (
            <Revelar desde="izquierda" retraso={520}>
              <p
                className="mt-10 text-[10px] uppercase tracking-[0.32em] leading-loose"
                style={{ color: "var(--inv-texto-suave)" }}
              >
                {datos.lugares[0].detalle.split(/[,\n]/)[0]}
              </p>
            </Revelar>
          )}
        </div>

        {/* Columna de imagen */}
        <div className="relative min-h-[52dvh] lg:min-h-full order-1 lg:order-2 overflow-hidden">
          {portada?.url ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={portada.url} alt="" className="absolute inset-0 w-full h-full object-cover" />
              <div
                className="absolute inset-0 lg:hidden"
                style={{ background: "linear-gradient(to bottom, transparent 55%, var(--inv-fondo) 100%)" }}
              />
            </>
          ) : (
            <div
              className="absolute inset-0"
              style={{ backgroundColor: "color-mix(in srgb, var(--inv-acento) 10%, var(--inv-tarjeta))" }}
            />
          )}
        </div>
      </header>

      <CuerpoEstandar
        datos={datos}
        fotos={fotos}
        variante="moderna"
        estiloContador="lineal"
        disposicionGaleria="rejilla"
      />
    </Marco>
  );
}
