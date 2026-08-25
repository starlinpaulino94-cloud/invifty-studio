import { crearClienteAdmin } from "@/lib/supabase/admin";
import { recuperacionVigente, HORAS_RECUPERACION } from "@/lib/cuentas";
import FormActivar from "@/components/portal/FormActivar";

export const dynamic = "force-dynamic";

/**
 * RECUPERACIÓN DE CONTRASEÑA — el cliente perdió la suya, escribió por
 * WhatsApp y el equipo le mandó este enlace. Vence en horas y se usa una
 * vez; aquí elige la contraseña nueva. Nadie le manda nunca una hecha.
 */
export default async function PaginaRecuperar({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  let email: string | null = null;
  if (/^[a-f0-9]{32}$/i.test(token)) {
    const admin = crearClienteAdmin();
    const { data } = await admin
      .from("recuperaciones")
      .select("email, expira_en, usado_en")
      .eq("token", token)
      .maybeSingle();
    if (data && recuperacionVigente(data, new Date())) email = data.email;
  }

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

        {email ? (
          <FormActivar token={token} email={email} accion="recuperacion" />
        ) : (
          <div className="bg-white/5 border border-white/10 rounded-3xl p-8 text-center">
            <p className="text-white text-sm mb-2">Este enlace ya no sirve.</p>
            <p className="text-white/40 text-xs">
              Los enlaces de recuperación vencen a las {HORAS_RECUPERACION} horas
              y solo se usan una vez. Escríbenos por WhatsApp y te mandamos uno
              nuevo — nunca te pediremos tu contraseña.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
