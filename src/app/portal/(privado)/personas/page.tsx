import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { urlBase } from "@/lib/url";
import Personas from "@/components/portal/Personas";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * QUIÉN TIENE ACCESO A LA CUENTA — solo el propietario gestiona. Las
 * lecturas van con su sesión (las políticas "propietario ve los
 * miembros" y "propietario ve invitaciones" deciden qué aparece); las
 * escrituras van por acciones de servidor que vuelven a validar.
 */
export default async function PaginaPersonas() {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Mi propia fila dice mi rol. Un colaborador ve SOLO su fila (RLS),
  // así que además de decírselo aquí, las listas de abajo le saldrían
  // vacías y las acciones del servidor lo rechazarían igual.
  const { data: yo } = await supabase
    .from("miembros_cuenta")
    .select("id, cuenta_id, rol")
    .eq("usuario_id", user?.id ?? "")
    .maybeSingle();

  if (!yo || yo.rol !== "propietario") {
    return (
      <div className="space-y-6">
        <Link
          href="/portal"
          className="inline-flex items-center gap-1.5 text-white/40 hover:text-white text-xs"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Volver a mi portal
        </Link>
        <div className="bg-white/5 border border-white/10 rounded-3xl p-8 text-center">
          <p className="text-white text-sm mb-2">Solo el propietario gestiona el acceso.</p>
          <p className="text-white/40 text-xs">
            Si necesitas un cambio en tu acceso, pídeselo a quien te invitó.
          </p>
        </div>
      </div>
    );
  }

  const { data: miembros } = await supabase
    .from("miembros_cuenta")
    .select("id, usuario_id, rol, permisos, email, creado_en")
    .eq("cuenta_id", yo.cuenta_id)
    .order("creado_en", { ascending: true });

  const { data: invitaciones } = await supabase
    .from("invitaciones_cuenta")
    .select("id, email, permisos, token, expira_en, usado_en, revocada_en, creado_en")
    .eq("cuenta_id", yo.cuenta_id)
    .order("creado_en", { ascending: false });

  return (
    <div className="space-y-6">
      <Link
        href="/portal"
        className="inline-flex items-center gap-1.5 text-white/40 hover:text-white text-xs"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Volver a mi portal
      </Link>
      <div>
        <h1 className="text-white text-xl font-semibold">Personas con acceso</h1>
        <p className="text-white/40 text-xs mt-1">
          Invita a quien te ayuda con el evento. Cada quien entra con su propia
          contraseña — nunca compartas la tuya.
        </p>
      </div>
      <Personas
        miembros={(miembros ?? []) as {
          id: string; usuario_id: string; rol: string;
          permisos: Record<string, unknown> | null; email: string | null;
        }[]}
        invitaciones={(invitaciones ?? []) as {
          id: string; email: string; permisos: Record<string, unknown> | null;
          token: string; expira_en: string; usado_en: string | null; revocada_en: string | null;
        }[]}
        miUsuarioId={user!.id}
        base={urlBase()}
      />
    </div>
  );
}
