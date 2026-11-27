"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "./supabase/servidor";
import { exigirPermiso, registrarAccion, registrarCambioEstado } from "./auditoria";
import { derivarDatosInvitacion } from "./invitacion";
import { sanearPreguntas } from "./rsvp";
import { sanearArteGuardado } from "./ia/arte";
import { registrarError } from "./registro";
import { slugificar, slugConSufijo } from "./slug";
import { normalizarDominio, dominioValido } from "./dominios";
import { calcularVencimiento } from "./vencimientos";
import type { DatosInvitacion, Plan, TipoEvento } from "./tipos";
import { urlBase as resolverUrlBase } from "./url";
import { errorDePesoCodigo } from "./codigo";
import { tieneMediosEmbebidos } from "./codigo-medios";

/**
 * FASE 2 — Acciones del generador de invitaciones (solo panel).
 */

/** Genera la invitación en borrador desde las respuestas del formulario. */
export async function generarInvitacion(pedidoId: string) {
  const supabase = await crearClienteServidor();

  // Si ya existe, ir directo al editor
  const { data: existente } = await supabase
    .from("invitaciones")
    .select("id")
    .eq("pedido_id", pedidoId)
    .maybeSingle();
  if (existente) redirect(`/panel/invitaciones/${existente.id}`);

  const { data: pedido } = await supabase
    .from("pedidos")
    .select("*, clientes(*), formularios(*)")
    .eq("id", pedidoId)
    .single();
  if (!pedido) throw new Error("Pedido no encontrado");

  const respuestas = (pedido.formularios?.[0]?.respuestas ?? {}) as Record<string, unknown>;
  const { datos, plantilla } = derivarDatosInvitacion(
    pedido.tipo_evento as TipoEvento,
    respuestas,
    pedido.clientes?.telefono ?? "",
    pedido.fecha_evento,
    pedido.plan as Plan
  );

  /**
   * Dirección única a partir del título, con un sufijo al azar detrás:
   * "camila-y-lucas-k3f9m". Sin él, "boda-maria-y-jose" se adivina probando,
   * y quien acierte ve la dirección del evento, las fotos y el WhatsApp del
   * anfitrión. Ver `slugConSufijo` en lib/slug.ts.
   *
   * Si por lo que sea chocara, se sortea otro sufijo en vez de añadir "-2":
   * un contador al final volvería a hacer la dirección predecible.
   */
  let slug = slugConSufijo(datos.titulo);
  for (let intento = 0; intento < 10; intento++) {
    const { data: choque } = await supabase
      .from("invitaciones")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!choque) break;
    slug = slugConSufijo(datos.titulo);
  }

  /**
   * El panel del anfitrión nace con la invitación, no después: si se
   * generara al publicar, las invitaciones que ya existen se quedarían sin
   * él y habría que acordarse de crearlo a mano. Es el mismo trato que el
   * formulario del cliente — un enlace secreto, sin cuenta ni contraseña.
   */
  const tokenLista = crypto.randomUUID().replace(/-/g, "");

  const { data: nueva, error } = await supabase
    .from("invitaciones")
    .insert({ pedido_id: pedidoId, slug, datos, plantilla, token_lista: tokenLista })
    .select("id")
    .single();
  if (error) throw new Error(`No se pudo generar la invitación: ${error.message}`);

  revalidatePath(`/panel/pedidos/${pedidoId}`);
  redirect(`/panel/invitaciones/${nueva.id}`);
}

