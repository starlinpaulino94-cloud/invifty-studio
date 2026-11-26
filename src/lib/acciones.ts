"use server";

import { normalizarTelefono } from "@/lib/telefono";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "./supabase/servidor";
import { calcularVencimiento } from "./vencimientos";
import { transicionValida } from "./estados";
import { fechaEfectivaValida, motivoRechazoTransaccion } from "./pagos";
import { snapshotDeContrato } from "./capacidades";
import { CONFIRMACION_ELIMINAR, confirmacionCorrecta } from "./eliminar";
import { errorClienteDistinto, mismaPersona } from "./clientes";
import { PLANES, TIPOS_EVENTO } from "./planes";
import { exigirPermiso, registrarAccion, registrarCambioEstado } from "./auditoria";
import { crearClienteAdmin } from "./supabase/admin";
import { BUCKET } from "./fotos";
import { registrarError } from "./registro";
import type { EstadoPedido, Pago, Plan } from "./tipos";


/** Crea (o reutiliza) el cliente, crea el pedido y genera su formulario con token. */
export async function crearPedido(formData: FormData) {
  const supabase = await crearClienteServidor();
  const quien = await exigirPermiso(supabase, "crear_pedidos");

  const nombre = String(formData.get("nombre") ?? "").trim();
  const telefono = normalizarTelefono(String(formData.get("telefono") ?? ""));
  const email = String(formData.get("email") ?? "").trim() || null;
  const como = String(formData.get("como_nos_conocio") ?? "").trim() || null;
  const tipoEvento = String(formData.get("tipo_evento") ?? "boda");
  const plan = String(formData.get("plan") ?? "popular");
  const extras = formData.getAll("extras").map(String);
  const fechaEvento = String(formData.get("fecha_evento") ?? "") || null;
  const precio = Number(formData.get("precio") ?? 0);
  const notas = String(formData.get("notas") ?? "").trim() || null;

  if (!nombre || !telefono) throw new Error("Nombre y teléfono son obligatorios");

  // Cliente: buscar por teléfono o crear.
  //
  // Un WhatsApp = una persona: si el número ya tiene ficha, el pedido se
  // suma a ESA ficha en vez de duplicar al cliente. Pero reutilizar en
  // silencio hizo perder una tarde: se creaban pedidos "de Camila" que
  // salían a nombre de un cliente de prueba porque el número era el de la
  // prueba. Ahora, si el nombre tecleado no se parece al guardado, hay que
  // decir a la cara que es la misma persona (lib/clientes.ts).
  let clienteId: string;
  const { data: existente } = await supabase
    .from("clientes")
    .select("id, nombre")
    .eq("telefono", telefono)
    .maybeSingle();

  if (existente) {
    const confirmado = String(formData.get("misma_persona") ?? "") === "si";
    if (!confirmado && !mismaPersona(nombre, existente.nombre)) {
      throw new Error(errorClienteDistinto(existente.nombre, telefono));
    }
    clienteId = existente.id;
  } else {
    const { data: nuevo, error } = await supabase
      .from("clientes")
      .insert({ nombre, telefono, email, como_nos_conocio: como })
      .select("id")
      .single();
    if (error) throw new Error(`No se pudo crear el cliente: ${error.message}`);
    clienteId = nuevo.id;
  }

  // Pedido, con la FOTO del contrato congelada: lo que este cliente
  // contrató hoy no se mueve si mañana cambia el catálogo. Si la columna
  // aún no está migrada, el pedido entra igual y se anota qué falta.
  const filaPedido = {
    cliente_id: clienteId,
    tipo_evento: tipoEvento,
    plan,
    extras,
    fecha_evento: fechaEvento,
    precio,
    notas,
    estado: "nuevo",
  };
  let { data: pedido, error: errorPedido } = await supabase
    .from("pedidos")
    .insert({
      ...filaPedido,
      capacidades_contratadas: snapshotDeContrato(plan as Plan, new Date()),
    })
    .select("id")
    .single();
  if (errorPedido && /column|capacidades_contratadas|schema/i.test(errorPedido.message)) {
    registrarError("pedidos", errorPedido, {
      nota: "falta la migración 20260814090000_portal-cuentas; pedido sin foto del contrato",
    });
    ({ data: pedido, error: errorPedido } = await supabase
      .from("pedidos")
      .insert(filaPedido)
      .select("id")
      .single());
  }
  if (errorPedido || !pedido) {
    throw new Error(`No se pudo crear el pedido: ${errorPedido?.message ?? "sin respuesta"}`);
  }

  // Formulario con token único
  const token = crypto.randomUUID().replace(/-/g, "");
  const { error: errorForm } = await supabase
    .from("formularios")
    .insert({ pedido_id: pedido.id, token });
  if (errorForm) throw new Error(`No se pudo crear el formulario: ${errorForm.message}`);

  await registrarAccion(supabase, quien, "pedido:crear", "pedido", pedido.id, {
    plan, precio, tipo_evento: tipoEvento,
  });

  revalidatePath("/panel");
  redirect(`/panel/pedidos/${pedido.id}?nuevo=1`);
}

