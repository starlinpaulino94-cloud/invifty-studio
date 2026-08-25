import { crearClienteAdmin } from "@/lib/supabase/admin";
import { activacionVigente } from "@/lib/cuentas";
import FormActivar from "@/components/portal/FormActivar";

export const dynamic = "force-dynamic";

/**
 * ACTIVACIÓN DEL PORTAL — la única puerta de entrada de un cliente nuevo.
 * No hay registro público: se llega solo con el enlace que Invifty mandó
 * por WhatsApp. El token caduca y es de un solo uso; aquí el cliente
 * elige SU contraseña (que jamás viajó por ningún chat).
 */
export default async function PaginaActivar({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Sin sesión no hay RLS que ayude: mira el token el administrador.
  let cuenta: { estado: string; token_activacion: string | null; activacion_expira: string | null; email: string } | null = null;
  if (/^[a-f0-9]{32}$/i.test(token)) {
    const admin = crearClienteAdmin();
    const { data } = await admin
      .from("cuentas_cliente")
      .select("estado, token_activacion, activacion_expira, email")
      .eq("token_activacion", token)
      .maybeSingle();
    cuenta = data;
  }

  const vigente = cuenta !== null && activacionVigente(cuenta, new Date());

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
          <FormActivar token={token} email={cuenta!.email} />
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
