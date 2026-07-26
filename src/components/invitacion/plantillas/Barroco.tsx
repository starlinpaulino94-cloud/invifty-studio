"use client";

import type { DatosInvitacion, FotoInvitacion } from "@/lib/tipos";
import Marco, { fechaLarga, hora12 } from "../base/Marco";
import { CuerpoEstandar } from "../base/Secciones";
import { Revelar } from "../base/Efectos";
import { Cartucho, Voluta, DivisorBarroco, inicialesDe } from "../base/Ornamentos";
import Texto from "../base/Texto";
import MedioPortada from "../base/MedioPortada";

/**
 * BARROCO
 * Filigrana densa y simetría estricta: el monograma dentro de un cartucho
 * ovalado, volutas de acanto en las cuatro esquinas y un doble marco que
 * encierra toda la portada. La más recargada del catálogo por estructura,
 * no por añadidos.
 *
 * Frente a Editorial —que respira— y a Art Déco —geometría de los años
 * 20—, aquí el ornamento es curvo, continuo y cubre los bordes.
 */
export default function Barroco({
  datos,
  fotos,
  esBorrador,
}: {
  datos: DatosInvitacion;
  fotos: FotoInvitacion[];
  esBorrador?: boolean;
}) {
  const portada = fotos[0];
  const f = fechaLarga(datos.fechaEvento);
  const iniciales = (datos.monograma?.trim() || inicialesDe(datos.titulo)).slice(0, 7);

  return (
    <Marco datos={datos} esBorrador={esBorrador}>
      <header className="relative min-h-[100dvh] flex flex-col items-center justify-center text-center px-7 py-16 overflow-hidden">
        {/* Fotografía al fondo, muy velada: el protagonista es el ornamento */}
        {portada?.url && (
          <>
            <MedioPortada medio={portada} className="absolute inset-0 w-full h-full object-cover" style={{ opacity: 0.2 }} />
            <div
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(ellipse at center, transparent 25%, var(--inv-fondo) 82%)",
              }}
            />
          </>
        )}

        {/* Doble marco */}
        <div className="absolute inset-4 sm:inset-7 pointer-events-none">
          <div
            className="absolute inset-0"
            style={{ border: "2px solid color-mix(in srgb, var(--inv-acento) 45%, transparent)" }}
          />
          <div
            className="absolute inset-[7px]"
            style={{ border: "1px solid color-mix(in srgb, var(--inv-acento) 25%, transparent)" }}
          />
        </div>

        {/* Volutas de acanto en las cuatro esquinas */}
        <div className="absolute inset-3 sm:inset-6 pointer-events-none" style={{ color: "var(--inv-acento)" }}>
          <Voluta className="absolute top-0 left-0 w-20 sm:w-28 opacity-70" />
          <Voluta className="absolute top-0 right-0 w-20 sm:w-28 opacity-70 scale-x-[-1]" />
          <Voluta className="absolute bottom-0 left-0 w-20 sm:w-28 opacity-70 scale-y-[-1]" />
          <Voluta className="absolute bottom-0 right-0 w-20 sm:w-28 opacity-70 scale-[-1]" />
        </div>

        <div className="relative z-10 max-w-xl mx-auto">
          {/* Monograma dentro del cartucho */}
          <Revelar desde="escala">
            <div className="relative flex justify-center mb-6" style={{ color: "var(--inv-acento)" }}>
              <Cartucho className="w-40 sm:w-48" />
              <span
                className="absolute inset-0 flex items-center justify-center text-xl sm:text-2xl tracking-[0.12em]"
                style={{ fontFamily: "var(--inv-display)", color: "var(--inv-texto)" }}
              >
                {iniciales}
              </span>
            </div>
          </Revelar>

          {datos.subtitulo && (
            <Revelar retraso={160}>
              <p
                className="text-[10px] sm:text-[11px] uppercase tracking-[0.6em] mb-6"
                style={{ color: "var(--inv-acento)" }}
              >
                <Texto ruta="subtitulo">{datos.subtitulo}</Texto>
              </p>
            </Revelar>
          )}

          <Revelar retraso={260}>
            <h1
              className="text-4xl sm:text-6xl leading-[1.12] mb-6"
              style={{ fontFamily: "var(--inv-display)", color: "var(--inv-texto)" }}
            >
              <Texto ruta="titulo">{datos.titulo}</Texto>
            </h1>
          </Revelar>

          <Revelar retraso={360}>
            <div className="flex justify-center mb-7" style={{ color: "var(--inv-acento)" }}>
              <DivisorBarroco className="w-52 sm:w-64" />
            </div>
          </Revelar>

          {datos.frase && (
            <Revelar retraso={440}>
              <p
                className="text-xl sm:text-3xl mb-8 px-3 leading-relaxed"
                style={{ fontFamily: "var(--inv-script)", color: "var(--inv-texto-suave)" }}
              >
                <Texto ruta="frase">{datos.frase}</Texto>
              </p>
            </Revelar>
          )}

          {f && (
            <Revelar retraso={540}>
              <p
                className="text-[11px] sm:text-xs uppercase tracking-[0.45em] leading-loose"
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
      </header>

      <CuerpoEstandar
        datos={datos}
        fotos={fotos}
        variante="barroco"
        estiloContador="tarjetas"
        disposicionGaleria="rejilla"
      />
    </Marco>
  );
}