/**
 * Cambia el estado del pedido. Valida la transición EN EL SERVIDOR (el
 * selector del panel ya solo ofrece las posibles, pero esconder botones no
 * es validación), deja el cambio en el historial inmutable, y al marcar
 * "entregada" calcula el vencimiento según el plan.
 */
export async function cambiarEstado(pedidoId: string, estado: EstadoPedido) {
  const supabase = await crearClienteServidor();
  const quien = await exigirPermiso(supabase, "cambiar_estado");

  const { data: pedido } = await supabase
    .from("pedidos")
    .select("estado, plan, fecha_entrega")
    .eq("id", pedidoId)
    .single();
  if (!pedido) throw new Error("Pedido no encontrado");

  const estadoActual = pedido.estado as EstadoPedido;
  if (estadoActual === estado) return;
  if (!transicionValida(estadoActual, estado)) {
    throw new Error(
      `Un pedido "${estadoActual}" no puede pasar directo a "${estado}". ` +
        "Si de verdad hace falta, ve paso por paso — así el historial cuenta lo que pasó."
    );
  }

  const cambios: Record<string, unknown> = { estado };

  if (estado === "entregada" && !pedido.fecha_entrega) {
    const hoy = new Date().toISOString().slice(0, 10);
    cambios.fecha_entrega = hoy;
    cambios.fecha_vencimiento = calcularVencimiento(hoy, pedido.plan as Plan);
  }

  const { error } = await supabase.from("pedidos").update(cambios).eq("id", pedidoId);
  if (error) throw new Error(error.message);

  await registrarCambioEstado(supabase, quien, "pedido", pedidoId, estadoActual, estado);

  revalidatePath("/panel");
  revalidatePath(`/panel/pedidos/${pedidoId}`);
}

/** Marca el formulario como enviado (se usa al copiar el mensaje de WhatsApp). */
export async function marcarFormularioEnviado(pedidoId: string) {
  const supabase = await crearClienteServidor();
  const { data: pedido } = await supabase
    .from("pedidos")
    .select("estado")
    .eq("id", pedidoId)
    .single();

  if (pedido?.estado === "nuevo") {
    const quien = await exigirPermiso(supabase, "cambiar_estado");
    await supabase.from("pedidos").update({ estado: "formulario_enviado" }).eq("id", pedidoId);
    await registrarCambioEstado(
      supabase, quien, "pedido", pedidoId, "nuevo", "formulario_enviado",
      "enlace del formulario copiado"
    );
    revalidatePath("/panel");
    revalidatePath(`/panel/pedidos/${pedidoId}`);
  }
}

/** Tipos de comprobante que aceptamos: lo que un banco o Zelle exporta. */
const COMPROBANTE_TIPOS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};
const COMPROBANTE_MAX_MB = 8;

