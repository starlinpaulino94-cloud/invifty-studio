"use client";

import { ReactNode, useState } from "react";
import { DatosInvitacion, EFECTOS_POR_DEFECTO } from "@/lib/tipos";
import { paleta, variablesDeDiseno } from "@/config/diseno";
import { inicialesDe } from "./Ornamentos";
import { SobreApertura, TexturaPapel, Vineta, Musica, AvisoMusica } from "./Efectos";

/**
 * Marco común de todas las plantillas:
 * aplica los tokens de diseño, la apertura tipo sobre, la textura de
 * papel, la música y el pie de marca. Cada plantilla solo se ocupa de
 * su composición visual.
 */
export default function Marco({
  datos,
  esBorrador,
  children,
}: {
  datos: DatosInvitacion;
  esBorrador?: boolean;
  children: ReactNode;
}) {
  const efectos = { ...EFECTOS_POR_DEFECTO, ...(datos.efectos ?? {}) };
  const iniciales = (datos.monograma?.trim() || inicialesDe(datos.titulo)).slice(0, 7);
  const p = paleta(datos.paleta);

  const [abierta, setAbierta] = useState(!efectos.sobre);
  const conMusica = efectos.musica && !!datos.musicaUrl;

  return (
    <div
      className="min-h-dvh relative"
      style={{
        ...variablesDeDiseno(datos.paleta, datos.tipografia),
        backgroundColor: p.fondo,
        color: p.texto,
        fontFamily: "var(--inv-cuerpo)",
      }}
    >
      {esBorrador && (
        <div className="bg-amber-500 text-black text-center text-xs font-bold py-2 px-4 sticky top-0 z-[90] font-sans">
          ⚠ BORRADOR — Solo visible para el equipo Invifty. Publica la invitación para compartirla.
        </div>
      )}

      {!abierta && (
        <SobreApertura
          iniciales={iniciales}
          etiqueta={datos.subtitulo || "Estás invitado"}
          onAbrir={() => setAbierta(true)}
        />
      )}

      {efectos.textura && (
        <>
          <TexturaPapel intensidad={p.oscura ? 0.07 : 0.045} />
          <Vineta oscura={p.oscura} />
        </>
      )}

      {conMusica && (
        <>
          <Musica url={datos.musicaUrl!} autoIniciar={abierta && efectos.sobre} />
          {abierta && <AvisoMusica />}
        </>
      )}

      <div className={abierta ? "animate-aparecer" : "opacity-0"}>{children}</div>

      {/* Pie de marca */}
      <footer
        className="text-center py-12 px-6 relative z-10"
        style={{ borderTop: "1px solid var(--inv-linea)" }}
      >
        {datos.hashtag && (
          <p
            className="text-lg sm:text-xl mb-5"
            style={{ fontFamily: "var(--inv-script)", color: "var(--inv-acento)" }}
          >
            {datos.hashtag.startsWith("#") ? datos.hashtag : `#${datos.hashtag}`}
          </p>
        )}
        <p className="text-[9px] uppercase tracking-[0.4em] mb-1.5" style={{ color: "var(--inv-texto-suave)" }}>
          Invitación digital por
        </p>
        <a
          href="https://invifty.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm tracking-[0.35em] uppercase transition-opacity hover:opacity-70"
          style={{ fontFamily: "var(--inv-display)", color: "var(--inv-acento)" }}
        >
          Invifty
        </a>
      </footer>
    </div>
  );
}

/* ============================================================
   Utilidades de formato compartidas por las plantillas

   El formateo de fechas vive en lib/fechas.ts (módulo sin "use client")
   para que también lo puedan usar los metadatos y la tarjeta de vista
   previa, que se generan en el servidor. Se reexporta aquí para no
   cambiar los imports de las diez plantillas.
   ============================================================ */

export { fechaLarga, fechaCorta, hora12 } from "@/lib/fechas";

export function etiquetaDressCode(valor: string): string {
  const mapa: Record<string, string> = {
    formal: "Formal · Etiqueta",
    semiformal: "Semiformal",
    playa: "Playa · Lino",
    tematico: "Temático",
    libre: "Vestimenta libre",
  };
  return mapa[valor] ?? valor;
}
