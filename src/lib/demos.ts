import { plantillaMeta } from "@/config/plantillas";
import type { Demo, DatosInvitacion, Plan } from "./tipos";

/**
 * DEMOS PÚBLICAS — lo que la web enseña de muestra
 * =================================================
 * El equipo marca invitaciones publicadas como demo en /panel/demos, y la
 * web las lista con GET /api/public/demos. Este módulo arma esa respuesta
 * en una función pura, probada aparte, porque su promesa es la de siempre
 * en /api/public: NO SALE NADA PRIVADO. Ni ids internos, ni tokens, ni
 * pedido, ni cliente — solo lo que un visitante vería igualmente al abrir
 * la invitación.
 */

export interface DemoPublica {
  titulo: string;
  slug: string;
  url: string;
  tipoEvento: string;
  /** Nombre de la plantilla, como estilo visual ("Editorial Luxe"). */
  estilo: string;
  planMinimo: Plan;
  orden: number;
  destacada: boolean;
  idioma: string;
  /** Imagen de muestra, servida por /api/public/demos/<slug>/portada. */
  portada: string;
}

export interface DemoConInvitacion extends Demo {
  invitaciones: {
    slug: string;
    plantilla: string;
    estado: string;
    datos: Pick<DatosInvitacion, "titulo">;
  } | null;
}

/**
 * Convierte las filas de la base en el contrato público. Filtra sola lo
 * que no debe salir: demos apagadas y —pase lo que pase con la marca—
 * invitaciones que ya no estén publicadas. Que una demo apunte a un
 * borrador es un error del equipo, no una filtración del sistema.
 */
export function demosPublicas(filas: DemoConInvitacion[], urlBase: string): DemoPublica[] {
  return filas
    .filter((d) => d.activa && d.invitaciones && d.invitaciones.estado === "publicada")
    .sort((a, b) => a.orden - b.orden)
    .map((d) => {
      const inv = d.invitaciones!;
      return {
        titulo: inv.datos?.titulo || "Invitación de muestra",
        slug: inv.slug,
        url: `${urlBase}/i/${inv.slug}`,
        tipoEvento: d.tipo_evento,
        estilo: plantillaMeta(inv.plantilla).nombre,
        planMinimo: d.plan_minimo,
        orden: d.orden,
        destacada: d.destacada,
        idioma: d.idioma,
        portada: `${urlBase}/api/public/demos/${inv.slug}/portada`,
      };
    });
}