/**
 * Registra una transacción del pedido: pago, reembolso o ajuste.
 *
 * Las reglas que protegen la caja (lib/pagos.ts): el monto entra
 * positivo y el TIPO dice si suma o resta; un reembolso jamás supera lo
 * neto en caja; la fecha efectiva no vive en el futuro; y el doble clic
 * no crea dos pagos (clave de idempotencia única). Todo firmado: quién
 * registró queda en la fila, y el comprobante —si viene— en el bucket
 * privado de siempre.
 */
export async function registrarPago(pedidoId: string, formData: FormData) {
  const supabase = await crearClienteServidor();
  const quien = await exigirPermiso(supabase, "registrar_pagos");
  const monto = Number(formData.get("monto") ?? 0);
  const tipo = String(formData.get("tipo") ?? "pago").trim() || "pago";
  const metodo = String(formData.get("metodo") ?? "").trim() || null;
  const nota = String(formData.get("nota") ?? "").trim() || null;
  const referencia = String(formData.get("referencia") ?? "").trim().slice(0, 80) || null;
  const fechaEfectiva = String(formData.get("fecha_efectiva") ?? "").trim();
  const claveIdempotencia = String(formData.get("clave_idempotencia") ?? "").trim() || null;

  // Reembolsar exige el permiso de anular: devolver dinero pesa igual.
  if (tipo === "reembolso") await exigirPermiso(supabase, "anular_pagos");

  const { data: previosData } = await supabase
    .from("pagos")
    .select("monto, tipo, anulado_en")
    .eq("pedido_id", pedidoId);
  const previos = (previosData ?? []) as Pick<Pago, "monto" | "tipo" | "anulado_en">[];

  const rechazo = motivoRechazoTransaccion(tipo, monto, previos);
  if (rechazo) throw new Error(rechazo);
  if (!fechaEfectivaValida(fechaEfectiva, new Date())) {
    throw new Error("La fecha efectiva no puede estar en el futuro.");
  }

  // El comprobante se sube ANTES de insertar para guardar su ruta en la
  // misma fila. Va al bucket privado bajo comprobantes/<pedido>/.
  let comprobanteRuta: string | null = null;
  const comprobante = formData.get("comprobante");
  if (comprobante instanceof File && comprobante.size > 0) {
    const extension = COMPROBANTE_TIPOS[comprobante.type];
    if (!extension) throw new Error("El comprobante debe ser JPG, PNG, WEBP o PDF.");
    if (comprobante.size > COMPROBANTE_MAX_MB * 1024 * 1024) {
      throw new Error(`El comprobante no puede pasar de ${COMPROBANTE_MAX_MB} MB.`);
    }
    const admin = crearClienteAdmin();
    comprobanteRuta = `comprobantes/${pedidoId}/${crypto.randomUUID()}.${extension}`;
    const { error: errorSubida } = await admin.storage
      .from(BUCKET)
      .upload(comprobanteRuta, comprobante, { contentType: comprobante.type });
    if (errorSubida) throw new Error(`No se pudo subir el comprobante: ${errorSubida.message}`);
  }

  const filaCompleta = {
    pedido_id: pedidoId,
    monto,
    tipo,
    metodo,
    nota,
    referencia,
    fecha_efectiva: fechaEfectiva || null,
    usuario_id: quien.id,
    usuario_email: quien.email,
    clave_idempotencia: claveIdempotencia,
    comprobante_ruta: comprobanteRuta,
  };

  let { data: pago, error } = await supabase
    .from("pagos")
    .insert(filaCompleta)
    .select("id")
    .single();

  // El doble clic choca con el índice de idempotencia: la transacción ya
  // quedó registrada la primera vez, así que no es un error.
  if (error?.code === "23505" && claveIdempotencia) {
    revalidatePath(`/panel/pedidos/${pedidoId}`);
    return;
  }

  // Base sin la migración de pagos-completos: se registra a la antigua
  // (sin perder el pago) y se anota en el log qué falta.
  if (error && /column|comprobante_ruta|referencia|schema/i.test(error.message)) {
    registrarError("pagos", error, { nota: "falta la migración 20260806010000_pagos-completos" });
    ({ data: pago, error } = await supabase
      .from("pagos")
      .insert({ pedido_id: pedidoId, monto, tipo, metodo, nota })
      .select("id")
      .single());
  }
  if (error || !pago) throw new Error(error?.message ?? "No se pudo registrar");

  await registrarAccion(supabase, quien, `pago:${tipo === "pago" ? "registrar" : tipo}`, "pago", pago.id, {
    pedido_id: pedidoId, monto, metodo, tipo, referencia,
  });

  revalidatePath(`/panel/pedidos/${pedidoId}`);
}