/** Guarda los cambios del editor. */
async function guardarInvitacionInterno(
  fase: { actual: string },
  invitacionId: string,
  datos: DatosInvitacion,
  slug: string,
  plantilla: string,
  /** HTML de la invitación cuando se hizo fuera del sistema. */
  codigoHtml?: string | null,
  /** Dominio propio del cliente, si compró el extra. */
  dominio?: string | null
): Promise<{ ok: boolean; error?: string }> {
  fase.actual = "comprobar permisos";
  const supabase = await crearClienteServidor();
  const quien = await exigirPermiso(supabase, "editar_invitaciones");

  // El peso se comprueba también aquí: lo que llega viene del navegador, y
  // el tope de next.config.ts solo corta de golpe, sin decir por qué.
  // Aquí se mide lo que de verdad llegó (contandoMedios): el editor ya debió
  // sacar los archivos embebidos, y un código que los trae sin sacar es de
  // un editor desactualizado o de alguien llamando a la acción a mano.
  if (codigoHtml && tieneMediosEmbebidos(codigoHtml)) {
    return {
      ok: false,
      error:
        "El código trae imágenes o videos pegados dentro que no se alojaron aparte. " +
        "Recarga el editor (puede que tengas una versión vieja abierta) y guarda otra vez.",
    };
  }
  const errorPeso = codigoHtml ? errorDePesoCodigo(codigoHtml, { contandoMedios: true }) : null;
  if (errorPeso) return { ok: false, error: errorPeso };

  // El dominio se guarda normalizado (sin https://, sin www, en
  // minúsculas) para que la petición que llegue por él lo encuentre.
  const dominioLimpio = normalizarDominio(dominio ?? "");
  if (dominioLimpio && !dominioValido(dominioLimpio)) {
    return { ok: false, error: `"${dominioLimpio}" no tiene forma de dominio (ej. bodacamila.com).` };
  }

  const slugLimpio = slugificar(slug);

  // El slug y el dominio son la DIRECCIÓN pública: cambiarlos rompe
  // enlaces ya repartidos, así que su cambio queda firmado. Se mira ANTES
  // de escribir — después ya no habría contra qué comparar.
  fase.actual = "leer la invitación";
  const { data: previa } = await supabase
    .from("invitaciones")
    .select("slug, dominio, bloqueada_en")
    .eq("id", invitacionId)
    .single();

  // El candado de la aprobación: lo que el cliente aprobó no se toca por
  // descuido. Desbloquear existe, es explícito y queda firmado.
  if (previa?.bloqueada_en) {
    return {
      ok: false,
      error:
        "El cliente aprobó esta invitación y está bloqueada. Para editarla, desbloquéala desde la tarjeta de revisión (quedará en auditoría).",
    };
  }

  // Las preguntas extra del RSVP se sanean también AQUÍ, no solo en el
  // editor: topes de cantidad y de texto (lib/rsvp.ts) pase lo que pase
  // en el navegador.
  if (datos.rsvp?.preguntas !== undefined) {
    datos = { ...datos, rsvp: { ...datos.rsvp, preguntas: sanearPreguntas(datos.rsvp.preguntas) } };
  }

  // EL ARTE SE VUELVE A SANEAR AQUÍ, y esto no es paranoia duplicada: lo
  // que llega en `datos` viene del NAVEGADOR. La tarjeta del editor envía
  // SVG que ya pasó la aduana, pero una acción de servidor se puede
  // llamar con lo que sea, y un SVG es código que luego se pinta en el
  // celular de cada invitado. Que el botón solo mande cosas buenas no es
  // una garantía: la garantía es esta línea.
  if (datos.arte !== undefined) {
    const { arte, descartadas } = sanearArteGuardado(datos.arte);
    if (descartadas.length) {
      registrarError("arte", `Arte descartado al guardar: ${descartadas.join(" | ")}`, {
        invitacion: invitacionId,
      });
    }
    datos = { ...datos, arte };
  }

  fase.actual = "escribir en la base de datos";
  const { error } = await supabase
    .from("invitaciones")
    .update({
      datos,
      slug: slugLimpio,
      plantilla,
      codigo_html: codigoHtml ?? null,
      dominio: dominioLimpio || null,
    })
    .eq("id", invitacionId);

  if (error) {
    const mensaje = error.message.includes("invitaciones_dominio_unico")
      ? "Ese dominio ya está asignado a otra invitación."
      : error.message.includes("duplicate")
        ? "Ese slug ya está en uso por otra invitación."
        : error.message;
    return { ok: false, error: mensaje };
  }

  fase.actual = "registrar el cambio de dirección";
  if (previa && (previa.slug !== slugLimpio || (previa.dominio ?? "") !== (dominioLimpio || ""))) {
    await registrarAccion(supabase, quien, "invitacion:direccion", "invitacion", invitacionId, {
      slug: slugLimpio, dominio: dominioLimpio || null,
    });
  }

  // Los datos YA están guardados. Si refrescar la página fallara, no debe
  // leerse como que el guardado falló.
  try {
    revalidatePath(`/panel/invitaciones/${invitacionId}`);
  } catch (e) {
    registrarError("invitacion", e, { invitacion: invitacionId, fase: "revalidar" });
  }
  return { ok: true };
}

