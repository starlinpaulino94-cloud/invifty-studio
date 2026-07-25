import Link from "next/link";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { cerrarSesion } from "@/lib/acciones";
import {
  LayoutDashboard, PlusCircle, Users, CalendarClock, BarChart3, LogOut,
} from "lucide-react";

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/panel", etiqueta: "Tablero", Icono: LayoutDashboard },
  { href: "/panel/pedidos/nuevo", etiqueta: "Crear pedido", Icono: PlusCircle },
  { href: "/panel/clientes", etiqueta: "Clientes", Icono: Users },
  { href: "/panel/vencimientos", etiqueta: "Vencimientos", Icono: CalendarClock },
  { href: "/panel/metricas", etiqueta: "Métricas", Icono: BarChart3 },
];

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-dvh bg-gray-50 flex flex-col lg:flex-row">
      {/* Barra lateral / superior */}
      <aside className="lg:w-60 bg-[#0D0D0F] text-white flex lg:flex-col shrink-0 lg:min-h-dvh sticky top-0 z-30">
        <div className="hidden lg:block px-6 py-7">
          <span className="font-serif text-xl tracking-[0.25em] uppercase block">Invifty</span>
          <span className="text-[9px] uppercase tracking-[0.35em] text-[#D4AF37] font-semibold">
            Studio
          </span>
        </div>

        <nav className="flex lg:flex-col flex-1 overflow-x-auto lg:overflow-visible items-center lg:items-stretch px-2 lg:px-3 gap-1 py-2 lg:py-0">
          {NAV.map(({ href, etiqueta, Icono }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-[13px] text-white/70 hover:text-white hover:bg-white/5 transition-colors whitespace-nowrap"
            >
              <Icono className="w-4 h-4 text-[#D4AF37]" />
              {etiqueta}
            </Link>
          ))}
        </nav>

        <form action={cerrarSesion} className="lg:px-3 lg:pb-6 px-2 py-2 lg:py-0 flex items-center">
          <button
            type="submit"
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-[13px] text-white/50 hover:text-white hover:bg-white/5 transition-colors w-full whitespace-nowrap"
          >
            <LogOut className="w-4 h-4" />
            Cerrar sesión
          </button>
        </form>
      </aside>

      {/* Contenido */}
      <main className="flex-1 p-5 sm:p-8 max-w-7xl w-full mx-auto">{children}</main>
    </div>
  );
}
