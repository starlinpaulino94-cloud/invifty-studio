"use client";

import { useEffect, useRef } from "react";
import { useInvitacion } from "./Contexto";

/**
 * Avisa una sola vez de que la invitación se abrió.
 *
 * No pinta nada. Se hace desde el navegador y no al renderizar en el
 * servidor para que solo cuenten personas de verdad: los rastreadores y
 * las vistas previas de WhatsApp piden el HTML pero no ejecutan JavaScript.
 *
 * La referencia evita el doble aviso del modo estricto en desarrollo, y en
 * el servidor la propia ruta ignora los borradores.
 */
export default function RegistroVisita() {
  const { slug, esBorrador } = useInvitacion();
  const yaAvisado = useRef(false);

  useEffect(() => {
    if (esBorrador || !slug || yaAvisado.current) return;
    yaAvisado.current = true;

    // keepalive: el aviso llega aunque el invitado cierre enseguida.
    fetch(`/api/invitacion/${slug}/visita`, { method: "POST", keepalive: true }).catch(() => {
      // Contar visitas nunca puede estropear la invitación.
    });
  }, [slug, esBorrador]);

  return null;
}