/**
 * Guarda los cambios del editor.
 *
 * Nunca lanza: en producción Next esconde el mensaje de un error de
 * servidor y el navegador solo recibe «An error occurred…», lo que dejó al
 * equipo sin saber qué falló (ni dónde) al guardar un HTML pegado. Aquí se
 * atrapa, se registra con su fase y se devuelve el motivo para que salga
 * en el editor. Es un panel interno: el mensaje es para el equipo.
 */
export async function guardarInvitacion(
  invitacionId: string,
  datos: DatosInvitacion,
  slug: string,
  plantilla: string,
  codigoHtml?: string | null,
  dominio?: string | null
): Promise<{ ok: boolean; error?: string }> {
  const fase = { actual: "empezar" };
  try {
    return await guardarInvitacionInterno(fase, invitacionId, datos, slug, plantilla, codigoHtml, dominio);
  } catch (e) {
    registrarError("invitacion", e, { invitacion: invitacionId, fase: fase.actual });
    const motivo = (e instanceof Error ? e.message : String(e)).slice(0, 300);
    return { ok: false, error: `No se pudo guardar (al ${fase.actual}): ${motivo}` };
  }
}

/**
 * Publica la invitación: la hace visible al público, guarda la URL en el
 * pedido y lo marca como entregado (calculando el vencimiento del plan).
 */
export async function publicarInvitacion(invitacionId: string) {
  const supabase = await crearClienteServidor();
  const quien = await exigirPermiso(supabase, "publicar");

  const { data: invitacion } = await supabase
    .from("invitaciones")
    .select("*, pedidos(*)")
    .eq("id", invitacionId)
    .single();
  if (!invitacion) throw new Error("Invitación no encontrada");

  await supabase
    .from("invitaciones")
    .update({ estado: "publicada", publicada_en: new Date().toISOString() })
    .eq("id", invitacionId);

  // Actualizar el pedido: URL entregada + estado entregada + vencimiento
  const pedido = invitacion.pedidos;
  const urlBase = resolverUrlBase();
  // Si el cliente pagó su dominio, la dirección que se le entrega es esa.
  const cambios: Record<string, unknown> = {
    url_entregada: invitacion.dominio
      ? `https://${invitacion.dominio}`
      : `${urlBase}/i/${invitacion.slug}`,
  };

  if (!["entregada", "activa", "vencida"].includes(pedido.estado)) {
    cambios.estado = "entregada";
    if (!pedido.fecha_entrega) {
      const hoy = new Date().toISOString().slice(0, 10);
      cambios.fecha_entrega = hoy;
      cambios.fecha_vencimiento = calcularVencimiento(hoy, pedido.plan as Plan);
    }
  }

  await supabase.from("pedidos").update(cambios).eq("id", pedido.id);

  await registrarCambioEstado(
    supabase, quien, "invitacion", invitacionId, invitacion.estado, "publicada"
  );
  await registrarAccion(supabase, quien, "invitacion:publicar", "invitacion", invitacionId, {
    slug: invitacion.slug, dominio: invitacion.dominio ?? null,
  });
  if (cambios.estado === "entregada") {
    await registrarCambioEstado(
      supabase, quien, "pedido", pedido.id, pedido.estado, "entregada", "invitación publicada"
    );
  }

  revalidatePath(`/panel/invitaciones/${invitacionId}`);
  revalidatePath(`/panel/pedidos/${pedido.id}`);
  revalidatePath("/panel");
}

/** Regresa la invitación a borrador (deja de ser visible al público). */
export async function despublicarInvitacion(invitacionId: string) {
  const supabase = await crearClienteServidor();
  const quien = await exigirPermiso(supabase, "publicar");
  await supabase
    .from("invitaciones")
    .update({ estado: "borrador" })
    .eq("id", invitacionId);
  await registrarCambioEstado(supabase, quien, "invitacion", invitacionId, "publicada", "borrador");
  await registrarAccion(supabase, quien, "invitacion:despublicar", "invitacion", invitacionId);
  revalidatePath(`/panel/invitaciones/${invitacionId}`);
}