/**
 * Anula un abono anotado por error. ANULA, no borra: el pago queda tachado
 * con motivo y firma, y el balance lo ignora (lib/pagos.ts). Dinero borrado
 * sin rastro es exactamente lo que una auditoría no puede permitirse.
 */
export async function anularPago(pagoId: string, pedidoId: string, motivo: string) {
  const supabase = await crearClienteServidor();
  const quien = await exigirPermiso(supabase, "anular_pagos");

  const limpio = motivo.trim().slice(0, 300);
  if (limpio.length < 3) throw new Error("Di por qué se anula: el motivo queda en el registro.");

  const { error } = await supabase
    .from("pagos")
    .update({
      anulado_en: new Date().toISOString(),
      anulado_por: quien.id,
      motivo_anulacion: limpio,
    })
    .eq("id", pagoId)
    .is("anulado_en", null); // anular dos veces no reescribe la primera firma
  if (error) throw new Error(error.message);

  await registrarAccion(supabase, quien, "pago:anular", "pago", pagoId, {
    pedido_id: pedidoId, motivo: limpio,
  });

  revalidatePath(`/panel/pedidos/${pedidoId}`);
}

/** Guarda la URL de la invitación entregada y las notas internas. */
export async function guardarFicha(pedidoId: string, formData: FormData) {
  const supabase = await crearClienteServidor();
  const url = String(formData.get("url_entregada") ?? "").trim() || null;
  const notas = String(formData.get("notas") ?? "").trim() || null;

  const { error } = await supabase
    .from("pedidos")
    .update({ url_entregada: url, notas })
    .eq("id", pedidoId);
  if (error) throw new Error(error.message);

  revalidatePath(`/panel/pedidos/${pedidoId}`);
}

/**
 * Corrige la ficha del cliente: nombre, teléfono, correo y cómo nos
 * conoció. El teléfono se normaliza igual que al crear — es la llave con
 * la que se reconoce a un cliente que vuelve.
 */
export async function actualizarCliente(clienteId: string, formData: FormData) {
  const supabase = await crearClienteServidor();
  const quien = await exigirPermiso(supabase, "editar_fichas");

  const nombre = String(formData.get("nombre") ?? "").trim();
  const telefono = normalizarTelefono(String(formData.get("telefono") ?? ""));
  const email = String(formData.get("email") ?? "").trim() || null;
  const como = String(formData.get("como_nos_conocio") ?? "").trim() || null;
  if (!nombre || !telefono) throw new Error("Nombre y teléfono son obligatorios.");

  const { error } = await supabase
    .from("clientes")
    .update({ nombre, telefono, email, como_nos_conocio: como })
    .eq("id", clienteId);
  if (error) throw new Error(`No se pudo guardar: ${error.message}`);

  await registrarAccion(supabase, quien, "cliente:editar", "cliente", clienteId, { nombre });
  revalidatePath("/panel");
}

/**
 * Corrige la ficha del pedido: tipo de evento, plan, fecha, precio y
 * extras. Si cambia el PLAN, la foto del contrato se congela otra vez:
 * cambiar de plan ES un contrato nuevo, y eso queda firmado con el plan
 * anterior y el nuevo en la auditoría.
 */
