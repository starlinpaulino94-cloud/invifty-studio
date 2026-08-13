"use client";

import { ReactNode } from "react";
import type { DatosInvitacion, DensidadOrnamental, FotoInvitacion } from "@/lib/tipos";
import { esVideo } from "@/lib/fotos";
import { Divisor } from "./Ornamentos";
import Texto from "./Texto";
import { Guirnalda, SeparadorFloral } from "./OrnamentosFlorales";
import { Revelar } from "./Efectos";
import { Contador, BotonesMapa, BotonCalendario, CopiarDetalle, Galeria, Rsvp } from "./Piezas";
import { etiquetaDressCode, hora12 } from "./Marco";
import { Clock, Gift, Heart, MapPin, Shirt, Sparkles, Users, Info, Camera } from "lucide-react";

type Foto = FotoInvitacion;

/* ============================================================
   Encabezado de sección (con ornamento según la plantilla)
   ============================================================ */

export function TituloSeccion({
  titulo,
  icono,
  variante,
  centrado = true,
  densidad,
}: {
  titulo: string;
  icono?: ReactNode;
  variante: string;
  centrado?: boolean;
  /** Cuánto adorno lleva la invitación (ver config/diseno.ts). */
  densidad?: DensidadOrnamental;
}) {
  const nivel = densidad ?? "equilibrado";
  const esSobrio = nivel === "sobrio";
  const esExtravagante = nivel === "extravagante";

  return (
    <div className={`mb-8 ${centrado ? "text-center" : ""}`}>
      {/* En las invitaciones recargadas, una guirnalda corona el título */}
      {esExtravagante && centrado && (
        <div className="flex justify-center mb-2" style={{ color: "var(--inv-acento)" }}>
          <Guirnalda className="w-44 sm:w-56 opacity-60" />
        </div>
      )}

      {/* El icono en círculo es un detalle: sobra en las sobrias */}
      {icono && !esSobrio && (
        <span
          className="inline-flex items-center justify-center w-10 h-10 rounded-full mb-4"
          style={{ border: "1px solid var(--inv-linea)", color: "var(--inv-acento)" }}
        >
          {icono}
        </span>
      )}

      <h2
        className="text-2xl sm:text-4xl"
        style={{ fontFamily: "var(--inv-display)", color: "var(--inv-texto)" }}
      >
        {titulo}
      </h2>

      {centrado && !esSobrio && (
        <div className="flex justify-center mt-3" style={{ color: "var(--inv-acento)" }}>
          {esExtravagante ? (
            <SeparadorFloral className="w-32 sm:w-40" />
          ) : (
            <Divisor variante={variante} />
          )}
        </div>
      )}
    </div>
  );
}

export function Seccion({
  children,
  className = "",
  campo,
}: {
  children: ReactNode;
  className?: string;
  /**
   * Qué parte del editor controla esta sección. Solo se usa en la vista
   * previa del panel: al señalar un bloque, el editor salta a su tarjeta.
   * Marcarlo aquí cubre las diez plantillas de una vez, porque todas
   * componen su cuerpo con estos mismos bloques.
   */
  campo?: string;
}) {
  return (
    <section className={`px-5 py-14 sm:py-16 ${className}`} data-campo={campo}>
      {children}
    </section>
  );
}

/* ============================================================
   Bloques de contenido
   ============================================================ */

export function BloqueContador({
  datos,
  estiloContador = "tarjetas",
}: {
  datos: DatosInvitacion;
  estiloContador?: "tarjetas" | "lineal" | "circulos";
}) {
  if (!datos.fechaEvento) return null;
  return (
    <Revelar>
      <div className="max-w-2xl mx-auto text-center">
        <p
          className="text-[10px] uppercase tracking-[0.4em] mb-6"
          style={{ color: "var(--inv-texto-suave)" }}
        >
          Falta poco para el gran día
        </p>
        <Contador fecha={datos.fechaEvento} hora={datos.horaEvento} variante={estiloContador} />
        <div className="mt-7">
          <BotonCalendario
            titulo={datos.titulo}
            fecha={datos.fechaEvento}
            hora={datos.horaEvento}
            lugar={datos.lugares[0]?.detalle ?? ""}
          />
        </div>
      </div>
    </Revelar>
  );
}

