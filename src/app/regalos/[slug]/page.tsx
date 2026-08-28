import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { contratoDePedido } from "@/lib/capacidades";
import { sanearCuentasRegalo, tieneMesaRegalos } from "@/lib/regalos";
import RegistrarRegalo from "@/components/regalos/RegistrarRegalo";
import type { DatosInvitacion } from "@/lib/tipos";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mesa de regalos — Invifty",
  description: "Los datos para tu regalo y tu mensaje para los anfitriones.",
  robots: { index: false, follow: false },
};

/**
 * LA MESA DE REGALOS — /regalos/<slug>
 * =====================================
 * Pública como la invitación. Enseña las cuentas del ANFITRIÓN (con
 * copiar campo a campo) y deja registrar el regalo con un mensaje.
 * Los aportes de otros NO se listan: los montos son privados del
 * anfitrión, y la página jamás los consulta.
 */
export default async function PaginaRegalos({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const admin = crearClienteAdmin();

  const { data: invitacion } = await admin
    .from("invitaciones")
    .select("id, estado, datos, cuentas_regalo, pedidos(extras, plan, capacidades_contratadas)")
    .eq("slug", slug)
    .maybeSingle();

  const pedido = invitacion?.pedidos as unknown as {
    extras: string[]; plan: string; capacidades_contratadas: unknown;
  } | null;
  if (
    !invitacion ||
    !pedido ||
    invitacion.estado !== "publicada" ||
    !tieneMesaRegalos(contratoDePedido(pedido))
  ) {
    notFound();
  }

  const datos = (invitacion.datos ?? {}) as DatosInvitacion;
  const cuentas = sanearCuentasRegalo(invitacion.cuentas_regalo);
  // Las opciones de regalo en texto que el equipo puso en la invitación
  // (mesa en tienda, lluvia de sobres…) también salen aquí.
  const opciones = (datos.regalos ?? []).filter((r) => r?.titulo);

  return (
    <div className="min-h-dvh bg-[#0D0D0F] px-4 py-10">
      <div className="max-w-md mx-auto space-y-6">
        <div className="text-center">
          <span className="text-[10px] uppercase tracking-[0.4em] text-[#D4AF37] font-semibold">
            Mesa de regalos
          </span>
          <h1 className="font-serif text-3xl text-white mt-2 text-balance">
            {datos.titulo || "Nuestro evento"}
          </h1>
          <p className="text-white/40 text-sm mt-2">
            Tu presencia es el mejor regalo. Si además deseas hacernos uno,
            aquí está todo.
          </p>
        </div>

        {opciones.length > 0 && (
          <div className="bg-white/5 border border-white/10 rounded-3xl p-5 space-y-3">
            {opciones.map((r, i) => (
              <div key={i}>
                <p className="text-white/80 text-sm font-semibold">{r.titulo}</p>
                {r.detalle && <p className="text-white/40 text-xs mt-0.5">{r.detalle}</p>}
              </div>
            ))}
          </div>
        )}

        <RegistrarRegalo slug={slug} cuentas={cuentas} />

        <p className="text-white/20 text-[11px] text-center">
          Invifty · tu registro solo lo ven los anfitriones
        </p>
      </div>
    </div>
  );
}
