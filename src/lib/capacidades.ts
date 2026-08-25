import { CATALOGO, type Capacidad, type EstadoCapacidad } from "./planes";
import type { Plan } from "./tipos";

/**
 * EL SERVICIO DE CAPACIDADES (entitlements)
 * ==========================================
 * UNA sola puerta para la pregunta "¿este pedido tiene derecho a esta
 * función?". Nada de `if (plan === "premium")` regado por los
 * componentes: la interfaz pregunta aquí para saber qué enseñar, y el
 * SERVIDOR pregunta aquí antes de ejecutar — esconder un botón no es
 * seguridad.
 *
 * LA FOTO DEL CONTRATO. Al crear un pedido se congela el catálogo del
 * momento en `pedidos.capacidades_contratadas` (snapshotDeContrato).
 * Si mañana el plan Popular pierde una capacidad o cambia un límite, los
 * contratos de ayer NO se mueven: el servicio lee primero la foto y solo
 * cae al catálogo vivo con los pedidos de antes de esta fase (que no
 * tienen foto). `origen` lo dice honestamente.
 *
 * LOS ESTADOS SIGUEN DICIENDO LA VERDAD. Una capacidad "manual" está
 * contratada pero la cumple el equipo (no hay botón que apretar); una
 * "vendida_sin_implementar" está pagada y el sistema aún no la tiene —
 * `puede()` responde si el SISTEMA puede ejecutarla (solo "activa"), y
 * `estadoDeCapacidad()` da el matiz para que la interfaz explique en vez
 * de mentir.
 */

/** La versión del formato de la foto; si cambia la forma, súbela. */
const VERSION_SNAPSHOT = 1;

export interface SnapshotContrato {
  version: number;
  plan: Plan;
  congelado_en: string;
  precioDOP: number;
  vigenciaMeses: number;
  /** null = sin límite (JSON no sabe decir Infinity). */
  limiteFotos: number | null;
  revisiones: number | null;
  capacidades: Capacidad[];
}

export interface ContratoCapacidades {
  plan: Plan;
  /** "foto" = congelado al contratar; "catalogo" = pedido anterior a la foto. */
  origen: "foto" | "catalogo";
  congeladoEn: string | null;
  capacidades: Capacidad[];
  limiteFotos: number;
  vigenciaMeses: number;
  revisiones: number | null;
}

/** Lo que se congela en el pedido en el momento de contratar. */
export function snapshotDeContrato(plan: Plan, ahora: Date): SnapshotContrato {
  const ficha = CATALOGO[plan];
  return {
    version: VERSION_SNAPSHOT,
    plan,
    congelado_en: ahora.toISOString(),
    precioDOP: ficha.precioDOP,
    vigenciaMeses: ficha.vigenciaMeses,
    limiteFotos: Number.isFinite(ficha.limiteFotos) ? ficha.limiteFotos : null,
    revisiones: ficha.revisiones,
    capacidades: ficha.capacidades.map((c) => ({ ...c })),
  };
}

/**
 * El contrato efectivo de un pedido: su foto si la tiene y es legible,
 * o el catálogo vivo si es un pedido de antes de esta fase. Una foto
 * corrupta no tumba nada: se cae al catálogo (y `origen` lo delata).
 */
export function contratoDePedido(pedido: {
  plan: Plan | string;
  capacidades_contratadas?: unknown;
}): ContratoCapacidades {
  const plan = (pedido.plan in CATALOGO ? pedido.plan : "popular") as Plan;
  const cruda = pedido.capacidades_contratadas;

  if (
    cruda &&
    typeof cruda === "object" &&
    (cruda as SnapshotContrato).version === VERSION_SNAPSHOT &&
    Array.isArray((cruda as SnapshotContrato).capacidades)
  ) {
    const foto = cruda as SnapshotContrato;
    return {
      plan,
      origen: "foto",
      congeladoEn: foto.congelado_en ?? null,
      capacidades: foto.capacidades.filter(
        (c) => c && typeof c.id === "string" && typeof c.estado === "string"
      ),
      limiteFotos: foto.limiteFotos === null ? Infinity : Number(foto.limiteFotos) || 0,
      vigenciaMeses: Number(foto.vigenciaMeses) || CATALOGO[plan].vigenciaMeses,
      revisiones: foto.revisiones ?? null,
    };
  }

  const ficha = CATALOGO[plan];
  return {
    plan,
    origen: "catalogo",
    congeladoEn: null,
    capacidades: ficha.capacidades,
    limiteFotos: ficha.limiteFotos,
    vigenciaMeses: ficha.vigenciaMeses,
    revisiones: ficha.revisiones,
  };
}

/** El estado de una capacidad en este contrato, o null si no la incluye. */
export function estadoDeCapacidad(
  contrato: ContratoCapacidades,
  capacidadId: string
): EstadoCapacidad | null {
  return contrato.capacidades.find((c) => c.id === capacidadId)?.estado ?? null;
}

/**
 * ¿El SISTEMA puede ejecutar esta capacidad para este contrato?
 * Solo "activa" responde sí: una "manual" la cumple el equipo y una
 * "vendida_sin_implementar" todavía no existe — decir sí sería mentir.
 */
export function puede(contrato: ContratoCapacidades, capacidadId: string): boolean {
  return estadoDeCapacidad(contrato, capacidadId) === "activa";
}

export type LimitePlan = "fotos" | "vigenciaMeses" | "revisiones";

/** El límite contratado. Infinity = sin límite; null = sin decidir. */
export function limite(
  contrato: ContratoCapacidades,
  cual: LimitePlan
): number | null {
  switch (cual) {
    case "fotos":
      return contrato.limiteFotos;
    case "vigenciaMeses":
      return contrato.vigenciaMeses;
    case "revisiones":
      return contrato.revisiones;
  }
}

/**
 * El guard del servidor: lanza con un mensaje honesto si el contrato no
 * cubre la capacidad. El mensaje distingue "tu plan no la incluye" de
 * "está incluida pero la gestiona el equipo" — al cliente no se le dice
 * lo mismo en los dos casos.
 */
export function exigirCapacidad(contrato: ContratoCapacidades, capacidadId: string): void {
  const estado = estadoDeCapacidad(contrato, capacidadId);
  if (estado === "activa") return;
  if (estado === "manual") {
    throw new Error(
      "Esta función está incluida en tu plan y la gestiona el equipo de Invifty: escríbenos."
    );
  }
  if (estado === "vendida_sin_implementar") {
    throw new Error(
      "Esta función de tu plan estará disponible pronto; el equipo la gestiona por ti mientras tanto."
    );
  }
  throw new Error(`Tu plan ${CATALOGO[contrato.plan].nombre} no incluye esta función.`);
}
