import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import DemoControl from "@/components/panel/DemoControl";
import { plantillaMeta } from "@/config/plantillas";
import { urlBase } from "@/lib/url";
import type { Demo, DatosInvitacion, Pedido } from "@/lib/tipos";
import { Globe, Star, ExternalLink } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * DEMOS PÚBLICAS — qué invitaciones enseña la web de muestra
 * ===========================================================
 * La web pide GET /api/public/demos y recibe exactamente lo que aquí se
 * marque. Solo se listan invitaciones PUBLICADAS: una demo que apunte a un
 * borrador no saldría de todas formas (lib/demos.ts la filtra), así que
 * mejor ni ofrecerla.
 *
 * OJO al marcar: la invitación de un cliente real es SU invitación. Antes
 * de enseñarla de muestra, su permiso — eso no lo valida el sistema, lo
 * valida la palabra dada.
 */

interface InvitacionFila {
  id: string;
  slug: string;
  plantilla: string;
  datos: Pick<DatosInvitacion, "titulo">;
  pedidos: Pick<Pedido, "tipo_evento"> | null;
}

export default async function PaginaDemos() {
  const supabase = await crearClienteServidor();
  const [{ data: invitacionesData }, { data: demosData }] = await Promise.all([
    supabase
      .from("invitaciones")
      .select("id, slug, plantilla, datos, pedidos(tipo_evento)")
      .eq("estado", "publicada")
      .order("creado_en", { ascending: false })
      .limit(100),
    supabase.from("demos").select("*"),
  ]);

  const invitaciones = (invitacionesData ?? []) as unknown as InvitacionFila[];
  const demos = (demosData ?? []) as Demo[];
  const demoDe = (invitacionId: string) => demos.find((d) => d.invitacion_id === invitacionId) ?? null;
  const marcadas = invitaciones.filter((i) => demoDe(i.id));

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="font-serif text-3xl text-gray-900 flex items-center gap-2">
          <Globe className="w-6 h-6 text-[#D4AF37]" /> Demos públicas
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {marcadas.length} de muestra en la web · pide permiso al cliente antes de marcar la suya
        </p>
      </div>

      {invitaciones.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-200 rounded-2xl py-16 text-center text-sm text-gray-400">
          No hay invitaciones publicadas todavía. Publica una y podrás marcarla de demo.
        </div>
      ) : (
        <div className="space-y-3">
          {invitaciones.map((inv) => {
            const demo = demoDe(inv.id);
            return (
              <div key={inv.id} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 flex items-center gap-2">
                      {inv.datos?.titulo || "Sin título"}
                      {demo?.destacada && <Star className="w-3.5 h-3.5 text-[#D4AF37]" />}
                      {demo && (
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                          En la web
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {plantillaMeta(inv.plantilla).nombre} ·{" "}
                      <Link
                        href={`${urlBase()}/i/${inv.slug}`}
                        target="_blank"
                        className="inline-flex items-center gap-1 text-[#B08D2A] hover:underline"
                      >
                        /i/{inv.slug} <ExternalLink className="w-3 h-3" />
                      </Link>
                    </p>
                  </div>
                  <DemoControl
                    invitacionId={inv.id}
                    tipoEventoPedido={inv.pedidos?.tipo_evento ?? "boda"}
                    demo={demo}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
