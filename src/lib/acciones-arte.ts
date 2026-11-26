"use server";

import { crearClienteServidor } from "./supabase/servidor";
import { exigirPermiso, registrarAccion } from "./auditoria";
import { registrarError } from "./registro";
import { modoIA } from "./entorno";
import { inicialesDe } from "./iniciales";
import { PALETAS, PALETA_POR_DEFECTO } from "@/config/diseno";
import { plantillaMeta } from "@/config/plantillas";
import {
  coloresDePaleta,
  IDS_PIEZAS,
  validarPropuestas,
  type BriefArte,
  type PiezaArteId,
  type PiezaValidada,
} from "./ia/arte";
import type { DatosInvitacion, TipoEvento } from "./tipos";

/**
 * DIBUJAR EL ARTE — la segunda puerta del panel hacia la IA
 * ==========================================================
 * Mismo camino que los conceptos (acciones-ia.ts) y por los mismos
 * motivos, con un paso más que no es opcional: lo que vuelve es SVG, o
 * sea código, y no se acerca a una pantalla sin pasar por la aduana
 * (ia/svg.ts) y por el ajuste al hueco (ia/arte.ts).
 *
 *  1. Permiso en servidor (editar_invitaciones).
 *  2. Brief derivado de datos reales: tipo de evento, iniciales,
 *     plantilla y los hex EXACTOS de su paleta. Sin fecha, sin lugares,
 *     sin teléfono — el arte no los necesita y no los recibe.
 *  3. Claude dibuja (solo con IA_PROVEEDOR=anthropic; en modo mock se
 *     dice, no se finge).
 *  4. Cada pieza se valida por separado: una puede entrar y otra no.
 *  5. Todo queda en `generaciones` con tipo "arte": tokens, coste,
 *     versión de prompt y el motivo exacto de cada rechazo.
 *
 * Lo que esta acción NO hace: escribir en la invitación. Las piezas
 * vuelven al editor, se ven en la vista previa y se guardan con el botón
 * de siempre. Deshacer es no guardar.
 */

export interface PiezaPropuesta {
  pieza: PiezaArteId;
  svg: string;
  idea: string;
}

export interface RespuestaArte {
  ok: boolean;
  piezas?: PiezaPropuesta[];
  /** Lo que se rechazó y por qué. Se enseña: un rechazo callado es un bug. */
  rechazos?: { pieza: string; motivo: string }[];
  error?: string;
}

export async function generarArteIA(
  invitacionId: string,
  piezas: string[],
  intento: number
): Promise<RespuestaArte> {
  const supabase = await crearClienteServidor();
  const quien = await exigirPermiso(supabase, "editar_invitaciones");

  if (modoIA() !== "anthropic") {
    return {
      ok: false,
      error:
        "El arte a medida solo lo dibuja el proveedor real. Pon IA_PROVEEDOR=anthropic con su IA_API_KEY en Vercel y vuelve a desplegar.",
    };
  }

  const pedidas = IDS_PIEZAS.filter((id) => piezas.includes(id));
  if (!pedidas.length) return { ok: false, error: "No se pidió ninguna pieza." };

  const { data: invitacion } = await supabase
    .from("invitaciones")
    .select("id, plantilla, datos, pedidos(tipo_evento)")
    .eq("id", invitacionId)
    .single();
  if (!invitacion) return { ok: false, error: "Invitación no encontrada" };

  const pedido = invitacion.pedidos as unknown as { tipo_evento: TipoEvento } | null;
  const datos = (invitacion.datos ?? {}) as DatosInvitacion;
  const paleta = PALETAS[datos.paleta] ?? PALETAS[PALETA_POR_DEFECTO];
  const colores = coloresDePaleta(paleta);

  const brief: BriefArte = {
    tipoEvento: pedido?.tipo_evento ?? "otro",
    iniciales: (datos.monograma?.trim() || inicialesDe(datos.titulo ?? "")).slice(0, 7),
    plantilla: plantillaMeta(invitacion.plantilla)?.nombre ?? invitacion.plantilla,
    paleta: paleta.nombre,
    colores,
    // Lo que el cliente pidió a mano sobre estilo: es suyo y orienta el
    // dibujo. No se publica nunca (ver notasEquipo en lib/tipos.ts).
    estilo: (datos.notasEquipo ?? [])
      .map((n) => `${n.titulo}: ${n.texto}`)
      .join(" · ")
      .slice(0, 500) || undefined,
  };

  const intentoLimpio = Math.min(Math.max(Math.floor(intento) || 1, 1), 50);

  let resultado;
  let errorProveedor: string | null = null;
  try {
    const { generarArte } = await import("./ia/arte-anthropic");
    resultado = await generarArte(brief, pedidas, intentoLimpio);
  } catch (e) {
    errorProveedor = e instanceof Error ? e.message : "Fallo del proveedor";
  }

  const validadas: PiezaValidada[] = resultado
    ? validarPropuestas(resultado.propuestas, colores)
    : [];
  const buenas = validadas.filter((p): p is Extract<PiezaValidada, { ok: true }> => p.ok);
  const rechazos = validadas
    .filter((p): p is Extract<PiezaValidada, { ok: false }> => !p.ok)
    .map(({ pieza, motivo }) => ({ pieza, motivo }));

  // El registro va SIEMPRE: una generación fallida sin rastro es un coste
  // invisible. Si la tabla no existe aún, se anota y la operación sigue.
  const { error: errorRegistro } = await supabase.from("generaciones").insert({
    invitacion_id: invitacionId,
    tipo: "arte",
    proveedor: resultado?.proveedor ?? "desconocido",
    modelo: resultado?.modelo ?? "—",
    prompt_version: resultado?.promptVersion ?? "—",
    hash_brief: `${pedidas.join("+")}:${datos.paleta ?? "—"}:${intentoLimpio}`,
    intento: intentoLimpio,
    // Se guardan las IDEAS y los motivos, no los SVG: el registro es para
    // auditar coste y calidad, no un segundo almacén de dibujos.
    resultado: {
      aprobadas: buenas.map((p) => ({ pieza: p.pieza, idea: p.idea })),
      rechazadas: rechazos,
    },
    valido: buenas.length > 0,
    error: errorProveedor ?? (rechazos.length ? rechazos.map((r) => `${r.pieza}: ${r.motivo}`).join(" | ") : null),
    tokens_entrada: resultado?.tokensEntrada ?? 0,
    tokens_salida: resultado?.tokensSalida ?? 0,
    costo_usd: resultado?.costoEstimadoUsd ?? 0,
    latencia_ms: resultado?.latenciaMs ?? 0,
    usuario_id: quien.id,
    usuario_email: quien.email,
  });
  if (errorRegistro) {
    registrarError("ia", errorRegistro, { codigo: errorRegistro.code, paso: "registro-arte" });
  }

  await registrarAccion(supabase, quien, "ia:arte", "invitacion", invitacionId, {
    piezas: pedidas.join("+"),
    aprobadas: buenas.length,
    rechazadas: rechazos.length,
    intento: intentoLimpio,
  });

  if (errorProveedor) {
    registrarError("ia", errorProveedor, { invitacion: invitacionId, paso: "arte" });
    return { ok: false, error: errorProveedor };
  }
  if (!buenas.length) {
    return {
      ok: false,
      error: "Ninguna pieza pasó la validación.",
      rechazos,
    };
  }

  return {
    ok: true,
    piezas: buenas.map(({ pieza, svg, idea }) => ({ pieza, svg, idea })),
    rechazos,
  };
}
