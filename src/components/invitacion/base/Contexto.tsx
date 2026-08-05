"use client";

import { createContext, useContext, ReactNode } from "react";

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
  onEditarTexto,
  children,
}: {
  slug: string;
  esBorrador?: boolean;
  hogar?: HogarInvitado;
  onEditarTexto?: (ruta: string, valor: string) => void;
  children: ReactNode;
}) {
  return (
    <Contexto.Provider value={{ slug, esBorrador, hogar, onEditarTexto }}>
      {children}
    </Contexto.Provider>
  );
}

export function useInvitacion(): ContextoInvitacion {
  return useContext(Contexto);
}