export function BloqueHistoria({ datos, variante }: { datos: DatosInvitacion; variante: string }) {
  if (!datos.secciones.historia || !datos.historia) return null;
  return (
    <Seccion campo="historia">
      <div className="max-w-xl mx-auto">
        <Revelar>
          <TituloSeccion titulo="Nuestra Historia" icono={<Heart className="w-4 h-4" />} variante={variante} densidad={datos.densidad} />
        </Revelar>
        <Revelar retraso={120}>
          <p
            className="text-center leading-loose whitespace-pre-line text-[15px]"
            style={{ color: "var(--inv-texto-suave)", fontFamily: "var(--inv-cuerpo)" }}
          >
            <Texto ruta="historia">{datos.historia}</Texto>
          </p>
        </Revelar>
      </div>
    </Seccion>
  );
}

export function BloqueLugares({
  datos,
  variante,
  columnas = true,
}: {
  datos: DatosInvitacion;
  variante: string;
  columnas?: boolean;
}) {
  if (!datos.lugares.length) return null;
  return (
    <Seccion campo="lugares">
      <div className="max-w-3xl mx-auto">
        <Revelar>
          <TituloSeccion titulo="Dónde y cuándo" icono={<MapPin className="w-4 h-4" />} variante={variante} densidad={datos.densidad} />
        </Revelar>

        <div className={columnas && datos.lugares.length > 1 ? "grid sm:grid-cols-2 gap-5" : "space-y-5 max-w-lg mx-auto"}>
          {datos.lugares.map((lugar, i) => (
            <Revelar key={i} retraso={i * 140} desde={i % 2 ? "derecha" : "izquierda"}>
              <div
                className="rounded-lg p-7 text-center h-full flex flex-col justify-between"
                style={{ backgroundColor: "var(--inv-tarjeta)", border: "1px solid var(--inv-linea)" }}
              >
                <div>
                  <p
                    className="text-[10px] uppercase tracking-[0.35em] mb-3"
                    style={{ color: "var(--inv-acento)" }}
                  >
                    <Texto ruta={`lugares.${i}.nombre`}>{lugar.nombre}</Texto>
                  </p>
                  <p
                    className="text-lg mb-1"
                    style={{ fontFamily: "var(--inv-display)", color: "var(--inv-texto)" }}
                  >
                    {lugar.detalle.split(/[,\n]/)[0]}
                  </p>
                  <p className="text-xs whitespace-pre-line mb-5" style={{ color: "var(--inv-texto-suave)" }}>
                    {lugar.detalle.split(/[,\n]/).slice(1).join(", ").trim()}
                  </p>
                </div>
                <BotonesMapa direccion={lugar.detalle} />
              </div>
            </Revelar>
          ))}
        </div>

        {datos.horaEvento && (
          <Revelar retraso={200}>
            <p
              className="text-center text-xs uppercase tracking-[0.3em] mt-7"
              style={{ color: "var(--inv-texto-suave)" }}
            >
              A las <strong style={{ color: "var(--inv-acento)" }}>{hora12(datos.horaEvento)}</strong>
            </p>
          </Revelar>
        )}
      </div>
    </Seccion>
  );
}

export function BloqueDressCode({ datos, variante }: { datos: DatosInvitacion; variante: string }) {
  if (!datos.dressCode) return null;
  return (
    <Seccion campo="dresscode">
      <Revelar>
        <div className="max-w-md mx-auto text-center">
          <TituloSeccion titulo="Código de vestimenta" icono={<Shirt className="w-4 h-4" />} variante={variante} densidad={datos.densidad} />
          <p
            className="text-2xl sm:text-3xl"
            style={{ fontFamily: "var(--inv-script)", color: "var(--inv-acento)" }}
          >
            {etiquetaDressCode(datos.dressCode)}
          </p>
        </div>
      </Revelar>
    </Seccion>
  );
}

export function BloqueCronograma({ datos, variante }: { datos: DatosInvitacion; variante: string }) {
  if (!datos.secciones.cronograma || !datos.cronograma.length) return null;
  return (
    <Seccion campo="cronograma">
      <div className="max-w-lg mx-auto">
        <Revelar>
          <TituloSeccion titulo="Programa del día" icono={<Clock className="w-4 h-4" />} variante={variante} densidad={datos.densidad} />
        </Revelar>

        <div className="relative">
          {/* Línea vertical */}
          <div
            className="absolute left-[7px] top-2 bottom-2 w-px"
            style={{ backgroundColor: "var(--inv-linea)" }}
          />
          {datos.cronograma.map((hito, i) => (
            <Revelar key={i} retraso={i * 110} desde="derecha">
              <div className="flex gap-6 pb-8 last:pb-0 relative">
                <span
                  className="w-4 h-4 rounded-full shrink-0 mt-1 z-10"
                  style={{
                    backgroundColor: "var(--inv-fondo)",
                    border: "2px solid var(--inv-acento)",
                  }}
                />
                <div className="-mt-0.5">
                  <p
                    className="text-sm tracking-[0.2em] mb-1"
                    style={{ color: "var(--inv-acento)", fontFamily: "var(--inv-display)" }}
                  >
                    {hora12(hito.hora)}
                  </p>
                  <p className="text-[15px]" style={{ color: "var(--inv-texto)" }}>
                    <Texto ruta={`cronograma.${i}.actividad`}>{hito.actividad}</Texto>
                  </p>
                </div>
              </div>
            </Revelar>
          ))}
        </div>
      </div>
    </Seccion>
  );
}

