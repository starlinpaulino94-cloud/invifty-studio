import Link from "next/link";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { cerrarSesionPortal } from "@/lib/acciones-cuentas";

export const dynamic = "force-dynamic";

/**
 * LA GUARDIA DEL PORTAL — en el servidor, no en un botón escondido.
 * El proxy ya manda a /portal/entrar a quien no tiene sesión; aquí se
 * comprueba lo que el proxy no puede: que la sesión sea de un MIEMBRO de
 * una cuenta de cliente. La consulta va con la sesión del usuario, así
 * que el RLS multicuenta se ejercita de verdad en cada visita — si las
 * políticas fallaran, esto no abriría.
 *
 * Ojo con los redirects: el proxy empuja hacia aquí a quien tiene
 * sesión, así que a quien no le toca el portal NO se le redirige (sería
 * un bucle) — se le dice a la cara y se le da la puerta de salida.
 */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/portal/entrar");

  // "miembro ve su fila" + "cliente ve su cuenta": si esto devuelve algo,
  // el RLS reconoce al usuario como miembro. Incluye suspendidas — para
  // poder decírselo en vez de enseñar una pantalla vacía.
  const { data: miembro } = await supabase
    .from("miembros_cuenta")
    .select("cuenta_id, rol, cuentas_cliente(estado)")
    .eq("usuario_id", user.id)
    .maybeSingle();

  const cuenta = miembro?.cuentas_cliente as { estado: string } | null | undefined;

  if (!miembro || !cuenta) {
    return (
      <PantallaCerrada
        titulo="Esta cuenta no tiene portal de cliente."
        detalle="Si contrataste con Invifty y no puedes entrar, escríbenos por WhatsApp y lo resolvemos."
      />
    );
  }

  if (cuenta.estado === "suspendida") {
    return (
      <PantallaCerrada
        titulo="Tu portal está suspendido."
        detalle="Tus datos están guardados y no se ha borrado nada. Escríbenos por WhatsApp para reactivarlo."
      />
    );
  }

  return (
    <div className="min-h-dvh bg-[#0D0D0F]">
      <header className="border-b border-white/10 px-5 py-4 flex items-center justify-between">
        <div>
          <span className="font-serif text-lg tracking-[0.25em] text-white uppercase">Invifty</span>
          <span className="block text-[9px] uppercase tracking-[0.35em] text-[#D4AF37] font-semibold">
            Portal de clientes
          </span>
        </div>
        <nav className="flex items-center gap-4">
          <Link
            href="/portal/personas"
            className="text-white/50 hover:text-white text-[11px] uppercase tracking-[0.2em]"
          >
            Personas
          </Link>
          <form action={cerrarSesionPortal}>
            <button
              type="submit"
              className="text-white/50 hover:text-white text-[11px] uppercase tracking-[0.2em]"
            >
              Salir
            </button>
          </form>
        </nav>
      </header>
      <main className="max-w-3xl mx-auto px-5 py-8">{children}</main>
    </div>
  );
}

function PantallaCerrada({ titulo, detalle }: { titulo: string; detalle: string }) {
  return (
    <div className="min-h-dvh bg-[#0D0D0F] flex items-center justify-center px-5 text-center">
      <div className="max-w-sm">
        <p className="text-white text-sm mb-2">{titulo}</p>
        <p className="text-white/40 text-xs mb-6">{detalle}</p>
        <form action={cerrarSesionPortal}>
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
