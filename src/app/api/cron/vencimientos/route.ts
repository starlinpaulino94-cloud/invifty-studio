import { NextRequest, NextResponse } from "next/server";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { secretoCron } from "@/lib/entorno";
import { repasarVencimientos, diasHasta, type PedidoVigencia } from "@/lib/vencimientos";
import { notificarVencimientosProximos } from "@/lib/notificaciones";
import { procesarAvisosPendientes } from "@/lib/avisos";
import type { Plan } from "@/lib/tipos";

/**
 * REPASO DIARIO DE VENCIMIENTOS
 * ==============================
 * Lo llama Vercel una vez al día. El horario está en `vercel.json`:
 * 13:00 UTC, que son las 9:00 de la mañana en República Dominicana. Se
 * eligió esa hora para que el día natural en RD coincida con el día UTC
 * que usan los cálculos de `lib/vencimientos.ts`.
 * (Ese archivo no admite comentarios: Vercel valida su esquema y rechaza
 * cualquier propiedad de más, incluida una clave "//".)
 *
 * Hace dos cosas:
 *
 *  1. Marca como "vencida" toda invitación cuya fecha ya pasó. Antes ningún
 *     pedido llegaba nunca a ese estado por sí solo: se quedaban en
 *     "entregada" para siempre y el estado "vencida" era papel mojado.
 *  2. Manda UN correo al equipo con las que están por vencer, para que
 *     ofrezcan la renovación a tiempo. Cada pedido se avisa una sola vez.
 *
 * Protegida con CRON_SECRET: es una ruta que escribe en la base de datos y
 * no puede quedar abierta a cualquiera.
 */

type PedidoRepaso = PedidoVigencia & {
  plan: Plan;
  clientes: { nombre: string } | null;
};

function autorizado(req: NextRequest): boolean {
  const secreto = secretoCron();
  // Sin secreto configurado la ruta queda cerrada, no abierta.
  if (!secreto) return false;
  return req.headers.get("authorization") === `Bearer ${secreto}`;
}

export async function GET(req: NextRequest) {
  if (!autorizado(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const supabase = crearClienteAdmin();

  const { data, error } = await supabase
    .from("pedidos")
    .select("id, estado, plan, fecha_vencimiento, aviso_vencimiento_en, clientes(nombre)")
    .not("fecha_vencimiento", "is", null)
    .in("estado", ["entregada", "activa"]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const pedidos = (data ?? []) as unknown as PedidoRepaso[];
  const hoy = new Date();
  const { aMarcarVencidas, aAvisar } = repasarVencimientos(pedidos, hoy);

  // 1. Las que ya pasaron de fecha
  if (aMarcarVencidas.length) {
    await supabase
      .from("pedidos")
      .update({ estado: "vencida" })
      .in("id", aMarcarVencidas.map((p) => p.id));
  }

  // 2. Aviso al equipo de las que están por vencer
  let avisadas = 0;
  if (aAvisar.length) {
    const enviado = await notificarVencimientosProximos(
      aAvisar.map((p) => ({
        pedidoId: p.id,
        nombreCliente: p.clientes?.nombre ?? "Cliente",
        plan: p.plan,
        fechaVencimiento: p.fecha_vencimiento!,
        diasRestantes: diasHasta(p.fecha_vencimiento!, hoy),
      }))
    );

    // Solo se dan por avisadas si el correo salió de verdad. Si el envío no
    // está configurado o falla, mañana se vuelve a intentar.
    if (enviado) {
      await supabase
        .from("pedidos")
        .update({ aviso_vencimiento_en: hoy.toISOString() })
        .in("id", aAvisar.map((p) => p.id));
      avisadas = aAvisar.length;
    }
  }

  // 3. Barrer la bandeja de salida: los avisos cuyo intento inmediato
  //    falló (Resend caído, deploy a mitad) se reintentan aquí, hasta
  //    agotar sus intentos. Reprocesar no duplica: lo enviado ya no está
  //    pendiente.
  const bandeja = await procesarAvisosPendientes(supabase, 50);

  // 4. Barrer los contadores caducados del freno compartido. Si la tabla
  //    aún no existe, falla en silencio: no es asunto de este repaso.
  await supabase.from("frenos").delete().lt("expira_en", hoy.toISOString());

  return NextResponse.json({
    ok: true,
    revisadas: pedidos.length,
    marcadasVencidas: aMarcarVencidas.length,
    porVencer: aAvisar.length,
    avisadas,
    avisosEnviados: bandeja.enviados,
    avisosFallidos: bandeja.fallidos,
  });
}
