"use client";

import { DatosInvitacion } from "@/lib/tipos";
import Marco, { fechaLarga, hora12 } from "../base/Marco";
import { CuerpoEstandar } from "../base/Secciones";
import { Revelar } from "../base/Efectos";
import { CieloEstrellado, Luna, DivisorEstrella, inicialesDe } from "../base/Ornamentos";
import Texto from "../base/Texto";
import MedioPortada from "../base/MedioPortada";

/**
 * CELESTIAL
 * Cielo nocturno con estrellas, luna creciente y una constelación que
 * enmarca el monograma. Pensada para celebraciones de noche.
 */
export default function Celestial({
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
      <header className="relative min-h-[100dvh] flex flex-col items-center justify-center text-center px-6 py-20 overflow-hidden">
        {/* Fotografía tenue al fondo */}
        {portada?.url && (
          <>
            <MedioPortada medio={portada} className="absolute inset-0 w-full h-full object-cover" style={{ opacity: 0.2 }} />
            <div
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(ellipse at 50% 35%, transparent 20%, var(--inv-fondo) 78%)",
              }}
            />
          </>
        )}

        {/* Estrellas */}
        <div className="absolute inset-0 pointer-events-none" style={{ color: "var(--inv-acento-claro)" }}>
          <CieloEstrellado cantidad={90} />
        </div>

        {/* Luna */}
        <div
          className="absolute top-[12%] right-[10%] pointer-events-none"
          style={{ color: "var(--inv-acento)" }}
        >
          <Luna className="w-16 h-16 sm:w-24 sm:h-24 opacity-80" />
        </div>

        <div className="relative z-10 max-w-xl">
          {/* Monograma entre constelaciones */}
          <Revelar desde="escala">
            <div className="flex items-center justify-center gap-4 mb-9">
              <span className="h-px w-14 sm:w-20" style={{ backgroundColor: "var(--inv-linea)" }} />
              <span
                className="w-16 h-16 rounded-full flex items-center justify-center text-lg tracking-[0.15em]"
                style={{
                  border: "1px solid var(--inv-acento)",
                  color: "var(--inv-acento)",
                  fontFamily: "var(--inv-display)",
                  boxShadow: "0 0 30px -8px var(--inv-acento)",
                }}
              >
                {iniciales}
              </span>
              <span className="h-px w-14 sm:w-20" style={{ backgroundColor: "var(--inv-linea)" }} />
            </div>
          </Revelar>

          {datos.subtitulo && (
            <Revelar retraso={140}>
              <p
                className="text-[10px] uppercase tracking-[0.5em] mb-6"
                style={{ color: "var(--inv-acento)" }}
              >
                <Texto ruta="subtitulo">{datos.subtitulo}</Texto>
              </p>
            </Revelar>
          )}

          <Revelar retraso={220}>
            <h1
              className="text-5xl sm:text-7xl leading-[1.08] mb-7 font-light"
              style={{ fontFamily: "var(--inv-display)", color: "var(--inv-texto)" }}
            >
              <Texto ruta="titulo">{datos.titulo}</Texto>
            </h1>
          </Revelar>

          <Revelar retraso={330}>
            <div className="flex justify-center mb-7" style={{ color: "var(--inv-acento)" }}>
              <DivisorEstrella />
            </div>
          </Revelar>

          {datos.frase && (
            <Revelar retraso={400}>
              <p
                className="text-xl sm:text-2xl mb-8 leading-relaxed px-2"
                style={{ fontFamily: "var(--inv-script)", color: "var(--inv-texto-suave)" }}
              >
                <Texto ruta="frase">{datos.frase}</Texto>
              </p>
            </Revelar>
          )}

          {datos.fechaEvento && (
            <Revelar retraso={480}>
              <p
                className="text-[11px] uppercase tracking-[0.38em] leading-loose"
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
            </Revelar>
          )}
        </div>
      </header>

      <CuerpoEstandar
        datos={datos}
        fotos={fotos}
        variante="celestial"
        estiloContador="circulos"
        disposicionGaleria="rejilla"
      />
    </Marco>
  );
}
