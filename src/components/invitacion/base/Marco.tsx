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

   Formateamos las fechas a mano (sin toLocaleDateString) para que el
   servidor y el navegador produzcan exactamente el mismo texto, y para
   que el español sea siempre correcto sin depender de los datos de
   idioma que tenga instalado el servidor.
   ============================================================ */

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** Interpreta "YYYY-MM-DD" como fecha local, sin desfases de zona horaria. */
function partes(fecha: string): { d: number; m: number; a: number; diaSemana: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(fecha ?? "");
  if (!m) return null;
  const anio = Number(m[1]);
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  const referencia = new Date(Date.UTC(anio, mes - 1, dia));
  return { d: dia, m: mes - 1, a: anio, diaSemana: referencia.getUTCDay() };
}

export function fechaLarga(fecha: string): string {
  const p = partes(fecha);
  if (!p) return "";
  return `${DIAS[p.diaSemana]}, ${p.d} de ${MESES[p.m]} de ${p.a}`;
}

export function fechaCorta(fecha: string): { dia: string; mes: string; anio: string; diaSemana: string } {
  const p = partes(fecha);
  if (!p) return { dia: "", mes: "", anio: "", diaSemana: "" };
  return {
    dia: String(p.d).padStart(2, "0"),
    mes: MESES[p.m],
    anio: String(p.a),
    diaSemana: DIAS[p.diaSemana],
  };
}

export function hora12(hora: string): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(hora ?? "");
  if (!m) return hora ?? "";
  const h24 = Number(m[1]);
  const minutos = m[2];
  const sufijo = h24 >= 12 ? "p. m." : "a. m.";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${minutos} ${sufijo}`;
}

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
