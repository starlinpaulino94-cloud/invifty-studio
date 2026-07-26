"use client";

import { DatosInvitacion } from "@/lib/tipos";
import Marco, { fechaCorta, hora12 } from "../base/Marco";
import { CuerpoEstandar } from "../base/Secciones";
import { Revelar } from "../base/Efectos";
import { ManchasAcuarela, DivisorPincel } from "../base/Ornamentos";
import Texto from "../base/Texto";
import MedioPortada from "../base/MedioPortada";

/**
 * ACUARELA
 * Manchas de color difuminadas como una aguada de acuarela, con la
 * fotografía en un óvalo suave y tipografía delicada. Dulce y artesanal.
 */
export default function Acuarela({
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
      <header className="relative min-h-[100dvh] flex flex-col items-center justify-center text-center px-7 py-16 overflow-hidden">
        {/* Aguadas de color */}
        <div className="absolute inset-0 pointer-events-none" style={{ color: "var(--inv-acento)" }}>
          <ManchasAcuarela />
        </div>

        <div className="relative z-10 w-full max-w-md">
          {/* Fotografía en óvalo */}
          {portada?.url && (
            <Revelar desde="escala">
              <div
                className="w-44 h-56 sm:w-52 sm:h-64 mx-auto mb-10 overflow-hidden"
                style={{
                  borderRadius: "50%",
                  border: "3px solid var(--inv-tarjeta)",
                  boxShadow: "0 18px 45px -20px rgba(0,0,0,.4)",
                }}
              >
                <MedioPortada medio={portada} className="w-full h-full object-cover" />
              </div>
            </Revelar>
          )}

          {datos.subtitulo && (
            <Revelar retraso={120}>
              <p
                className="text-2xl sm:text-3xl mb-2"
                style={{ fontFamily: "var(--inv-script)", color: "var(--inv-acento)" }}
              >
                <Texto ruta="subtitulo">{datos.subtitulo}</Texto>
              </p>
            </Revelar>
          )}

          <Revelar retraso={200}>
            <h1
              className="text-4xl sm:text-5xl leading-tight mb-5"
              style={{ fontFamily: "var(--inv-display)", color: "var(--inv-texto)" }}
            >
              <Texto ruta="titulo">{datos.titulo}</Texto>
            </h1>
          </Revelar>

          <Revelar retraso={300}>
            <div className="flex justify-center mb-6" style={{ color: "var(--inv-acento)" }}>
              <DivisorPincel />
            </div>
          </Revelar>

          {datos.fechaEvento && (
            <Revelar retraso={380}>
              <div
                className="inline-block px-8 py-4 rounded-3xl"
                style={{
                  backgroundColor: "color-mix(in srgb, var(--inv-tarjeta) 82%, transparent)",
                  border: "1px solid var(--inv-linea)",
                }}
              >
                <p className="text-[10px] uppercase tracking-[0.32em]" style={{ color: "var(--inv-texto-suave)" }}>
                  {fc.diaSemana}
                </p>
                <p
                  className="text-3xl my-1"
                  style={{ fontFamily: "var(--inv-display)", color: "var(--inv-acento)" }}
                >
                  {fc.dia} de {fc.mes}
                </p>
                <p className="text-[10px] uppercase tracking-[0.32em]" style={{ color: "var(--inv-texto-suave)" }}>
                  {fc.anio}
                  {datos.horaEvento && ` · ${hora12(datos.horaEvento)}`}
                </p>
              </div>
            </Revelar>
          )}

          {datos.frase && (
            <Revelar retraso={470}>
              <p
                className="text-base sm:text-lg mt-8 leading-relaxed px-3"
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
        variante="acuarela"
        estiloContador="circulos"
        disposicionGaleria="mosaico"
      />
    </Marco>
  );
}
