"use client";

import { DatosInvitacion } from "@/lib/tipos";
import Marco, { fechaLarga, hora12 } from "../base/Marco";
import { CuerpoEstandar } from "../base/Secciones";
import { Revelar, MonogramaPortada } from "../base/Efectos";
import { EsquinaOrnamental, DivisorFiligrana, inicialesDe } from "../base/Ornamentos";

/**
 * EDITORIAL LUXE
 * Portada a pantalla completa con fotografía al fondo, monograma
 * circular, marco de esquinas ornamentales y tipografía romana.
 * La más ceremoniosa del catálogo.
 */
export default function Editorial({
  datos,
  fotos,
  esBorrador,
}: {
  datos: DatosInvitacion;
  fotos: { nombre: string; url?: string }[];
  esBorrador?: boolean;
}) {
  const portada = fotos[0];
  const f = fechaLarga(datos.fechaEvento);
  const iniciales = (datos.monograma?.trim() || inicialesDe(datos.titulo)).slice(0, 7);

  return (
    <Marco datos={datos} esBorrador={esBorrador}>
      <header className="relative min-h-[100dvh] flex flex-col items-center justify-center text-center px-6 py-20 overflow-hidden">
        {/* Fotografía de fondo */}
        {portada?.url && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={portada.url}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
              style={{ opacity: 0.32 }}
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(to bottom, var(--inv-fondo) 0%, transparent 35%, transparent 60%, var(--inv-fondo) 100%)",
              }}
            />
          </>
        )}

        {/* Marco de esquinas */}
        <div className="absolute inset-5 sm:inset-8 pointer-events-none" style={{ color: "var(--inv-acento)" }}>
          <div className="absolute top-0 left-0"><EsquinaOrnamental /></div>
          <div className="absolute top-0 right-0 rotate-90"><EsquinaOrnamental /></div>
          <div className="absolute bottom-0 right-0 rotate-180"><EsquinaOrnamental /></div>
          <div className="absolute bottom-0 left-0 -rotate-90"><EsquinaOrnamental /></div>
          <div
            className="absolute inset-6 sm:inset-8"
            style={{ border: "1px solid color-mix(in srgb, var(--inv-acento) 22%, transparent)" }}
          />
        </div>

        <div className="relative z-10 max-w-2xl mx-auto">
          <Revelar desde="escala">
            <div className="flex justify-center mb-8">
              <MonogramaPortada iniciales={iniciales} />
            </div>
          </Revelar>

          {datos.subtitulo && (
            <Revelar retraso={150}>
              <p
                className="text-[10px] sm:text-[11px] uppercase tracking-[0.55em] mb-7"
                style={{ color: "var(--inv-acento)" }}
              >
                {datos.subtitulo}
              </p>
            </Revelar>
          )}

          <Revelar retraso={250}>
            <h1
              className="text-5xl sm:text-7xl leading-[1.08] mb-8"
              style={{ fontFamily: "var(--inv-display)", color: "var(--inv-texto)" }}
            >
              {datos.titulo}
            </h1>
          </Revelar>

          <Revelar retraso={380}>
            <div className="flex justify-center mb-8" style={{ color: "var(--inv-acento)" }}>
              <DivisorFiligrana />
            </div>
          </Revelar>

          {datos.frase && (
            <Revelar retraso={450}>
              <p
                className="text-xl sm:text-2xl mb-9 px-4 leading-relaxed"
                style={{ fontFamily: "var(--inv-script)", color: "var(--inv-texto-suave)" }}
              >
                {datos.frase}
              </p>
            </Revelar>
          )}

          {f && (
            <Revelar retraso={550}>
              <p
                className="text-[11px] sm:text-xs uppercase tracking-[0.42em] leading-loose"
                style={{ color: "var(--inv-texto)" }}
              >
                {f}
                {datos.horaEvento && (
                  <>
                    <br />
                    <span style={{ color: "var(--inv-acento)" }}>{hora12(datos.horaEvento)}</span>
                  </>
                )}
              </p>
            </Revelar>
          )}
        </div>

        {/* Indicador de desplazamiento */}
        <div className="absolute bottom-9 left-1/2 -translate-x-1/2 z-10 animate-bounce" style={{ color: "var(--inv-acento)" }}>
          <svg width="20" height="30" viewBox="0 0 20 30" fill="none" aria-hidden>
            <rect x="1" y="1" width="18" height="28" rx="9" stroke="currentColor" strokeWidth="1" opacity=".5" />
            <circle cx="10" cy="9" r="2.5" fill="currentColor" />
          </svg>
        </div>
      </header>

      <CuerpoEstandar datos={datos} fotos={fotos} variante="editorial" estiloContador="tarjetas" />
    </Marco>
  );
}
