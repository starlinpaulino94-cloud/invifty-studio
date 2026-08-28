import { NextRequest, NextResponse } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { haySesion } from "@/lib/sesion";
import { aCsv, nombreArchivo, type ColumnaCsv } from "@/lib/exportar";
import { PLANES, TIPOS_EVENTO, nombreEstado } from "@/lib/planes";
import type { EstadoPedido, Plan, TipoEvento } from "@/lib/tipos";

/**
 * EXPORTAR A CSV — /api/panel/exportar?tipo=pedidos|pagos|clientes
 * =================================================================
 * Para la contabilidad. Doble cerradura: la sesión se comprueba aquí, y
 * las consultas van con el cliente de SESIÓN — si quien pide no es del
 * equipo, el RLS le devuelve un archivo vacío, no los datos de nadie.
 */

export async function GET(req: NextRequest) {
  if (!(await haySesion())) {
    return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  }

  const tipo = req.nextUrl.searchParams.get("tipo") ?? "pedidos";
  const supabase = await crearClienteServidor();
  let csv: string;

  if (tipo === "pagos") {
    const { data } = await supabase
      .from("pagos")
      .select("fecha, fecha_efectiva, monto, tipo, metodo, referencia, anulado_en, usuario_email, pedidos(clientes(nombre))")
      .order("fecha", { ascending: false })
      .limit(10000);
    type Fila = {
      fecha: string; fecha_efectiva: string | null; monto: number; tipo: string;
      metodo: string | null; referencia: string | null; anulado_en: string | null;
      usuario_email: string | null;
      pedidos: { clientes: { nombre: string } | null } | null;
    };
    const columnas: ColumnaCsv<Fila>[] = [
      { titulo: "Fecha", valor: (p) => p.fecha?.slice(0, 10) },
      { titulo: "Fecha efectiva", valor: (p) => p.fecha_efectiva },
      { titulo: "Cliente", valor: (p) => p.pedidos?.clientes?.nombre },
      { titulo: "Monto (DOP)", valor: (p) => Number(p.monto) },
      { titulo: "Tipo", valor: (p) => p.tipo },
      { titulo: "Método", valor: (p) => p.metodo },
      { titulo: "Referencia", valor: (p) => p.referencia },
      { titulo: "Anulado", valor: (p) => (p.anulado_en ? "sí" : "") },
      { titulo: "Registró", valor: (p) => p.usuario_email },
    ];
    csv = aCsv(((data ?? []) as unknown as Fila[]), columnas);
  } else if (tipo === "clientes") {
    const { data } = await supabase
      .from("clientes")
      .select("nombre, telefono, email, como_nos_conocio, creado_en")
      .order("creado_en", { ascending: false })
      .limit(10000);
    type Fila = {
      nombre: string; telefono: string; email: string | null;
      como_nos_conocio: string | null; creado_en: string;
    };
    const columnas: ColumnaCsv<Fila>[] = [
      { titulo: "Nombre", valor: (c) => c.nombre },
      { titulo: "Teléfono", valor: (c) => c.telefono },
      { titulo: "Correo", valor: (c) => c.email },
      { titulo: "Cómo nos conoció", valor: (c) => c.como_nos_conocio },
      { titulo: "Registrado", valor: (c) => c.creado_en?.slice(0, 10) },
    ];
    csv = aCsv(((data ?? []) as Fila[]), columnas);
  } else {
    const { data } = await supabase
      .from("pedidos")
      .select("creado_en, tipo_evento, plan, estado, precio, fecha_evento, fecha_entrega, fecha_vencimiento, clientes(nombre, telefono)")
      .order("creado_en", { ascending: false })
      .limit(10000);
    type Fila = {
      creado_en: string; tipo_evento: string; plan: string; estado: string;
      precio: number; fecha_evento: string | null; fecha_entrega: string | null;
      fecha_vencimiento: string | null;
      clientes: { nombre: string; telefono: string } | null;
    };
    const columnas: ColumnaCsv<Fila>[] = [
      { titulo: "Creado", valor: (p) => p.creado_en?.slice(0, 10) },
      { titulo: "Cliente", valor: (p) => p.clientes?.nombre },
      { titulo: "Teléfono", valor: (p) => p.clientes?.telefono },
      { titulo: "Evento", valor: (p) => TIPOS_EVENTO[p.tipo_evento as TipoEvento] ?? p.tipo_evento },
      { titulo: "Plan", valor: (p) => PLANES[p.plan as Plan]?.nombre ?? p.plan },
      { titulo: "Estado", valor: (p) => nombreEstado(p.estado as EstadoPedido) },
      { titulo: "Precio (DOP)", valor: (p) => Number(p.precio) },
      { titulo: "Fecha del evento", valor: (p) => p.fecha_evento },
      { titulo: "Entregada", valor: (p) => p.fecha_entrega },
      { titulo: "Vence", valor: (p) => p.fecha_vencimiento },
    ];
    csv = aCsv(((data ?? []) as unknown as Fila[]), columnas);
  }

  const archivo = nombreArchivo(tipo === "pagos" ? "pagos" : tipo === "clientes" ? "clientes" : "pedidos", new Date());
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${archivo}"`,
      "Cache-Control": "no-store",
    },
  });
}