export function BloquePadrinos({ datos, variante }: { datos: DatosInvitacion; variante: string }) {
  const lista = datos.padrinos ?? [];
  if (!datos.secciones.padrinos || !lista.length) return null;
  return (
    <Seccion campo="padrinos">
      <div className="max-w-2xl mx-auto">
        <Revelar>
          <TituloSeccion titulo="Personas especiales" icono={<Users className="w-4 h-4" />} variante={variante} densidad={datos.densidad} />
        </Revelar>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
          {lista.map((p, i) => (
            <Revelar key={i} retraso={i * 90} desde="escala">
              <div className="text-center">
                <p
                  className="text-[9px] uppercase tracking-[0.3em] mb-1.5"
                  style={{ color: "var(--inv-acento)" }}
                >
                  <Texto ruta={`padrinos.${i}.rol`}>{p.rol}</Texto>
                </p>
                <p className="text-base" style={{ fontFamily: "var(--inv-display)", color: "var(--inv-texto)" }}>
                  <Texto ruta={`padrinos.${i}.nombre`}>{p.nombre}</Texto>
                </p>
              </div>
            </Revelar>
          ))}
        </div>
      </div>
    </Seccion>
  );
}

export function BloqueGaleria({
  datos,
  fotos,
  variante,
  disposicion = "mosaico",
}: {
  datos: DatosInvitacion;
  fotos: Foto[];
  variante: string;
  disposicion?: "mosaico" | "rejilla" | "tira";
}) {
  // El video va de portada, no en la cuadrícula: ahí abriría el visor de
  // fotos con un archivo que no es una foto.
  const soloFotos = fotos.filter((f) => !esVideo(f.nombre));
  if (!datos.secciones.galeria || soloFotos.length < 2) return null;
  return (
    <Seccion campo="galeria">
      <div className="max-w-3xl mx-auto">
        <Revelar>
          <TituloSeccion titulo="Galería" icono={<Camera className="w-4 h-4" />} variante={variante} densidad={datos.densidad} />
        </Revelar>
        <Revelar retraso={100}>
          <Galeria fotos={soloFotos} disposicion={disposicion} />
        </Revelar>
        <p className="text-center text-[10px] mt-4" style={{ color: "var(--inv-texto-suave)" }}>
          Toca cualquier fotografía para ampliarla
        </p>
      </div>
    </Seccion>
  );
}

export function BloqueRegalos({ datos, variante }: { datos: DatosInvitacion; variante: string }) {
  if (!datos.secciones.regalos || !datos.regalos.length) return null;
  return (
    <Seccion campo="regalos">
      <div className="max-w-lg mx-auto">
        <Revelar>
          <TituloSeccion titulo="Mesa de regalos" icono={<Gift className="w-4 h-4" />} variante={variante} densidad={datos.densidad} />
        </Revelar>
        <Revelar retraso={100}>
          <p className="text-center text-sm mb-7 leading-relaxed" style={{ color: "var(--inv-texto-suave)" }}>
            Tu presencia es el mejor regalo. Si además deseas obsequiarnos algo,
            aquí tienes algunas opciones.
          </p>
        </Revelar>
        <div className="space-y-3">
          {datos.regalos.map((regalo, i) => (
            <Revelar key={i} retraso={i * 100}>
              <div
                className="rounded-lg p-5 flex items-center justify-between gap-4"
                style={{ backgroundColor: "var(--inv-tarjeta)", border: "1px solid var(--inv-linea)" }}
              >
                <div className="min-w-0">
                  <p className="text-sm mb-0.5" style={{ color: "var(--inv-texto)" }}><Texto ruta={`regalos.${i}.titulo`}>{regalo.titulo}</Texto></p>
                  <p className="text-xs break-all" style={{ color: "var(--inv-texto-suave)" }}>
                    <Texto ruta={`regalos.${i}.detalle`}>{regalo.detalle}</Texto>
                  </p>
                </div>
                <CopiarDetalle detalle={regalo.detalle} />
              </div>
            </Revelar>
          ))}
        </div>
      </div>
    </Seccion>
  );
}

