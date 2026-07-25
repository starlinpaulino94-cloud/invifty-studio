import { DatosInvitacion } from "@/lib/tipos";
import { PALETAS_INVITACION, PALETA_POR_DEFECTO } from "@/lib/invitacion";
import {
  CuentaRegresiva, RsvpInvitacion, CopiarDetalle, BotonCalendario,
} from "./Interactivos";
import { MapPin, Clock, Gift, Heart, CalendarDays, Shirt } from "lucide-react";

/**
 * Plantilla "Clásica" — la primera plantilla del motor de invitaciones.
 * Se adapta a cualquier tipo de evento mediante los datos y la paleta.
 * Para crear nuevas plantillas: duplicar este componente y registrarla
 * en el editor (src/app/panel/invitaciones/[id]).
 */
export default function PlantillaClasica({
  datos,
  fotos,
  esBorrador,
}: {
  datos: DatosInvitacion;
  fotos: { nombre: string; url?: string }[];
  esBorrador?: boolean;
}) {
  const paleta = PALETAS_INVITACION[datos.paleta] ?? PALETAS_INVITACION[PALETA_POR_DEFECTO];
  const portada = fotos[0];
  const galeria = fotos.slice(0, 12);

  const fechaLarga = datos.fechaEvento
    ? new Date(datos.fechaEvento + "T12:00:00").toLocaleDateString("es-DO", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

  const hora12 = datos.horaEvento
    ? new Date(`2000-01-01T${datos.horaEvento}:00`).toLocaleTimeString("es-DO", {
        hour: "numeric",
        minute: "2-digit",
      })
    : "";

  const estilo = {
    "--inv-fondo": paleta.fondo,
    "--inv-tarjeta": paleta.tarjeta,
    "--inv-acento": paleta.acento,
    "--inv-texto": paleta.texto,
    "--inv-texto-suave": paleta.textoSuave,
  } as React.CSSProperties;

  return (
    <div
      className="min-h-dvh font-serif"
      style={{ ...estilo, backgroundColor: paleta.fondo, color: paleta.texto }}
    >
      {esBorrador && (
        <div className="bg-amber-500 text-black text-center text-xs font-bold py-2 px-4 font-sans sticky top-0 z-50">
          ⚠ BORRADOR — Solo visible para el equipo Invifty. Publica la invitación para compartirla.
        </div>
      )}

      {/* ============ PORTADA ============ */}
      <header className="relative min-h-[92dvh] flex flex-col items-center justify-center text-center px-6 py-16 overflow-hidden">
        {portada?.url && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={portada.url}
              alt=""
              className="absolute inset-0 w-full h-full object-cover opacity-25"
            />
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(to bottom, ${paleta.fondo}cc, ${paleta.fondo}55 45%, ${paleta.fondo})`,
              }}
            />
          </>
        )}

        <div className="relative z-10 max-w-xl mx-auto">
          {datos.subtitulo && (
            <p
              className="text-[11px] uppercase tracking-[0.5em] font-sans font-semibold mb-6"
              style={{ color: paleta.acento }}
            >
              {datos.subtitulo}
            </p>
          )}

          <h1 className="text-5xl sm:text-7xl leading-tight mb-6">{datos.titulo}</h1>

          {datos.frase && (
            <p className="italic text-base sm:text-lg mb-8" style={{ color: paleta.textoSuave }}>
              “{datos.frase}”
            </p>
          )}

          {fechaLarga && (
            <p
              className="text-sm uppercase tracking-[0.3em] font-sans mb-10"
              style={{ color: paleta.texto }}
            >
              {fechaLarga}
              {hora12 && <span style={{ color: paleta.acento }}> · {hora12}</span>}
            </p>
          )}

          {datos.fechaEvento && (
            <CuentaRegresiva fecha={datos.fechaEvento} hora={datos.horaEvento} />
          )}

          {datos.fechaEvento && (
            <div className="mt-8">
              <BotonCalendario
                titulo={datos.titulo}
                fecha={datos.fechaEvento}
                hora={datos.horaEvento}
                lugar={datos.lugares[0]?.detalle ?? ""}
              />
            </div>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-5 pb-20 space-y-14 font-sans">
        {/* ============ HISTORIA ============ */}
        {datos.secciones.historia && datos.historia && (
          <Seccion icono={<Heart className="w-4 h-4" />} titulo="Nuestra Historia">
            <p
              className="text-sm leading-relaxed whitespace-pre-line text-center italic"
              style={{ color: "var(--inv-texto-suave)" }}
            >
              {datos.historia}
            </p>
          </Seccion>
        )}

        {/* ============ LUGARES ============ */}
        {datos.lugares.length > 0 && (
          <Seccion icono={<MapPin className="w-4 h-4" />} titulo="¿Dónde y cuándo?">
            <div className="grid sm:grid-cols-2 gap-4">
              {datos.lugares.map((lugar, i) => (
                <div
                  key={i}
                  className="rounded-2xl border p-6 text-center"
                  style={{
                    backgroundColor: "var(--inv-tarjeta)",
                    borderColor: "color-mix(in srgb, var(--inv-acento) 35%, transparent)",
                  }}
                >
                  <p
                    className="text-[10px] uppercase tracking-[0.3em] font-bold mb-2"
                    style={{ color: "var(--inv-acento)" }}
                  >
                    {lugar.nombre}
                  </p>
                  <p className="text-sm whitespace-pre-line mb-4">{lugar.detalle}</p>
                  <div className="flex items-center justify-center gap-4 text-xs font-semibold">
                    <a
                      href={`https://maps.google.com/?q=${encodeURIComponent(lugar.detalle)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-4"
                      style={{ color: "var(--inv-acento)" }}
                    >
                      Google Maps
                    </a>
                    <a
                      href={`https://waze.com/ul?q=${encodeURIComponent(lugar.detalle)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-4"
                      style={{ color: "var(--inv-acento)" }}
                    >
                      Waze
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </Seccion>
        )}

        {/* ============ DRESS CODE ============ */}
        {datos.dressCode && (
          <Seccion icono={<Shirt className="w-4 h-4" />} titulo="Código de Vestimenta">
            <p className="text-center text-lg font-serif capitalize">{formatearDressCode(datos.dressCode)}</p>
          </Seccion>
        )}

        {/* ============ CRONOGRAMA ============ */}
        {datos.secciones.cronograma && datos.cronograma.length > 0 && (
          <Seccion icono={<Clock className="w-4 h-4" />} titulo="Programa del Día">
            <div className="space-y-0">
              {datos.cronograma.map((hito, i) => (
                <div key={i} className="flex gap-5 items-start">
                  <div className="flex flex-col items-center">
                    <span
                      className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0"
                      style={{ backgroundColor: "var(--inv-acento)" }}
                    />
                    {i < datos.cronograma.length - 1 && (
                      <span
                        className="w-px flex-1 min-h-8"
                        style={{ backgroundColor: "color-mix(in srgb, var(--inv-acento) 35%, transparent)" }}
                      />
                    )}
                  </div>
                  <div className="pb-6">
                    <p className="text-xs font-bold" style={{ color: "var(--inv-acento)" }}>
                      {formatearHora(hito.hora)}
                    </p>
                    <p className="text-sm">{hito.actividad}</p>
                  </div>
                </div>
              ))}
            </div>
          </Seccion>
        )}

        {/* ============ GALERÍA ============ */}
        {datos.secciones.galeria && galeria.length > 1 && (
          <Seccion icono={<CalendarDays className="w-4 h-4" />} titulo="Galería">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {galeria.map((foto) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={foto.nombre}
                  src={foto.url}
                  alt=""
                  loading="lazy"
                  className="w-full aspect-square object-cover rounded-xl"
                />
              ))}
            </div>
          </Seccion>
        )}

        {/* ============ REGALOS ============ */}
        {datos.secciones.regalos && datos.regalos.length > 0 && (
          <Seccion icono={<Gift className="w-4 h-4" />} titulo="Mesa de Regalos">
            <p
              className="text-xs text-center italic mb-5"
              style={{ color: "var(--inv-texto-suave)" }}
            >
              Tu presencia es nuestro mejor regalo. Si deseas obsequiarnos algo más, aquí
              tienes algunas opciones:
            </p>
            <div className="space-y-3">
              {datos.regalos.map((regalo, i) => (
                <div
                  key={i}
                  className="rounded-2xl border p-5 flex items-center justify-between gap-4"
                  style={{
                    backgroundColor: "var(--inv-tarjeta)",
                    borderColor: "color-mix(in srgb, var(--inv-acento) 35%, transparent)",
                  }}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{regalo.titulo}</p>
                    <p className="text-xs break-all" style={{ color: "var(--inv-texto-suave)" }}>
                      {regalo.detalle}
                    </p>
                  </div>
                  <CopiarDetalle detalle={regalo.detalle} />
                </div>
              ))}
            </div>
          </Seccion>
        )}

        {/* ============ RSVP ============ */}
        {datos.secciones.rsvp && datos.rsvp.whatsapp && (
          <Seccion icono={<Heart className="w-4 h-4" />} titulo="Confirma tu Asistencia">
            <RsvpInvitacion
              titulo={datos.titulo}
              whatsapp={datos.rsvp.whatsapp}
              fechaLimite={datos.rsvp.fechaLimite}
              acompanantes={datos.rsvp.acompanantes}
            />
          </Seccion>
        )}
      </main>

      {/* ============ PIE ============ */}
      <footer
        className="text-center py-10 border-t font-sans"
        style={{ borderColor: "color-mix(in srgb, var(--inv-acento) 25%, transparent)" }}
      >
        <p className="text-[10px] uppercase tracking-[0.35em]" style={{ color: "var(--inv-texto-suave)" }}>
          Invitación digital por
        </p>
        <a
          href="https://invifty.com"
          target="_blank"
          rel="noopener noreferrer"
          className="font-serif text-sm tracking-[0.3em] uppercase"
          style={{ color: "var(--inv-acento)" }}
        >
          Invifty
        </a>
      </footer>
    </div>
  );
}

function Seccion({
  icono,
  titulo,
  children,
}: {
  icono: React.ReactNode;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="text-center mb-6">
        <span
          className="inline-flex items-center justify-center w-9 h-9 rounded-full border mb-3"
          style={{
            color: "var(--inv-acento)",
            borderColor: "color-mix(in srgb, var(--inv-acento) 45%, transparent)",
          }}
        >
          {icono}
        </span>
        <h2 className="font-serif text-2xl sm:text-3xl">{titulo}</h2>
      </div>
      {children}
    </section>
  );
}

function formatearDressCode(valor: string): string {
  const mapa: Record<string, string> = {
    formal: "Formal / Etiqueta",
    semiformal: "Semiformal",
    playa: "Playa / Lino",
    tematico: "Temático",
    libre: "Vestimenta libre",
  };
  return mapa[valor] ?? valor;
}

function formatearHora(hora: string): string {
  if (!hora) return "";
  try {
    return new Date(`2000-01-01T${hora}:00`).toLocaleTimeString("es-DO", {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return hora;
  }
}
