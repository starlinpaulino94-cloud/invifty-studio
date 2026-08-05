import { CATALOGO, EXTRAS, CATALOGO_ACTUALIZADO, type Capacidad } from "./planes";
import type { Plan } from "./tipos";

/**
 * EL CATÁLOGO QUE VE LA WEB PÚBLICA
 * ==================================
 * Construye la respuesta de GET /api/public/catalog. Es una función pura y
 * separada para poder probarla con lupa, porque su promesa es doble:
 *
 *  1. LO QUE SALE ES VERDAD: solo capacidades "activa" o "manual". Una
 *     capacidad vendida_sin_implementar NO sale — la web no puede anunciar
 *     lo que el sistema no cumple. Cuando se implemente (o se decida
 *     venderla igual), se cambia su estado en lib/planes.ts y aparece sola.
 *
 *  2. NO SALE NADA INTERNO: ni estados de capacidad, ni límites técnicos,
 *     ni notas, ni datos de nadie. La prueba de contrato lo vigila.
 *
 * `revisiones` solo sale cuando alguien la ha decidido (no es null): un
 * dato comercial sin decidir no se anuncia, se decide.
 */

export interface CapacidadPublica {
  id: string;
  nombre: string;
}

export interface PlanPublico {
  id: Plan;
  nombre: string;
  descripcion: string;
  precioDOP: number;
  vigenciaMeses: number;
  /** Fotos incluidas; null = sin límite. (Infinity no viaja en JSON.) */
  limiteFotos: number | null;
  revisiones?: number;
  capacidades: CapacidadPublica[];
  disponible: boolean;
}

export interface ExtraPublico {
  id: string;
  nombre: string;
  precioDOP: number;
}

export interface CatalogoPublico {
  actualizado: string;
  moneda: "DOP";
  planes: PlanPublico[];
  extras: ExtraPublico[];
}

const esPublica = (c: Capacidad) => c.estado === "activa" || c.estado === "manual";

export function catalogoPublico(): CatalogoPublico {
  const planes = (Object.entries(CATALOGO) as [Plan, (typeof CATALOGO)[Plan]][]).map(
    ([id, ficha]): PlanPublico => {
      const plan: PlanPublico = {
        id,
        nombre: ficha.nombre,
        descripcion: ficha.descripcion,
        precioDOP: ficha.precioDOP,
        vigenciaMeses: ficha.vigenciaMeses,
        limiteFotos: Number.isFinite(ficha.limiteFotos) ? ficha.limiteFotos : null,
        capacidades: ficha.capacidades.filter(esPublica).map(({ id, nombre }) => ({ id, nombre })),
        disponible: true,
      };
      if (ficha.revisiones !== null) plan.revisiones = ficha.revisiones;
      return plan;
    }
  );

  return {
    actualizado: CATALOGO_ACTUALIZADO,
    moneda: "DOP",
    planes,
    extras: EXTRAS.filter(esPublica).map(({ id, nombre, precioDOP }) => ({ id, nombre, precioDOP })),
  };
}
