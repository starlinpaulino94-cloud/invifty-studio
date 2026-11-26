"use client";

import { createContext, useContext, ReactNode } from "react";
import type { ArteInvitacion, PiezaArteId } from "@/lib/ia/arte";

/**
 * Datos de la propia invitación que necesitan las piezas interactivas
 * (hoy, la confirmación de asistencia) pero que no forman parte de su
 * contenido visual.
 *
 * Va por contexto y no por props para no tener que hacerlo pasar por las
 * diez plantillas: el proveedor envuelve al Renderizador en la página y
 * cualquier pieza lo lee desde donde esté.
 */

/**
 * El hogar del invitado que llegó por su ENLACE PERSONAL
 * (/i/<slug>?h=<token>): la confirmación sale con su nombre puesto y su
 * cupo como tope. Quien entra por el enlace general no lo tiene, y todo
 * funciona igual que siempre.
 */
export interface HogarInvitado {
  nombre: string;
  cupo: number;
  token: string;
}

interface ContextoInvitacion {
  /** Dirección pública de la invitación: /i/<slug> */
  slug: string;
  /** true en la vista previa del equipo, antes de publicar. */
  esBorrador: boolean;
  /** Presente solo si el invitado llegó por su enlace personal. */
  hogar?: HogarInvitado;
  /**
   * Arte dibujado para ESTA invitación (lib/ia/arte.ts). Cada pieza que
   * venga sustituye al ornamento de la plantilla; sin arte, todo se ve
   * como se ha visto siempre.
   */
  arte?: ArteInvitacion;
  /**
   * Solo lo pone la vista previa del panel con el modo editar encendido.
   * Que exista es lo que convierte los textos en editables: en la
   * invitación publicada nunca llega, y `Texto` no dibuja nada extra.
   */
  onEditarTexto?: (ruta: string, valor: string) => void;
}

const Contexto = createContext<ContextoInvitacion>({ slug: "", esBorrador: false });

export function ProveedorInvitacion({
  slug,
  esBorrador = false,
  hogar,
  arte,
  onEditarTexto,
  children,
}: {
  slug: string;
  esBorrador?: boolean;
  hogar?: HogarInvitado;
  arte?: ArteInvitacion;
  onEditarTexto?: (ruta: string, valor: string) => void;
  children: ReactNode;
}) {
  return (
    <Contexto.Provider value={{ slug, esBorrador, hogar, arte, onEditarTexto }}>
      {children}
    </Contexto.Provider>
  );
}

export function useInvitacion(): ContextoInvitacion {
  return useContext(Contexto);
}

/**
 * El SVG de una pieza de arte propio, si esta invitación la tiene.
 *
 * Va por contexto por el mismo motivo que el resto: para que los
 * ornamentos lo lean desde donde estén sin hacerlo pasar por las doce
 * plantillas. Devuelve null cuando no hay arte, y entonces cada
 * ornamento dibuja el de siempre.
 */
export function useArte(pieza: PiezaArteId): string | null {
  const { arte } = useContext(Contexto);
  const svg = arte?.[pieza]?.svg;
  return svg ? svg : null;
}
