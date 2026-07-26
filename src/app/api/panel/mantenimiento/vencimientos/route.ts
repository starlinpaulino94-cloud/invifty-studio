import { NextResponse } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { haySesion } from "@/lib/sesion";
import { planificarRecalculo, type PedidoRecalculo } from "@/lib/vencimientos";
import { agruparActualizaciones } from "@/lib/mantenimiento";
import { VIGENCIA_MESES, PLANES } from "@/lib/planes";
import type { Plan } from "@/lib/tipos";

/**
 * RECALCULAR LAS VIGENCIAS DE LOS PEDIDOS YA ENTREGADOS
 * ======================================================
 * Cambiar VIGENCIA_MESES en lib/planes.ts solo afecta a las entregas
 * futuras: los pedidos ya entregados llevan su fecha congelada con la
 * política que hubiera ese día.
 *
 *   GET  → simula. Devuelve la tabla de cambios sin tocar nada.
 *   POST → aplica lo que el GET enseñó.
 *
 * Están separados a propósito: el valor de esta tarea está en mirar la lista
 * antes de decidir, y un solo endpoint que hiciera las dos cosas se
 * dispararía sin querer. Lo mismo hacen `npm run vencimientos:simular` y
 * `vencimientos:aplicar` desde la terminal; las dos vías comparten
 * `planificarRecalculo`, así que no pueden divergir.
 *
 * REGLA DE ORO: solo alarga, nunca acorta — vive en `planificarRecalculo`.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type PedidoConNombre = PedidoRecalculo & {
  clientes: { nombre: string } | { nombre: string }[] | null;
};

/** Supabase devuelve la relación como objeto o como lista según el caso. */
function nombreDe(pedido: PedidoConNombre): string {
  const c = pedido.clientes;
  if (!c) return "Cliente";
  return (Array.isArray(c) ? c[0]?.nombre : c.nombre) ?? "Cliente";
}

async function planificar() {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("pedidos")
    .select("id, plan, estado, fecha_entrega, fecha_vencimiento, clientes(nombre)")
    .not("fecha_entrega", "is", null);

  if (error) return { error: error.message };

  const pedidos = (data ?? []) as unknown as PedidoConNombre[];
  return { supabase, pedidos, plan: planificarRecalculo(pedidos) };
}

/** La misma forma para el simulacro y para la respuesta de aplicar. */
function describir(pedidos: PedidoConNombre[], plan: ReturnType<typeof planificarRecalculo<PedidoConNombre>>) {
  const fila = (c: (typeof plan.aAlargar)[number]) => ({
    id: c.pedido.id,
    cliente: nombreDe(c.pedido),
    plan: PLANES[c.pedido.plan as Plan]?.nombre ?? c.pedido.plan,
    antes: c.antes,
    despues: c.despues,
    revive: c.revive,
  });

  return {
    politica: Object.entries(VIGENCIA_MESES).map(([id, meses]) => ({
      nombre: PLANES[id as Plan]?.nombre ?? id,
      meses,
    })),
    revisados: pedidos.length,
    aAlargar: plan.aAlargar.map(fila),
    seRespetan: plan.seRespetan.map(fila),
    reviven: plan.aAlargar.filter((c) => c.revive).length,
  };
}

/* ---------- Simular ---------- */

export async function GET() {
  if (!(await haySesion())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const resultado = await planificar();
  if (resultado.error) return NextResponse.json({ error: resultado.error }, { status: 500 });

  return NextResponse.json({ ok: true, ...describir(resultado.pedidos!, resultado.plan!) });
}

/* ---------- Aplicar ---------- */

export async function POST() {
  if (!(await haySesion())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const resultado = await planificar();
  if (resultado.error) return NextResponse.json({ error: resultado.error }, { status: 500 });

  const { supabase, pedidos, plan } = resultado;
  const resumen = describir(pedidos!, plan!);

  // Se vuelve a planificar aquí en vez de fiarse de lo que mandó el
  // navegador: si alguien entregó un pedido entre el simulacro y el clic,
  // esta es la foto buena. Por eso el POST no acepta cuerpo.
  const actualizaciones = agruparActualizaciones(plan!.aAlargar);

  let guardados = 0;
  const fallos: string[] = [];

  for (const grupo of actualizaciones) {
    const { error } = await supabase!
      .from("pedidos")
      .update({
        fecha_vencimiento: grupo.fecha,
        // Se limpia el aviso para que el repaso diario vuelva a avisar con la
        // fecha nueva, y se revive el pedido si se había dado por vencido.
        aviso_vencimiento_en: null,
        ...(grupo.revive ? { estado: "activa" } : {}),
      })
      .in("id", grupo.ids);

    if (error) fallos.push(error.message);
    else guardados += grupo.ids.length;
  }

  return NextResponse.json({ ok: true, ...resumen, guardados, escrituras: actualizaciones.length, fallos });
}
