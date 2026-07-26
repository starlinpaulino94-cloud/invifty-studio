"use client";

import { useEffect, useRef } from "react";
import {
  ATRIBUTOS_SANDBOX, CANAL, aplicarMarcadores, esMensajeRsvp, inyectarPuente,
} from "@/lib/codigo";
import { fechaLarga } from "@/lib/fechas";
import { useInvitacion } from "./base/Contexto";
import type { DatosInvitacion, FotoInvitacion } from "@/lib/tipos";

/**
 * Muestra una invitación hecha fuera del sistema (por ejemplo con IA).
 *
 * Va dentro de un iframe con `sandbox` y SIN `allow-same-origin`: el
 * navegador le da un origen opaco, así que el código pegado no puede leer
 * la sesión del equipo ni tocar la página que lo contiene. Ver lib/codigo.ts.
 *
 * El contador de visitas y la vista previa al compartir viven en la página
 * de fuera, así que siguen funcionando igual que en las demás invitaciones.
 *
 * PUENTE DE CONFIRMACIONES
 * -------------------------
 * Ese mismo aislamiento impide que el código pegado llame a nuestra API.
 * Por eso manda un mensaje y es este componente quien guarda. Se acepta el
 * mensaje SOLO si viene de nuestro propio iframe (`event.source`): el
 * origen no sirve para comprobarlo, porque en un iframe aislado siempre
 * llega como "null" y cualquier página podría falsificarlo.
 */
export default function CodigoPropio({
  html,
  datos,
  fotos,
}: {
  html: string | null;
  datos: DatosInvitacion;
  fotos: FotoInvitacion[];
}) {
  const { slug, esBorrador } = useInvitacion();
  const marco = useRef<HTMLIFrameElement>(null);

  const contenido = inyectarPuente(
    aplicarMarcadores(html ?? "", {
      fotos,
      titulo: datos.titulo,
      fecha: datos.fechaEvento ? fechaLarga(datos.fechaEvento) : "",
    })
  );

  useEffect(() => {
    const alRecibir = async (evento: MessageEvent) => {
      // La comprobación que sostiene todo: solo hablamos con NUESTRO iframe.
      if (!marco.current || evento.source !== marco.current.contentWindow) return;
      if (!esMensajeRsvp(evento.data)) return;

      const { id, datos: enviados } = evento.data;

      const responder = (resultado: { ok: boolean; error?: string }) =>
        marco.current?.contentWindow?.postMessage(
          { canal: CANAL, accion: "rsvp:respuesta", id, resultado },
          "*"
        );

      // En la vista previa del equipo no se guardan confirmaciones de prueba.
      if (esBorrador || !slug) {
        responder({ ok: true });
        return;
      }

      try {
        const res = await fetch(`/api/invitacion/${slug}/rsvp`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nombre: String(enviados.nombre ?? ""),
            asiste: enviados.asiste !== false,
            cantidad: Number(enviados.cantidad ?? 1),
            nota: String(enviados.nota ?? ""),
          }),
        });
        const cuerpo = await res.json().catch(() => ({}));
        responder(res.ok ? { ok: true } : { ok: false, error: cuerpo.error });
      } catch {
        responder({ ok: false, error: "No pudimos guardar tu confirmación. Revisa tu conexión." });
      }
    };

    window.addEventListener("message", alRecibir);
    return () => window.removeEventListener("message", alRecibir);
  }, [slug, esBorrador]);

  if (!contenido.trim()) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[#0D0D0F] px-6 text-center">
        <div>
          <p className="text-white/70 text-sm">Esta invitación todavía no tiene contenido.</p>
          {esBorrador && (
            <p className="text-white/35 text-xs mt-2">
              Pega el código en el editor del panel para verla aquí.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col bg-white">
      {esBorrador && slug && (
        <div className="bg-amber-500 text-black text-center text-xs font-bold py-2 px-4 shrink-0">
          ⚠ BORRADOR — Solo visible para el equipo Invifty. Publica la invitación para compartirla.
        </div>
      )}
      <iframe
        ref={marco}
        srcDoc={contenido}
        sandbox={ATRIBUTOS_SANDBOX}
        title={datos.titulo || "Invitación"}
        className="flex-1 w-full border-0"
      />
    </div>
  );
}
