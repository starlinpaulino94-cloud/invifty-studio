"use client";

import { DatosInvitacion } from "@/lib/tipos";
import Marco, { fechaCorta, hora12 } from "../base/Marco";
import { CuerpoEstandar } from "../base/Secciones";
import { Revelar } from "../base/Efectos";
import { SolRetro, DivisorOnda } from "../base/Ornamentos";
import Texto from "../base/Texto";

/**
 * BOHO RETRO
 * Sol de rayos escalonados al estilo de los años setenta, fotografía en
 * arco invertido y ondas cálidas. Desenfadada y con mucha personalidad.
 */
export default function Boho({
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
      <header className="relative min-h-[100dvh] flex flex-col items-center justify-center px-6 py-16 overflow-hidden">
        {/* Sol retro detrás de todo */}
        <div
          className="absolute top-[6%] left-1/2 -translate-x-1/2 w-[125vw] max-w-2xl pointer-events-none opacity-45"
          style={{ color: "var(--inv-acento)" }}
        >
          <SolRetro />
        </div>

        {/* Ondas inferiores */}
        <svg
          className="absolute bottom-0 inset-x-0 w-full h-28 pointer-events-none"
          viewBox="0 0 400 100"
          preserveAspectRatio="none"
          style={{ color: "var(--inv-acento)" }}
          aria-hidden
        >
          <path d="M0 62c50-26 100-26 150 0s100 26 150 0 100-26 150 0v40H0z" fill="currentColor" opacity=".16" />
          <path d="M0 76c50-24 100-24 150 0s100 24 150 0 100-24 150 0v26H0z" fill="currentColor" opacity=".28" />
        </svg>

        <div className="relative z-10 w-full max-w-md text-center">
          {/* Fotografía en arco invertido */}
          {portada?.url && (
            <Revelar desde="escala">
              <div
                className="w-52 h-64 sm:w-60 sm:h-72 mx-auto mb-9 overflow-hidden"
                style={{
                  borderRadius: "999px 999px 24px 24px",
                  border: "6px solid var(--inv-tarjeta)",
                  boxShadow: "0 20px 50px -24px rgba(0,0,0,.45)",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={portada.url} alt="" className="w-full h-full object-cover" />
              </div>
            </Revelar>
          )}

          {datos.subtitulo && (
            <Revelar retraso={130}>
              <p
                className="text-[11px] uppercase tracking-[0.42em] mb-4"
                style={{ color: "var(--inv-acento)" }}
              >
                <Texto ruta="subtitulo">{datos.subtitulo}</Texto>
              </p>
            </Revelar>
          )}

          <Revelar retraso={210}>
            <h1
              className="text-4xl sm:text-6xl leading-[1.06] mb-5"
              style={{ fontFamily: "var(--inv-display)", color: "var(--inv-texto)" }}
            >
              <Texto ruta="titulo">{datos.titulo}</Texto>
            </h1>
          </Revelar>

          <Revelar retraso={300}>
            <div className="flex justify-center mb-6" style={{ color: "var(--inv-acento)" }}>
              <DivisorOnda />
            </div>
          </Revelar>

          {datos.fechaEvento && (
            <Revelar retraso={370}>
              <p
                className="text-2xl sm:text-3xl mb-3"
                style={{ fontFamily: "var(--inv-script)", color: "var(--inv-acento)" }}
              >
                {fc.dia} de {fc.mes}, {fc.anio}
              </p>
              {datos.horaEvento && (
                <p
                  className="text-[11px] uppercase tracking-[0.35em]"
                  style={{ color: "var(--inv-texto-suave)" }}
                >
                  {hora12(datos.horaEvento)}
                </p>
              )}
            </Revelar>
          )}

          {datos.frase && (
            <Revelar retraso={450}>
              <p
                className="text-base mt-7 leading-relaxed px-2"
                style={{ color: "var(--inv-texto-suave)" }}
              >
                <Texto ruta="frase">{datos.frase}</Texto>
              </p>
            </Revelar>
          )}
        </div>
      </header>

      <CuerpoEstandar
        datos={datos}
        fotos={fotos}
        variante="boho"
        estiloContador="tarjetas"
        disposicionGaleria="tira"
      />
    </Marco>
  );
}