export async function actualizarPedido(pedidoId: string, formData: FormData) {
  const supabase = await crearClienteServidor();
  const quien = await exigirPermiso(supabase, "editar_fichas");

  const tipoEvento = String(formData.get("tipo_evento") ?? "");
  const plan = String(formData.get("plan") ?? "");
  const fechaEvento = String(formData.get("fecha_evento") ?? "") || null;
  const precio = Number(formData.get("precio") ?? 0);
  const extras = formData.getAll("extras").map(String);

  if (!(tipoEvento in TIPOS_EVENTO)) throw new Error("Tipo de evento no válido.");
  if (!(plan in PLANES)) throw new Error("Plan no válido.");
  if (!Number.isFinite(precio) || precio < 0) throw new Error("El precio no es válido.");

  const { data: anterior } = await supabase
    .from("pedidos")
    .select("plan")
    .eq("id", pedidoId)
    .single();
  if (!anterior) throw new Error("Ese pedido no existe.");

  const cambioDePlan = anterior.plan !== plan;
  const fila: Record<string, unknown> = {
    tipo_evento: tipoEvento, plan, fecha_evento: fechaEvento, precio, extras,
  };
  // El contrato cambió: la foto se toma de nuevo, del catálogo de HOY.
  if (cambioDePlan) fila.capacidades_contratadas = snapshotDeContrato(plan as Plan, new Date());

  let { error } = await supabase.from("pedidos").update(fila).eq("id", pedidoId);
  if (error && cambioDePlan && /column|capacidades_contratadas|schema/i.test(error.message)) {
    registrarError("pedidos", error, { nota: "sin columna de contrato; pedido editado sin foto" });
    delete fila.capacidades_contratadas;
    ({ error } = await supabase.from("pedidos").update(fila).eq("id", pedidoId));
  }
  if (error) throw new Error(`No se pudo guardar: ${error.message}`);

  await registrarAccion(supabase, quien, "pedido:editar", "pedido", pedidoId, {
    plan, precio, tipo_evento: tipoEvento,
    ...(cambioDePlan ? { plan_anterior: anterior.plan, contrato_recongelado: true } : {}),
  });
  revalidatePath(`/panel/pedidos/${pedidoId}`);
}

/**
 * Borra el pedido PARA SIEMPRE, con todo lo suyo: formularios, pagos,
 * invitación, confirmaciones, invitados y las fotos del Storage. Solo
 * con el permiso eliminar_datos (hoy: el propietario), escribiendo la
 * confirmación. La auditoría se escribe ANTES — su fila no tiene FK al
 * pedido, así que sobrevive y cuenta qué había.
 */
export async function eliminarPedido(pedidoId: string, confirmacion: string) {
  const supabase = await crearClienteServidor();
  const quien = await exigirPermiso(supabase, "eliminar_datos");
  if (!confirmacionCorrecta(confirmacion)) {
    throw new Error(`Escribe ${CONFIRMACION_ELIMINAR} para confirmar.`);
  }

  const { data: pedido } = await supabase
    .from("pedidos")
    .select("id, plan, precio, estado, clientes(nombre), invitaciones(id, slug)")
    .eq("id", pedidoId)
    .maybeSingle();
  if (!pedido) throw new Error("Ese pedido no existe.");
  const invitacion = (pedido.invitaciones as { id: string; slug: string }[] | null)?.[0];

  // El rastro, ANTES de que desaparezca contra qué escribirlo.
  await registrarAccion(supabase, quien, "pedido:eliminar", "pedido", pedidoId, {
    cliente: (pedido.clientes as unknown as { nombre: string } | null)?.nombre ?? null,
    plan: pedido.plan, precio: Number(pedido.precio), estado: pedido.estado,
    slug: invitacion?.slug ?? null,
  });

  // Las fotos del Storage no van en la cascada de la base: se barren a
  // mano, mejor-esfuerzo — un archivo huérfano no justifica dejar vivo
  // el pedido si el borrado de abajo sí funciona.
  const admin = crearClienteAdmin();
  try {
    const rutas: string[] = [];
    for (const carpeta of [
      pedidoId, `${pedidoId}/derivados`, `comprobantes/${pedidoId}`,
      ...(invitacion ? [`referencias/${invitacion.id}`] : []),
    ]) {
      const { data: archivos } = await admin.storage.from(BUCKET).list(carpeta, { limit: 1000 });
      for (const archivo of archivos ?? []) {
        if (archivo.id) rutas.push(`${carpeta}/${archivo.name}`);
      }
    }
    if (rutas.length) await admin.storage.from(BUCKET).remove(rutas);
  } catch (e) {
    registrarError("fotos", e, { nota: "limpieza de storage al eliminar pedido", pedidoId });
  }

  const { error } = await supabase.from("pedidos").delete().eq("id", pedidoId);
  if (error) throw new Error(`No se pudo eliminar: ${error.message}`);

  revalidatePath("/panel");
  redirect("/panel?eliminado=1");
}