export function BloqueNotas({ datos, variante }: { datos: DatosInvitacion; variante: string }) {
  const lista = datos.notas ?? [];
  if (!datos.secciones.notas || !lista.length) return null;
  return (
    <Seccion campo="notas">
      <div className="max-w-2xl mx-auto">
        <Revelar>
          <TituloSeccion titulo="Detalles a tener en cuenta" icono={<Info className="w-4 h-4" />} variante={variante} densidad={datos.densidad} />
        </Revelar>
        <div className="grid sm:grid-cols-2 gap-4">
          {lista.map((nota, i) => (
            <Revelar key={i} retraso={i * 100}>
              <div
                className="rounded-lg p-5 h-full"
                style={{ backgroundColor: "var(--inv-tarjeta)", border: "1px solid var(--inv-linea)" }}
              >
                <p
                  className="text-[10px] uppercase tracking-[0.28em] mb-2"
                  style={{ color: "var(--inv-acento)" }}
                >
                  <Texto ruta={`notas.${i}.titulo`}>{nota.titulo}</Texto>
                </p>
                <p className="text-sm leading-relaxed" style={{ color: "var(--inv-texto-suave)" }}>
                  <Texto ruta={`notas.${i}.texto`}>{nota.texto}</Texto>
                </p>
              </div>
            </Revelar>
          ))}
        </div>
      </div>
    </Seccion>
  );
}

export function BloqueRsvp({ datos, variante }: { datos: DatosInvitacion; variante: string }) {
  if (!datos.secciones.rsvp || !datos.rsvp.whatsapp) return null;
  return (
    <Seccion campo="rsvp">
      <div className="max-w-md mx-auto">
        <Revelar>
          <TituloSeccion titulo="Confirma tu asistencia" icono={<Sparkles className="w-4 h-4" />} variante={variante} densidad={datos.densidad} />
        </Revelar>
        <Revelar retraso={100}>
          <Rsvp
            titulo={datos.titulo}
            whatsapp={datos.rsvp.whatsapp}
            fechaLimite={datos.rsvp.fechaLimite}
            acompanantes={datos.rsvp.acompanantes}
            preguntas={datos.rsvp.preguntas}
          />
        </Revelar>
      </div>
    </Seccion>
  );
}

export function BloqueMensajeFinal({ datos }: { datos: DatosInvitacion }) {
  if (!datos.mensajeFinal) return null;
  return (
    <Seccion className="pt-4" campo="cierre">
      <Revelar>
        <p
          className="max-w-lg mx-auto text-center text-2xl sm:text-3xl leading-snug"
          style={{ fontFamily: "var(--inv-script)", color: "var(--inv-acento)" }}
        >
          <Texto ruta="mensajeFinal">{datos.mensajeFinal}</Texto>
        </p>
      </Revelar>
    </Seccion>
  );
}

/** Cuerpo estándar: el orden que usan casi todas las plantillas. */
export function CuerpoEstandar({
  datos,
  fotos,
  variante,
  disposicionGaleria = "mosaico",
  estiloContador = "tarjetas",
}: {
  datos: DatosInvitacion;
  fotos: Foto[];
  variante: string;
  disposicionGaleria?: "mosaico" | "rejilla" | "tira";
  estiloContador?: "tarjetas" | "lineal" | "circulos";
}) {
  return (
    <main className="relative z-10">
      {/* La cuenta regresiva se alimenta de la fecha y la hora, que se
          editan en la tarjeta "Portada". */}
      <Seccion className="pb-4" campo="portada">
        <BloqueContador datos={datos} estiloContador={estiloContador} />
      </Seccion>
      <BloqueHistoria datos={datos} variante={variante} />
      <BloqueLugares datos={datos} variante={variante} />
      <BloqueDressCode datos={datos} variante={variante} />
      <BloqueCronograma datos={datos} variante={variante} />
      <BloquePadrinos datos={datos} variante={variante} />
      <BloqueGaleria datos={datos} fotos={fotos} variante={variante} disposicion={disposicionGaleria} />
      <BloqueRegalos datos={datos} variante={variante} />
      <BloqueNotas datos={datos} variante={variante} />
      <BloqueRsvp datos={datos} variante={variante} />
      <BloqueMensajeFinal datos={datos} />
    </main>
  );
}
