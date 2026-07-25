"use client";

import { DatosInvitacion } from "@/lib/tipos";
import Marco, { fechaCorta, hora12 } from "../base/Marco";
import { CuerpoEstandar } from "../base/Secciones";
import { Revelar } from "../base/Efectos";
import { DivisorMinimo } from "../base/Ornamentos";

/**
 * ARCO
 * La fotografía se recorta dentro de un arco —la forma más pedida en
 * papelería de bodas actual— con un filete que lo perfila. Debajo, el
 * nombre y la fecha en una composición serena y muy limpia.
 */
export default function Arco({
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
      <header className="relative min-h-[100dvh] flex flex-col items-center justify-center px-6 py-16">
        {/* Arco con la fotografía */}
        <Revelar desde="escala">
          <div className="relative w-[72vw] max-w-[330px] aspect-[2/3] mx-auto">
            <div
              className="absolute inset-0 overflow-hidden"
              style={{ borderRadius: "999px 999px 12px 12px" }}
            >
              {portada?.url ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={portada.url} alt="" className="w-full h-full object-cover" />
                </>
              ) : (
                <div
                  className="w-full h-full"
                  style={{ backgroundColor: "color-mix(in srgb, var(--inv-acento) 15%, var(--inv-tarjeta))" }}
                />
              )}
            </div>

            {/* Filetes que perfilan el arco (misma geometría que la foto) */}
            <div
              className="absolute -inset-3 pointer-events-none"
              style={{
                border: "1px solid var(--inv-acento)",
                borderRadius: "999px 999px 16px 16px",
                opacity: 0.75,
              }}
            />
            <div
              className="absolute -inset-[18px] pointer-events-none"
              style={{
                border: "1px solid var(--inv-acento)",
                borderRadius: "999px 999px 20px 20px",
                opacity: 0.3,
              }}
            />

            {/* Subtítulo sobre el arco */}
            {datos.subtitulo && (
              <span
                className="absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] uppercase tracking-[0.45em]"
                style={{ color: "var(--inv-acento)" }}
              >
                {datos.subtitulo}
              </span>
            )}
          </div>
        </Revelar>

        {/* Texto bajo el arco */}
        <div className="relative z-10 text-center mt-12 max-w-lg">
          <Revelar retraso={180}>
            <h1
              className="text-4xl sm:text-6xl leading-[1.12] mb-5"
              style={{ fontFamily: "var(--inv-display)", color: "var(--inv-texto)" }}
            >
              {datos.titulo}
            </h1>
          </Revelar>

          <Revelar retraso={280}>
            <div className="flex justify-center mb-5" style={{ color: "var(--inv-acento)" }}>
              <DivisorMinimo />
            </div>
          </Revelar>

          {datos.fechaEvento && (
            <Revelar retraso={360}>
              <p
                className="text-[11px] uppercase tracking-[0.4em]"
                style={{ color: "var(--inv-texto)" }}
              >
                {fc.dia} · {fc.mes} · {fc.anio}
                {datos.horaEvento && (
                  <span style={{ color: "var(--inv-acento)" }}> · {hora12(datos.horaEvento)}</span>
                )}
              </p>
            </Revelar>
          )}

          {datos.frase && (
            <Revelar retraso={440}>
              <p
                className="text-xl sm:text-2xl mt-7 leading-relaxed"
                style={{ fontFamily: "var(--inv-script)", color: "var(--inv-texto-suave)" }}
              >
                {datos.frase}
              </p>
            </Revelar>
          )}
        </div>
      </header>

      <CuerpoEstandar
        datos={datos}
        fotos={fotos}
        variante="arco"
        estiloContador="circulos"
        disposicionGaleria="mosaico"
      />
    </Marco>
  );
}