/**
 * Borra un cliente PARA SIEMPRE — solo cuando ya no tiene pedidos, para
 * que nadie borre "un cliente" sin haber visto primero todo lo que se
 * lleva. Si tenía cuenta del portal, su usuario de auth también se va.
 */
export async function eliminarCliente(clienteId: string, confirmacion: string) {
  const supabase = await crearClienteServidor();
  const quien = await exigirPermiso(supabase, "eliminar_datos");
  if (!confirmacionCorrecta(confirmacion)) {
    throw new Error(`Escribe ${CONFIRMACION_ELIMINAR} para confirmar.`);
  }

  const { data: cliente } = await supabase
    .from("clientes")
    .select("id, nombre")
    .eq("id", clienteId)
    .maybeSingle();
  if (!cliente) throw new Error("Ese cliente no existe.");

  const { count } = await supabase
    .from("pedidos")
    .select("id", { count: "exact", head: true })
    .eq("cliente_id", clienteId);
  if ((count ?? 0) > 0) {
    throw new Error(
      `Este cliente tiene ${count} pedido${count === 1 ? "" : "s"}: elimínalos primero desde su ficha.`
    );
  }

  await registrarAccion(supabase, quien, "cliente:eliminar", "cliente", clienteId, {
    nombre: cliente.nombre,
  });

  // Su usuario del portal, si activó cuenta: fuera también.
  const admin = crearClienteAdmin();
  const { data: cuenta } = await admin
    .from("cuentas_cliente")
    .select("usuario_id")
    .eq("cliente_id", clienteId)
    .maybeSingle();
  if (cuenta?.usuario_id) {
    const { error: errorUsuario } = await admin.auth.admin.deleteUser(cuenta.usuario_id);
    if (errorUsuario) registrarError("cuentas", errorUsuario, { nota: "deleteUser al eliminar cliente" });
  }

  const { error } = await supabase.from("clientes").delete().eq("id", clienteId);
  if (error) throw new Error(`No se pudo eliminar: ${error.message}`);

  revalidatePath("/panel/clientes");
}

/**
 * El enlace de cobro del pedido (/pagar/<token>): lo genera una vez y lo
 * reutiliza siempre — un enlace que cambia rompería chats viejos.
 */
export async function generarEnlaceCobro(pedidoId: string) {
  const supabase = await crearClienteServidor();
  await exigirPermiso(supabase, "registrar_pagos");

  const { data: pedido } = await supabase
    .from("pedidos")
    .select("token_cobro")
    .eq("id", pedidoId)
    .maybeSingle();
  if (!pedido) throw new Error("Ese pedido no existe.");
  if (pedido.token_cobro) return { token: pedido.token_cobro };

  const token = crypto.randomUUID().replace(/-/g, "");
  const { error } = await supabase
    .from("pedidos")
    .update({ token_cobro: token })
    .eq("id", pedidoId);
  if (error) {
    throw new Error(
      /column|token_cobro|schema/i.test(error.message)
        ? "Falta correr la migración 20260827090000_cobro-transferencia en Supabase."
        : `No se pudo generar el enlace: ${error.message}`
    );
  }
  revalidatePath(`/panel/pedidos/${pedidoId}`);
  return { token };
}

