import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { avisoDeDominio } from "@/lib/url";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { esDelEquipo } from "@/lib/sesion";
import { cerrarSesion } from "@/lib/acciones";
import {
  LayoutDashboard, PlusCircle, Users, CalendarClock, BarChart3, LogOut, Palette, Wrench, Inbox, Globe,
} from "lucide-react";

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/panel", etiqueta: "Tablero", Icono: LayoutDashboard },
  { href: "/panel/pedidos/nuevo", etiqueta: "Crear pedido", Icono: PlusCircle },
  { href: "/panel/plantillas", etiqueta: "Plantillas", Icono: Palette },
  { href: "/panel/clientes", etiqueta: "Clientes", Icono: Users },
  { href: "/panel/leads", etiqueta: "Leads", Icono: Inbox },
  { href: "/panel/demos", etiqueta: "Demos", Icono: Globe },
  { href: "/panel/vencimientos", etiqueta: "Vencimientos", Icono: CalendarClock },
  { href: "/panel/metricas", etiqueta: "Métricas", Icono: BarChart3 },
  { href: "/panel/mantenimiento", etiqueta: "Mantenimiento", Icono: Wrench },
];

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  /**
   * Tener sesión no es ser del equipo: la clave anon es pública y
   * cualquiera puede registrarse contra nuestro proyecto de Supabase.
   * La RLS ya no le dejaría leer nada (vería el panel vacío); esto le
   * dice a la cara que no le toca.
   *
   * Aquí NO se redirige a /login: el proxy manda a /panel a quien ya
   * tiene sesión, así que redirigir daría un bucle. Se le enseña la
   * puerta de salida en su lugar.
   */
  if (!(await esDelEquipo(supabase, user.id))) {
    return (
      <div className="min-h-dvh bg-[#0D0D0F] flex items-center justify-center px-5 text-center">
        <div className="max-w-sm">
          <p className="text-white text-sm mb-2">Esta cuenta no tiene acceso al panel.</p>
          <p className="text-white/40 text-xs mb-6">
            El panel es solo para el equipo Invifty. Si crees que es un error, escríbenos.
          </p>
          <form action={cerrarSesion}>
            <button
              type="submit"
              className="text-[#D4AF37] text-xs uppercase tracking-[0.2em] font-semibold"
            >
              Cerrar sesión
            </button>
          </form>
        </div>
      </div>
    );
  }

  /**
   * LA RED DE SEGURIDAD DEL DOMINIO. Los enlaces que se mandan a
   * clientes e invitados se arman con NEXT_PUBLIC_APP_URL; un error de
   * dedo ahí ("invifty.co" sin la eme) reparte enlaces rotos por
   * WhatsApp sin que nada falle a la vista. Si el dominio configurado
   * no es el mismo por el que el equipo está usando el panel, se avisa
   * en grande. Los previews de Vercel viven en otro dominio a
   * propósito: ahí el aviso también sale, y también es verdad.
   */
  const avisoDominio = avisoDeDominio((await headers()).get("host"));

  return (
    <div className="min-h-dvh bg-gray-50 flex flex-col lg:flex-row">
      {/* Barra lateral / superior */}
      <aside className="lg:w-60 bg-[#0D0D0F] text-white flex lg:flex-col shrink-0 lg:min-h-dvh sticky top-0 z-30 print:hidden">
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
      <main className="flex-1 p-5 sm:p-8 max-w-7xl w-full mx-auto print:p-0 print:max-w-none">
        {avisoDominio && (
          <p className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-4 py-3 mb-5 print:hidden">
            ⚠️ <strong>Los enlaces se están generando con «{avisoDominio.configurado}»</strong>,
            pero el panel está abierto en «{avisoDominio.real}». Los formularios y revisiones que
            envíes llevarán un dominio que puede no funcionar. Revisa{" "}
            <code className="font-mono">NEXT_PUBLIC_APP_URL</code> en Vercel y redespliega.
          </p>
        )}
        {children}
      </main>
    </div>
  );
}
