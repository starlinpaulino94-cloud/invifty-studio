import { crearClienteAdmin } from "@/lib/supabase/admin";
import { activacionVigente, invitacionVigente } from "@/lib/cuentas";
import FormActivar from "@/components/portal/FormActivar";

export const dynamic = "force-dynamic";

/**
 * ACTIVACIÓN DEL PORTAL — la única puerta de entrada de un cliente nuevo.
 * No hay registro público: se llega solo con el enlace que llegó por
 * WhatsApp — el del equipo (propietario) o el del propietario a su
 * colaborador. El token caduca y es de un solo uso; aquí quien llega
 * elige SU contraseña (que jamás viajó por ningún chat).
 */
export default async function PaginaActivar({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const ahora = new Date();

  // Sin sesión no hay RLS que ayude: mira el token el administrador.
  // El mismo enlace sirve para las dos activaciones; se busca en orden.
  let email: string | null = null;
  let accion: "cuenta" | "colaborador" = "cuenta";
  if (/^[a-f0-9]{32}$/i.test(token)) {
    const admin = crearClienteAdmin();
    const { data: cuenta } = await admin
      .from("cuentas_cliente")
      .select("estado, token_activacion, activacion_expira, email")
      .eq("token_activacion", token)
      .maybeSingle();
    if (cuenta && activacionVigente(cuenta, ahora)) {
      email = cuenta.email;
    } else {
      const { data: invitacion } = await admin
        .from("invitaciones_cuenta")
        .select("email, expira_en, usado_en, revocada_en")
        .eq("token", token)
        .maybeSingle();
      if (invitacion && invitacionVigente(invitacion, ahora)) {
        email = invitacion.email;
        accion = "colaborador";
      }
    }
  }

  const vigente = email !== null;

  return (
    <div className="min-h-dvh bg-[#0D0D0F] flex items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <span className="font-serif text-3xl tracking-[0.3em] text-white uppercase block">
            Invifty
          </span>
          <span className="text-[10px] uppercase tracking-[0.4em] text-[#D4AF37] font-semibold">
            Portal de clientes
          </span>
        </div>

        {vigente ? (
          <FormActivar token={token} email={email!} accion={accion} />
        ) : (
          <div className="bg-white/5 border border-white/10 rounded-3xl p-8 text-center">
            <p className="text-white text-sm mb-2">Este enlace ya no sirve.</p>
            <p className="text-white/40 text-xs">
              Los enlaces de activación vencen a los 7 días y solo se usan una
              vez. Escríbenos por WhatsApp y te mandamos uno nuevo — nunca te
              pediremos tu contraseña.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
