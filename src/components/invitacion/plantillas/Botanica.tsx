"use client";

import { DatosInvitacion } from "@/lib/tipos";
import Marco, { fechaCorta, hora12 } from "../base/Marco";
import { CuerpoEstandar } from "../base/Secciones";
import { Revelar } from "../base/Efectos";
import { DivisorBotanico } from "../base/Ornamentos";
import Texto from "../base/Texto";

/**
 * BOTÁNICA
 * La invitación llega como una tarjeta de papel apoyada sobre la
 * fotografía, enmarcada por ramas dibujadas a mano. La fecha se
 * presenta en un bloque tipográfico clásico (día · mes · año).
 */
export default function Botanica({
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
      <header className="relative min-h-[100dvh] flex items-center justify-center px-5 py-16 overflow-hidden">
        {portada?.url && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={portada.url} alt="" className="absolute inset-0 w-full h-full object-cover" style={{ opacity: 0.5 }} />
            <div className="absolute inset-0" style={{ backgroundColor: "color-mix(in srgb, var(--inv-fondo) 55%, transparent)" }} />
          </>
        )}

        {/* Tarjeta de papel */}
        <Revelar desde="escala" className="relative z-10 w-full max-w-lg">
          <div
            className="relative px-7 sm:px-12 py-14 text-center shadow-2xl"
            style={{
              backgroundColor: "var(--inv-tarjeta)",
              border: "1px solid var(--inv-linea)",
            }}
          >
            {/* Filete interior */}
            <div
              className="absolute inset-3 pointer-events-none"
              style={{ border: "1px solid color-mix(in srgb, var(--inv-acento) 18%, transparent)" }}
            />

            <div className="relative">
              <div className="flex justify-center mb-6" style={{ color: "var(--inv-acento)" }}>
                <DivisorBotanico />
              </div>

              {datos.subtitulo && (
                <p
                  className="text-[10px] uppercase tracking-[0.45em] mb-6"
                  style={{ color: "var(--inv-texto-suave)" }}
                >
                  <Texto ruta="subtitulo">{datos.subtitulo}</Texto>
                </p>
              )}

              <h1
                className="text-4xl sm:text-5xl leading-tight mb-7"
                style={{ fontFamily: "var(--inv-display)", color: "var(--inv-texto)" }}
              >
                <Texto ruta="titulo">{datos.titulo}</Texto>
              </h1>

              {/* Fecha en bloque clásico */}
              {datos.fechaEvento && (
                <div
                  className="flex items-stretch justify-center gap-5 my-8 py-4"
                  style={{
                    borderTop: "1px solid var(--inv-linea)",
                    borderBottom: "1px solid var(--inv-linea)",
                  }}
                >
                  <div className="flex flex-col justify-center text-[10px] uppercase tracking-[0.25em]" style={{ color: "var(--inv-texto-suave)" }}>
                    {fc.diaSemana}
                  </div>
                  <div
                    className="px-5 flex items-center"
                    style={{ borderLeft: "1px solid var(--inv-linea)", borderRight: "1px solid var(--inv-linea)" }}
                  >
                    <span className="text-5xl leading-none" style={{ fontFamily: "var(--inv-display)", color: "var(--inv-acento)" }}>
                      {fc.dia}
                    </span>
                  </div>
                  <div className="flex flex-col justify-center text-[10px] uppercase tracking-[0.25em] text-left" style={{ color: "var(--inv-texto-suave)" }}>
                    <span>{fc.mes}</span>
                    <span>{fc.anio}</span>
                  </div>
                </div>
              )}

              {datos.horaEvento && (
                <p className="text-[11px] uppercase tracking-[0.35em] mb-6" style={{ color: "var(--inv-texto)" }}>
                  {hora12(datos.horaEvento)}
                </p>
              )}

              {datos.frase && (
                <p
                  className="text-xl sm:text-2xl leading-relaxed"
                  style={{ fontFamily: "var(--inv-script)", color: "var(--inv-acento)" }}
                >
                  <Texto ruta="frase">{datos.frase}</Texto>
                </p>
              )}

              <div className="flex justify-center mt-7 rotate-180" style={{ color: "var(--inv-acento)" }}>
                <DivisorBotanico />
              </div>
            </div>
          </div>
        </Revelar>
      </header>

      <CuerpoEstandar
        datos={datos}
        fotos={fotos}
        variante="botanica"
        estiloContador="circulos"
        disposicionGaleria="mosaico"
      />
    </Marco>
  );
}