/**
 * Confirma un pago reportado: lo REVISASTE contra el banco y es real.
 * Se vuelve fila de `pagos` con clave de idempotencia — confirmar dos
 * veces el mismo reporte no duplica el dinero.
 */
export async function confirmarPagoReportado(reporteId: string, pedidoId: string) {
  const supabase = await crearClienteServidor();
  const quien = await exigirPermiso(supabase, "registrar_pagos");

  const { data: reporte } = await supabase
    .from("pagos_reportados")
    .select("id, pedido_id, monto, referencia, comprobante_ruta, estado")
    .eq("id", reporteId)
    .eq("pedido_id", pedidoId)
    .maybeSingle();
  if (!reporte) throw new Error("Ese reporte no existe.");
  if (reporte.estado !== "pendiente") throw new Error("Ese reporte ya se revisó.");

  const { error } = await supabase.from("pagos").insert({
    pedido_id: reporte.pedido_id,
    monto: Number(reporte.monto),
    tipo: "pago",
    metodo: "transferencia",
    referencia: reporte.referencia,
    comprobante_ruta: reporte.comprobante_ruta,
    usuario_id: quien.id,
    usuario_email: quien.email,
    clave_idempotencia: `reporte:${reporte.id}`,
  });
  // 23505 = la idempotencia chocó: el pago YA se registró en un intento
  // anterior; solo falta cerrar el reporte.
  if (error && error.code !== "23505") {
    throw new Error(`No se pudo registrar el pago: ${error.message}`);
  }

  const { error: errorReporte } = await supabase
    .from("pagos_reportados")
    .update({
      estado: "confirmado",
      revisado_en: new Date().toISOString(),
      revisado_por_email: quien.email,
    })
    .eq("id", reporte.id)
    .eq("estado", "pendiente");
  if (errorReporte) registrarError("cobro", errorReporte, { nota: "pago registrado, reporte sin cerrar" });

  await registrarAccion(supabase, quien, "pago:confirmar_reporte", "pedido", reporte.pedido_id, {
    monto: Number(reporte.monto), referencia: reporte.referencia,
  });
  revalidatePath(`/panel/pedidos/${reporte.pedido_id}`);
}

/** Rechaza un reporte que no cuadra con el banco, con el motivo a la cara. */
export async function rechazarPagoReportado(reporteId: string, pedidoId: string, motivo: string) {
  const supabase = await crearClienteServidor();
  const quien = await exigirPermiso(supabase, "registrar_pagos");

  const limpio = motivo.trim().slice(0, 200);
  if (!limpio) throw new Error("Escribe el motivo: el cliente lo va a leer.");

  const { data: filas, error } = await supabase
    .from("pagos_reportados")
    .update({
      estado: "rechazado",
      motivo_rechazo: limpio,
      revisado_en: new Date().toISOString(),
      revisado_por_email: quien.email,
    })
    .eq("id", reporteId)
    .eq("pedido_id", pedidoId)
    .eq("estado", "pendiente")
    .select("id");
  if (error) throw new Error(`No se pudo rechazar: ${error.message}`);
  if (!filas?.length) throw new Error("Ese reporte no existe o ya se revisó.");

  await registrarAccion(supabase, quien, "pago:rechazar_reporte", "pedido", pedidoId, {
    motivo: limpio,
  });
  revalidatePath(`/panel/pedidos/${pedidoId}`);
}

/** Cierra la sesión del panel. */
export async function cerrarSesion() {
  const supabase = await crearClienteServidor();
  await supabase.auth.signOut();
  redirect("/login");
}
