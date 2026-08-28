"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  UserCheck, UserX, Clock, Users, Loader2, Plus, X, Copy, Check, MessageCircle,
} from "lucide-react";
import { fechaLarga } from "@/lib/fechas";
import { normalizarNombre } from "@/lib/nombres";
import type { Cruce, InvitadoDeLista } from "@/lib/lista";
import Hogares, { type HogarDeLista } from "./Hogares";
import Recepcion, { type EntradaDeLista } from "./Recepcion";
import GaleriaAnfitrion from "./GaleriaAnfitrion";

/**
 * EL PANEL DEL ANFITRIÓN
 * =======================
 * Lo primero y más grande es el número de PERSONAS, no el de respuestas: es
 * el dato que le piden al anfitrión el salón y el catering, y contar
 * confirmaciones en vez de personas es justo el error que le haría quedarse
 * corto de sillas.
 *
 * Lo segundo en importancia es "sin responder", porque es lo único sobre lo
 * que puede actuar: a esos hay que perseguirlos. Por eso tiene botón para
 * copiar los nombres y salir a recordárselo por WhatsApp.
 */

type Grupo = "vienen" | "sinResponder" | "noVienen";

export default function PanelInvitados({
  token,
  titulo,
  fechaEvento,
  publicada,
  invitados,
  cruce,
  slug,
  hogares,
  entradas,
  confirmadosPorHogar,
  respuestasPorInvitado = {},
  etiquetasRsvp = {},
  galeria = null,
}: {
  token: string;
  titulo: string;
  fechaEvento: string | null;
  publicada: boolean;
  invitados: InvitadoDeLista[];
  cruce: Cruce;
  slug: string;
  hogares: HogarDeLista[];
  entradas: EntradaDeLista[];
  confirmadosPorHogar: Record<string, number>;
  /** Respuestas a las preguntas extra, por nombre normalizado. */
  respuestasPorInvitado?: Record<string, Record<string, string>>;
  /** Texto de cada pregunta extra, por id. */
  etiquetasRsvp?: Record<string, string>;
  /** La galería colaborativa, si el pedido la incluye. null = sin sección. */
  galeria?: { abierta: boolean } | null;
}) {
  const router = useRouter();
  const [pendiente, empezar] = useTransition();
  const [grupo, setGrupo] = useState<Grupo>("vienen");
  const [texto, setTexto] = useState("");
  const [abriendo, setAbriendo] = useState(false);
  const [error, setError] = useState("");
  const [copiado, setCopiado] = useState(false);

  const refrescar = () => empezar(() => router.refresh());

  const anadir = async () => {
    setError("");
    const res = await fetch(`/api/lista/${token}/invitados`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texto }),
    });
    const cuerpo = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(cuerpo.error ?? "No se pudo guardar.");
      return;
    }
    setTexto("");
    setAbriendo(false);
    refrescar();
  };

  const quitar = async (id: string) => {
    await fetch(`/api/lista/${token}/invitados`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    refrescar();
  };

  const copiarPendientes = async () => {
    await navigator.clipboard.writeText(cruce.sinResponder.map((p) => p.nombre).join("\n"));
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  const tarjeta = "bg-white/5 border border-white/10 rounded-2xl";

  return (
    <div className="min-h-dvh bg-[#0D0D0F] px-5 py-10">
      <div className="max-w-2xl mx-auto">
        {/* ---------- Cabecera ---------- */}
        <header className="text-center mb-8">
          <span className="text-[10px] uppercase tracking-[0.4em] text-[#D4AF37] font-semibold">
            Tus confirmaciones
          </span>
          <h1 className="font-serif text-3xl sm:text-4xl text-white mt-2 leading-tight">
            {titulo}
          </h1>
          {fechaEvento && (
            <p className="text-white/40 text-sm mt-2">{fechaLarga(fechaEvento)}</p>
          )}
        </header>

        {!publicada && (
          <p className="bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs rounded-xl px-4 py-3 mb-6 text-center">
            Tu invitación todavía no está publicada. En cuanto lo esté, las
            confirmaciones de tus invitados aparecerán aquí solas.
          </p>
        )}

        {/* ---------- El número que importa ---------- */}
        <div className={`${tarjeta} p-6 text-center mb-4`}>
          <p className="text-[10px] uppercase tracking-[0.3em] text-white/40 font-semibold">
            Personas que asistirán
          </p>
          <p className="font-serif text-6xl text-[#D4AF37] my-2">{cruce.totalPersonas}</p>
          <p className="text-white/40 text-xs">
            Contando acompañantes. Es el número para el salón y el catering.
          </p>
        </div>

        {/* ---------- Los tres grupos ---------- */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {(
            [
              ["vienen", "Vienen", cruce.vienen.length, "text-emerald-400"],
              ["sinResponder", "Sin responder", cruce.sinResponder.length, "text-amber-300"],
              ["noVienen", "No vienen", cruce.noVienen.length, "text-white/50"],
            ] as const
          ).map(([id, etiqueta, cantidad, color]) => (
            <button
              key={id}
              onClick={() => setGrupo(id)}
              className={`${tarjeta} py-4 transition-colors ${
                grupo === id ? "!border-[#D4AF37]/60 bg-[#D4AF37]/5" : "hover:bg-white/[0.07]"
              }`}
            >
              <p className={`text-2xl font-bold ${color}`}>{cantidad}</p>
              <p className="text-[10px] uppercase tracking-wider text-white/40 mt-1">
                {etiqueta}
              </p>
            </button>
          ))}
        </div>

        {/* ---------- Perseguir a los que faltan ---------- */}
        {grupo === "sinResponder" && cruce.sinResponder.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={copiarPendientes}
              className="flex items-center gap-2 text-xs text-[#D4AF37] border border-[#D4AF37]/40 rounded-full px-4 py-2 hover:bg-[#D4AF37]/10 transition-colors"
            >
              {copiado ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiado ? "Copiados" : "Copiar los que faltan"}
            </button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(
                `Hola, te recuerdo confirmar tu asistencia a ${titulo}. ¡Gracias!`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs text-white/60 border border-white/15 rounded-full px-4 py-2 hover:bg-white/5 transition-colors"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              Recordar por WhatsApp
            </a>
          </div>
        )}

        {/* ---------- La lista del grupo elegido ---------- */}
        <div className={`${tarjeta} p-5 mb-6`}>
          <Lista
            grupo={grupo}
            cruce={cruce}
            sinLista={cruce.sinLista}
            respuestasPorInvitado={respuestasPorInvitado}
            etiquetasRsvp={etiquetasRsvp}
          />
        </div>

        {/* ---------- Los que no estaban en la lista ---------- */}
        {cruce.inesperados.length > 0 && (
          <div className={`${tarjeta} p-5 mb-6`}>
            <h2 className="text-white text-sm font-medium mb-1">
              Confirmaron sin estar en tu lista
            </h2>
            <p className="text-white/40 text-xs mb-4">
              Pasa cuando alguien reenvía la invitación. Ya están contados arriba.
            </p>
            <ul className="divide-y divide-white/5">
              {cruce.inesperados.map((p) => (
                <li key={p.nombre} className="py-2.5 flex items-center justify-between gap-3">
                  <span className="text-sm text-white/80">{p.nombre}</span>
                  <span className="text-[11px] text-white/40 shrink-0">
                    {p.asiste ? `viene${p.cantidad > 1 ? ` · ${p.cantidad}` : ""}` : "no viene"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ---------- Cargar a quién invitaste ---------- */}
        <div className={`${tarjeta} p-5`}>
          <div className="flex items-center justify-between gap-3 mb-1">
            <h2 className="text-white text-sm font-medium">A quién invitaste</h2>
            <span className="text-[11px] text-white/40">{invitados.length}</span>
          </div>
          <p className="text-white/40 text-xs mb-4">
            {cruce.sinLista
              ? "Carga tu lista y sabrás en todo momento a quién le falta confirmar. Es opcional."
              : "Cada confirmación se cruza sola con esta lista."}
          </p>

          {!abriendo ? (
            <button
              onClick={() => setAbriendo(true)}
              className="flex items-center gap-2 text-xs text-[#D4AF37] border border-[#D4AF37]/40 rounded-full px-4 py-2 hover:bg-[#D4AF37]/10 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Añadir nombres
            </button>
          ) : (
            <div>
              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                rows={6}
                autoFocus
                placeholder={"Un nombre por línea:\n\nMaría Pérez\nJuan y Ana\nFamilia Rodríguez"}
                className="w-full bg-black/40 border border-white/15 focus:border-[#D4AF37] rounded-xl px-4 py-3 text-white text-sm focus:outline-none resize-y"
              />
              {error && <p className="text-red-300 text-xs mt-2">{error}</p>}
              <div className="flex gap-2 mt-3">
                <button
                  onClick={anadir}
                  disabled={pendiente || texto.trim().length < 2}
                  className="flex items-center gap-2 bg-[#D4AF37] hover:bg-[#F2D06B] disabled:opacity-50 text-black text-xs font-semibold uppercase tracking-[0.15em] px-5 py-2.5 rounded-full transition-colors"
                >
                  {pendiente && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Guardar
                </button>
                <button
                  onClick={() => {
                    setAbriendo(false);
                    setError("");
                  }}
                  className="text-xs text-white/50 px-4 py-2.5 hover:text-white transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {invitados.length > 0 && (
            <ul className="flex flex-wrap gap-2 mt-5">
              {invitados.map((i) => (
                <li
                  key={i.id}
                  className="group flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-full pl-3 pr-1.5 py-1"
                >
                  <span className="text-xs text-white/70">{i.nombre}</span>
                  <button
                    onClick={() => quitar(i.id)}
                    aria-label={`Quitar a ${i.nombre}`}
                    className="text-white/25 hover:text-red-400 transition-colors p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ---------- Hogares y la puerta ---------- */}
        <div className="mt-6">
          <Hogares
            token={token}
            slug={slug}
            hogares={hogares}
            confirmadosPorHogar={confirmadosPorHogar}
          />
          {hogares.length + entradas.length > 0 && (
            <Recepcion
              token={token}
              hogares={hogares}
              entradas={entradas}
              confirmadosPorHogar={confirmadosPorHogar}
            />
          )}
          {galeria && (
            <GaleriaAnfitrion token={token} slug={slug} abiertaInicial={galeria.abierta} />
          )}
        </div>

        <p className="text-white/20 text-[11px] text-center mt-8">
          Esta página es solo tuya. Guarda el enlace: entra sin usuario ni contraseña.
        </p>
      </div>
    </div>
  );
}

/* ---------- La lista de un grupo ---------- */

function Lista({
  grupo,
  cruce,
  sinLista,
  respuestasPorInvitado,
  etiquetasRsvp,
}: {
  grupo: Grupo;
  cruce: Cruce;
  sinLista: boolean;
  respuestasPorInvitado: Record<string, Record<string, string>>;
  etiquetasRsvp: Record<string, string>;
}) {
  if (grupo === "sinResponder" && sinLista) {
    return (
      <p className="text-white/40 text-sm text-center py-6">
        Para saber a quién le falta confirmar, carga aquí abajo a quién invitaste.
      </p>
    );
  }

  const filas =
    grupo === "vienen"
      ? cruce.vienen.map((p) => ({
          clave: p.nombre,
          nombre: p.nombre,
          detalle: p.cantidad > 1 ? `${p.cantidad} personas` : null,
          nota: p.nota,
          Icono: UserCheck,
          color: "text-emerald-400",
        }))
      : grupo === "noVienen"
        ? cruce.noVienen.map((p) => ({
            clave: p.nombre,
            nombre: p.nombre,
            detalle: null,
            nota: p.nota,
            Icono: UserX,
            color: "text-white/30",
          }))
        : cruce.sinResponder.map((p) => ({
            clave: p.nombre,
            nombre: p.nombre,
            detalle: null,
            nota: null,
            Icono: Clock,
            color: "text-amber-300",
          }));

  if (filas.length === 0) {
    const vacio = {
      vienen: "Todavía no ha confirmado nadie.",
      sinResponder: "Ya han contestado todos. Nada pendiente.",
      noVienen: "Nadie ha dicho que no podrá ir.",
    }[grupo];
    return <p className="text-white/40 text-sm text-center py-6">{vacio}</p>;
  }

  return (
    <ul className="divide-y divide-white/5">
      {filas.map((f) => (
        <li key={f.clave} className="py-3 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <f.Icono className={`w-4 h-4 shrink-0 mt-0.5 ${f.color}`} />
            <div className="min-w-0">
              <p className="text-sm text-white/90">{f.nombre}</p>
              {/* Lo que contestó a las preguntas extra (menú, alergias…) */}
              {grupo === "vienen" &&
                respuestasPorInvitado[normalizarNombre(f.nombre)] && (
                  <p className="text-xs text-[#D4AF37]/80 mt-1">
                    {Object.entries(respuestasPorInvitado[normalizarNombre(f.nombre)])
                      .map(([id, valor]) => `${etiquetasRsvp[id] ?? id}: ${valor}`)
                      .join(" · ")}
                  </p>
                )}
              {f.nota && (
                <p className="text-xs text-white/40 mt-1 whitespace-pre-line">{f.nota}</p>
              )}
            </div>
          </div>
          {f.detalle && (
            <span className="inline-flex items-center gap-1 text-[11px] text-white/50 bg-white/5 px-2 py-0.5 rounded-full shrink-0">
              <Users className="w-3 h-3" />
              {f.detalle}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
