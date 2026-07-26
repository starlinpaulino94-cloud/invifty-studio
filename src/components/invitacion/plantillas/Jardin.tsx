"use client";

import type { DatosInvitacion, FotoInvitacion } from "@/lib/tipos";
import Marco, { fechaLarga, hora12 } from "../base/Marco";
import { CuerpoEstandar } from "../base/Secciones";
import { Revelar } from "../base/Efectos";
import { inicialesDe } from "../base/Ornamentos";
import { Guirnalda, RamoEsquina, RamaLateral } from "../base/OrnamentosFlorales";

/**
 * JARDÍN ENCANTADO
 * La fotografía dentro de un óvalo, envuelta por guirnaldas arriba y abajo
 * y ramos que crecen desde las esquinas. Es la más botánica del catálogo:
 * el follaje forma parte de la estructura, no es un añadido.
 *
 * A diferencia de Botánica —donde las ramas enmarcan cada sección— aquí
 * todo converge sobre el retrato de la portada.
 */
export default function Jardin({
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
      <header className="relative min-h-[100dvh] flex flex-col items-center justify-center text-center px-6 py-16 overflow-hidden">
        {/* Ramos que crecen desde las esquinas superiores */}
        <div className="absolute inset-0 pointer-events-none" style={{ color: "var(--inv-acento)" }}>
          <RamoEsquina className="absolute -top-4 -left-6 w-40 sm:w-56 opacity-40" />
          <RamoEsquina className="absolute -top-4 -right-6 w-40 sm:w-56 opacity-40 scale-x-[-1]" />
          <RamaLateral className="hidden sm:block absolute bottom-0 left-2 w-20 opacity-25 scale-y-[-1]" />
          <RamaLateral className="hidden sm:block absolute bottom-0 right-2 w-20 opacity-25 scale-[-1]" />
        </div>

        <div className="relative z-10 max-w-lg mx-auto w-full">
          {datos.subtitulo && (
            <Revelar>
              <p
                className="text-[10px] uppercase tracking-[0.5em] mb-6"
                style={{ color: "var(--inv-acento)" }}
              >
                {datos.subtitulo}
              </p>
            </Revelar>
          )}

          {/* Retrato en óvalo, el corazón de la composición */}
          <Revelar desde="escala" retraso={100}>
            <div className="flex justify-center mb-7">
              <div
                className="relative w-44 h-56 sm:w-52 sm:h-64 overflow-hidden"
                style={{
                  borderRadius: "50% / 50%",
                  border: "1px solid var(--inv-acento)",
                  backgroundColor: "var(--inv-tarjeta)",
                }}
              >
                {portada?.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={portada.url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span
                    className="absolute inset-0 flex items-center justify-center text-3xl tracking-[0.15em]"
                    style={{ fontFamily: "var(--inv-display)", color: "var(--inv-acento)" }}
                  >
                    {iniciales}
                  </span>
                )}
              </div>
            </div>
          </Revelar>

          {/* Guirnalda que corona el nombre */}
          <Revelar retraso={220}>
            <div className="flex justify-center -mb-2" style={{ color: "var(--inv-acento)" }}>
              <Guirnalda className="w-52 sm:w-64 opacity-70" />
            </div>
          </Revelar>

          <Revelar retraso={300}>
            <h1
              className="text-4xl sm:text-6xl leading-[1.1] mb-5"
              style={{ fontFamily: "var(--inv-display)", color: "var(--inv-texto)" }}
            >
              {datos.titulo}
            </h1>
          </Revelar>

          {datos.frase && (
            <Revelar retraso={400}>
              <p
                className="text-xl sm:text-2xl mb-7 px-4 leading-relaxed"
                style={{ fontFamily: "var(--inv-script)", color: "var(--inv-texto-suave)" }}
              >
                {datos.frase}
              </p>
            </Revelar>
          )}

          {f && (
            <Revelar retraso={480}>
              {/* La fecha y la hora van en líneas separadas: juntas en una
                  sola no caben en un celular y la píldora parte fea. */}
              <div
                className="inline-block px-6 py-3 rounded-[28px]"
                style={{ border: "1px solid var(--inv-linea)" }}
              >
                <p
                  className="text-[10px] sm:text-[11px] uppercase tracking-[0.3em] sm:tracking-[0.35em]"
                  style={{ color: "var(--inv-texto)" }}
                >
                  {f}
                </p>
                {datos.horaEvento && (
                  <p
                    className="text-[10px] sm:text-[11px] uppercase tracking-[0.3em] mt-1.5"
                    style={{ color: "var(--inv-acento)" }}
                  >
                    {hora12(datos.horaEvento)}
                  </p>
                )}
              </div>
            </Revelar>
          )}

          {/* Guirnalda inferior, invertida, que cierra la composición */}
          <Revelar retraso={560}>
            <div className="flex justify-center mt-6" style={{ color: "var(--inv-acento)" }}>
              <Guirnalda className="w-40 sm:w-48 opacity-50 scale-y-[-1]" />
            </div>
          </Revelar>
        </div>
      </header>

      <CuerpoEstandar
        datos={datos}
        fotos={fotos}
        variante="jardin"
        estiloContador="circulos"
        disposicionGaleria="mosaico"
      />
    </Marco>
  );
}
