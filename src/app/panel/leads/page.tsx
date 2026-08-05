import { crearClienteServidor } from "@/lib/supabase/servidor";
import LeadTarjeta from "@/components/panel/LeadTarjeta";
import { ESTADOS_LEAD, type EstadoLead } from "@/lib/leads";
import type { Lead } from "@/lib/tipos";
import { Inbox } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * LEADS — los interesados que llegan de la web
 * =============================================
 * Antes vivían en el WhatsApp de quien los atendió: sin lista, sin saber
 * cuántos se perdieron ni de qué campaña vinieron. Aquí se trabajan:
 * nuevo → contactado → calificado → convertido (o perdido).
 *
 * El resumen de arriba es el embudo real: cuántos llegan y cuántos acaban
 * en cliente. Es la analítica que importa antes de montar ninguna otra.
 */

const NOMBRES: Record<EstadoLead, string> = {
  nuevo: "Nuevos",
  contactado: "Contactados",
  calificado: "Calificados",
  convertido: "Convertidos",
  perdido: "Perdidos",
};

export default async function PaginaLeads() {
  const supabase = await crearClienteServidor();
  // Los últimos 200: los leads viejos ya están trabajados y el panel no
  // necesita cargarlos todos (la paginación completa llega en la etapa C).
  const { data } = await supabase
    .from("leads")
    .select("*")
    .order("creado_en", { ascending: false })
    .limit(200);

  const leads = (data ?? []) as Lead[];
  const cuenta = (estado: EstadoLead) => leads.filter((l) => l.estado === estado).length;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="font-serif text-3xl text-gray-900 flex items-center gap-2">
          <Inbox className="w-6 h-6 text-[#D4AF37]" /> Leads
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Lo que llega desde la web pública. A los nuevos se les escribe hoy, no mañana.
        </p>
      </div>

      {/* El embudo, en cinco números */}
      <div className="grid grid-cols-5 gap-3">
        {ESTADOS_LEAD.map((estado) => (
          <div key={estado} className="bg-white border border-gray-100 rounded-2xl p-4 text-center shadow-sm">
            <p className="text-2xl font-bold text-gray-900">{cuenta(estado)}</p>
            <p className="text-[11px] uppercase tracking-wider text-gray-400 mt-1">{NOMBRES[estado]}</p>
          </div>
        ))}
      </div>

      {leads.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-200 rounded-2xl py-16 text-center text-sm text-gray-400">
          Todavía no ha llegado ningún lead. Cuando la web conecte su formulario a
          <code className="mx-1 text-[#B08D2A]">POST /api/public/leads</code>, aparecerán aquí solos.
        </div>
      ) : (
        <div className="space-y-3">
          {leads.map((lead) => (
            <LeadTarjeta key={lead.id} lead={lead} />
          ))}
        </div>
      )}
    </div>
  );
}
