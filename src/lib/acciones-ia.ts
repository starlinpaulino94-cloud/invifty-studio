"use server";

import { crearClienteServidor } from "./supabase/servidor";
import { exigirPermiso, registrarAccion } from "./auditoria";
import { registrarError } from "./registro";
import { derivarBrief, semillaDeBrief } from "./ia/brief";
import { proveedorActivo } from "./ia/proveedor";
import { validarConceptos } from "./ia/esquema";
import { avisosDeParecido } from "./ia/huella";
import { listarArchivos } from "./fotos";
import { crearClienteAdmin } from "./supabase/admin";
import type { ConceptoCreativo } from "./ia/tipos";
import type { DatosInvitacion, Plan, TipoEvento } from "./tipos";

/**
 * GENERAR CONCEPTOS — la única puerta del panel hacia la IA
 * ==========================================================
 * El flujo entero, en orden y con sus porqués:
 *
 *  1. Permiso en servidor (editar_invitaciones): la IA propone cambios de
 *     diseño, así que pide el mismo permiso que editarlos a mano.
 *  2. Brief DERIVADO de datos reales (ia/brief.ts): nada inventado, sin
 *     teléfono ni fecha ni lugares.
 *  3. El proveedor activo propone (mock o Claude, según IA_PROVEEDOR).
 *  4. La aduana valida (ia/esquema.ts): catálogo real, datos factuales
 *     vetados, exactamente tres.
 *  5. TODO queda registrado en `generaciones` — lo válido y lo fallido,
 *     con tokens, costo y versión de prompt. Un error de proveedor no es
 *     silencioso ni se corrige a escondidas.
 *
 * Lo que esta acción NO hace: escribir en la invitación. Los conceptos
 * vuelven al editor y se aplican al estado local (ia/aplicar.ts), donde
 * el equipo los ve en la vista previa y guarda con el botón de siempre.
 */

export interface RespuestaConceptos {
  ok: boolean;
  conceptos?: ConceptoCreativo[];
  avisos?: string[];
  proveedor?: string;
  error?: string;
}

export async function generarConceptosIA(
  invitacionId: string,
  intento: number
): Promise<RespuestaConceptos> {
  const supabase = await crearClienteServidor();
  const quien = await exigirPermiso(supabase, "editar_invitaciones");

  const proveedor = await proveedorActivo();
  if (!proveedor) {
    return { ok: false, error: "La generación de conceptos está apagada (IA_PROVEEDOR=off)." };
  }

  const { data: invitacion } = await supabase
    .from("invitaciones")
    .select("id, pedido_id, plantilla, datos, pedidos(tipo_evento, plan)")
    .eq("id", invitacionId)
    .single();
  if (!invitacion) return { ok: false, error: "Invitación no encontrada" };

  const pedido = invitacion.pedidos as unknown as { tipo_evento: TipoEvento; plan: Plan } | null;
  const datos = (invitacion.datos ?? {}) as DatosInvitacion;

  // ¿Hay fotos? El brief lo dice para que los conceptos cuenten con ellas.
  let tieneFotos = false;
  try {
    const archivos = await listarArchivos(crearClienteAdmin(), invitacion.pedido_id, 1);
    tieneFotos = archivos.length > 0;
  } catch {
    // Sin acceso al Storage no se cae la generación: se asume sin fotos.
  }

  const brief = derivarBrief(
    pedido?.tipo_evento ?? "otro",
    pedido?.plan ?? "popular",
    datos,
    invitacion.plantilla,
    tieneFotos
  );
  const intentoLimpio = Math.min(Math.max(Math.floor(intento) || 1, 1), 50);

  let resultadoProveedor;
  let errorProveedor: string | null = null;
  try {
    resultadoProveedor = await proveedor.generarConceptos(brief, intentoLimpio);
  } catch (e) {
    errorProveedor = e instanceof Error ? e.message : "Fallo del proveedor";
  }

  const validacion = resultadoProveedor
    ? validarConceptos(resultadoProveedor.conceptos)
    : ({ ok: false, error: errorProveedor ?? "Sin respuesta" } as const);

  // El registro va SIEMPRE, válido o no: una generación fallida sin rastro
  // es un coste invisible y un bug indiscutible. Si la tabla aún no existe
  // (migración pendiente), se anota en el log y la operación sigue.
  const { error: errorRegistro } = await supabase.from("generaciones").insert({
    invitacion_id: invitacionId,
    tipo: "conceptos",
    proveedor: resultadoProveedor?.proveedor ?? "desconocido",
    modelo: resultadoProveedor?.modelo ?? "—",
    prompt_version: resultadoProveedor?.promptVersion ?? "—",
    hash_brief: String(semillaDeBrief(brief, intentoLimpio)),
    intento: intentoLimpio,
    resultado: validacion.ok ? { conceptos: validacion.conceptos } : null,
    valido: validacion.ok,
    error: validacion.ok ? null : validacion.error,
    tokens_entrada: resultadoProveedor?.tokensEntrada ?? 0,
    tokens_salida: resultadoProveedor?.tokensSalida ?? 0,
    costo_usd: resultadoProveedor?.costoEstimadoUsd ?? 0,
    latencia_ms: resultadoProveedor?.latenciaMs ?? 0,
    usuario_id: quien.id,
    usuario_email: quien.email,
  });
  if (errorRegistro) {
    registrarError("ia", errorRegistro, { codigo: errorRegistro.code, paso: "registro" });
  }

  await registrarAccion(supabase, quien, "ia:generar", "invitacion", invitacionId, {
    proveedor: resultadoProveedor?.proveedor ?? "desconocido",
    valido: validacion.ok,
    intento: intentoLimpio,
  });

  if (!validacion.ok) {
    registrarError("ia", validacion.error, { invitacion: invitacionId });
    return {
      ok: false,
      error: `La propuesta no pasó la validación: ${validacion.error}. Vuelve a intentarlo.`,
    };
  }

  return {
    ok: true,
    conceptos: validacion.conceptos,
    avisos: avisosDeParecido(validacion.conceptos),
    proveedor: resultadoProveedor!.proveedor,
  };
}
