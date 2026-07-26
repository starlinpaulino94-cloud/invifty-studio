"use client";

import { DatosInvitacion } from "@/lib/tipos";
import Marco, { fechaCorta, hora12, etiquetaDressCode } from "../base/Marco";
import { CuerpoEstandar } from "../base/Secciones";
import { Revelar } from "../base/Efectos";
import Texto from "../base/Texto";

/**
 * CINEMA
 * Fotografía a sangre con bandas cinematográficas, título condensado
 * enorme abajo a la izquierda y una ficha técnica del evento a modo de
 * créditos. Contemporánea y de mucho impacto.
 */
export default function Cinema({
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

  const creditos: { etiqueta: string; valor: string }[] = [
    { etiqueta: "Fecha", valor: datos.fechaEvento ? `${fc.dia}.${datos.fechaEvento.slice(5, 7)}.${fc.anio}` : "" },
    { etiqueta: "Hora", valor: hora12(datos.horaEvento) },
    { etiqueta: "Lugar", valor: datos.lugares[0]?.detalle.split(/[,\n]/)[0] ?? "" },
    { etiqueta: "Código", valor: datos.dressCode ? etiquetaDressCode(datos.dressCode) : "" },
  ].filter((c) => c.valor);

  return (
    <Marco datos={datos} esBorrador={esBorrador}>
      <header className="relative min-h-[100dvh] flex flex-col justify-end overflow-hidden">
        {portada?.url ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={portada.url} alt="" className="absolute inset-0 w-full h-full object-cover" />
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(to bottom, color-mix(in srgb, var(--inv-fondo) 45%, transparent) 0%, transparent 32%, color-mix(in srgb, var(--inv-fondo) 92%, transparent) 78%, var(--inv-fondo) 100%)",
              }}
            />
          </>
        ) : (
          <div className="absolute inset-0" style={{ backgroundColor: "var(--inv-tarjeta)" }} />
        )}

        {/* Bandas cinematográficas */}
        <div className="absolute top-0 inset-x-0 h-[7dvh]" style={{ backgroundColor: "var(--inv-fondo)" }} />
        <div className="absolute bottom-0 inset-x-0 h-[7dvh]" style={{ backgroundColor: "var(--inv-fondo)" }} />

        {/* Marca de rodaje arriba */}
        <div
          className="absolute top-[7dvh] left-0 right-0 flex items-center justify-between px-6 py-3 text-[9px] uppercase tracking-[0.35em]"
          style={{ color: "var(--inv-acento)" }}
        >
          <span className="inline-flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: "var(--inv-acento)" }} />
            <Texto ruta="subtitulo">{datos.subtitulo || "Estás invitado"}</Texto>
          </span>
          <span>{fc.anio}</span>
        </div>

        <div className="relative z-10 px-6 pb-[11dvh]">
          <Revelar desde="izquierda">
            <h1
              className="uppercase leading-[0.86] mb-6 text-[16vw] sm:text-[8rem]"
              style={{
                fontFamily: "var(--inv-display)",
                color: "var(--inv-texto)",
                letterSpacing: "-0.01em",
              }}
            >
              <Texto ruta="titulo">{datos.titulo}</Texto>
            </h1>
          </Revelar>

          {datos.frase && (
            <Revelar desde="izquierda" retraso={160}>
              <p
                className="text-sm sm:text-base max-w-md mb-8 leading-relaxed"
                style={{ color: "var(--inv-texto-suave)" }}
              >
                <Texto ruta="frase">{datos.frase}</Texto>
              </p>
            </Revelar>
          )}

          {/* Ficha técnica */}
          <Revelar desde="izquierda" retraso={260}>
            <div
              className="grid grid-cols-2 sm:grid-cols-4 gap-x-5 gap-y-4 pt-6 max-w-2xl"
              style={{ borderTop: "1px solid var(--inv-linea)" }}
            >
              {creditos.map((c) => (
                <div key={c.etiqueta}>
                  <p
                    className="text-[9px] uppercase tracking-[0.3em] mb-1"
                    style={{ color: "var(--inv-acento)" }}
                  >
                    {c.etiqueta}
                  </p>
                  <p className="text-xs leading-snug" style={{ color: "var(--inv-texto)" }}>
                    {c.valor}
                  </p>
                </div>
              ))}
            </div>
          </Revelar>
        </div>
      </header>

      <CuerpoEstandar
        datos={datos}
        fotos={fotos}
        variante="cinema"
        estiloContador="lineal"
        disposicionGaleria="rejilla"
      />
    </Marco>
  );
}
