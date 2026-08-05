import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import LeadTarjeta from "@/components/panel/LeadTarjeta";
import { ESTADOS_LEAD, type EstadoLead } from "@/lib/leads";
import type { Lead } from "@/lib/tipos";
import { ChevronLeft, ChevronRight, Inbox } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * LEADS — los interesados que llegan de la web
 * =============================================
 * Antes vivían en el WhatsApp de quien los atendió: sin lista, sin saber
 * cuántos se perdieron ni de qué campaña vinieron. Aquí se trabajan:
 * nuevo → contactado → calificado → convertido (o perdido).
 *
 * El embudo de arriba cuenta TODOS los leads (consultas de conteo, no la
 * página cargada): si hay mil, el embudo dice mil aunque la lista enseñe
 * cincuenta. La lista va paginada — nunca se cargan todos en memoria.
 */

const NOMBRES: Record<EstadoLead, string> = {
  nuevo: "Nuevos",
  contactado: "Contactados",
  calificado: "Calificados",
  convertido: "Convertidos",
  perdido: "Perdidos",
};

const POR_PAGINA = 50;

export default async function PaginaLeads({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string }>;
}) {
  const { pagina: paginaCruda } = await searchParams;
  const pagina = Math.max(1, Math.floor(Number(paginaCruda)) || 1);
  const desde = (pagina - 1) * POR_PAGINA;

  const supabase = await crearClienteServidor();

  // El embudo por conteo (head:true no trae filas, solo el número) y la
  // página actual, todo a la vez.
  const [{ data, count }, ...conteos] = await Promise.all([
    supabase
      .from("leads")
      .select("*", { count: "exact" })
      .order("creado_en", { ascending: false })
      .range(desde, desde + POR_PAGINA - 1),
    ...ESTADOS_LEAD.map((estado) =>
      supabase.from("leads").select("id", { count: "exact", head: true }).eq("estado", estado)
    ),
  ]);

  const leads = (data ?? []) as Lead[];
  const total = count ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const embudo = Object.fromEntries(
    ESTADOS_LEAD.map((estado, i) => [estado, conteos[i]?.count ?? 0])
  ) as Record<EstadoLead, number>;

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

      {/* El embudo, en cinco números (todos los leads, no la página) */}
      <div className="grid grid-cols-5 gap-3">
        {ESTADOS_LEAD.map((estado) => (
          <div key={estado} className="bg-white border border-gray-100 rounded-2xl p-4 text-center shadow-sm">
            <p className="text-2xl font-bold text-gray-900">{embudo[estado]}</p>
            <p className="text-[11px] uppercase tracking-wider text-gray-400 mt-1">{NOMBRES[estado]}</p>
          </div>
        ))}
      </div>

      {leads.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-200 rounded-2xl py-16 text-center text-sm text-gray-400">
          {pagina > 1 ? (
            <>Esta página está vacía. <Link href="/panel/leads" className="text-[#B08D2A] underline">Volver a la primera</Link>.</>
          ) : (
            <>
              Todavía no ha llegado ningún lead. Cuando la web conecte su formulario a
              <code className="mx-1 text-[#B08D2A]">POST /api/public/leads</code>, aparecerán aquí solos.
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {leads.map((lead) => (
            <LeadTarjeta key={lead.id} lead={lead} />
          ))}
        </div>
      )}

      {totalPaginas > 1 && (
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>
            Página {pagina} de {totalPaginas} · {total} leads
          </span>
          <span className="flex gap-2">
            {pagina > 1 && (
              <Link
                href={`/panel/leads?pagina=${pagina - 1}`}
                className="inline-flex items-center gap-1 border border-gray-200 rounded-lg px-3 py-1.5 hover:border-gray-400"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Anteriores
              </Link>
            )}
            {pagina < totalPaginas && (
              <Link
                href={`/panel/leads?pagina=${pagina + 1}`}
                className="inline-flex items-center gap-1 border border-gray-200 rounded-lg px-3 py-1.5 hover:border-gray-400"
              >
                Siguientes <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </span>
        </div>
      )}
    </div>
  );
}
