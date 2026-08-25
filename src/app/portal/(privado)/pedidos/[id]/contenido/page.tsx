import Link from "next/link";
import { notFound } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { tienePermiso } from "@/lib/cuentas";
import { puedeEditarContenido, CAMPOS_CONTENIDO } from "@/lib/edicion";
import FormContenido from "@/components/portal/FormContenido";
import type { DatosInvitacion } from "@/lib/tipos";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * LOS TEXTOS DE LA INVITACIÓN — lo único que el cliente edita solo.
 * Lectura con su sesión (RLS decide si esta invitación es suya); el
 * guardado pasa por la acción que revalida permiso y candado.
 */
export default async function PaginaContenido({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: miembro } = await supabase
    .from("miembros_cuenta")
    .select("rol, permisos")
    .eq("usuario_id", user?.id ?? "")
    .maybeSingle();

  const { data: invitacion } = await supabase
    .from("invitaciones")
    .select("id, datos, bloqueada_en")
    .eq("pedido_id", id)
    .maybeSingle();
  if (!invitacion) notFound();

  const puedeEditar = miembro ? tienePermiso(miembro, "editar_invitacion") : false;
  const candado = puedeEditarContenido(invitacion);
  const datos = invitacion.datos as DatosInvitacion;

  return (
    <div className="space-y-6">
      <Link
        href={`/portal/pedidos/${id}`}
        className="inline-flex items-center gap-1.5 text-white/40 hover:text-white text-xs"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Volver al pedido
      </Link>
      <div>
        <h1 className="text-white text-xl font-semibold">Los textos de tu invitación</h1>
        <p className="text-white/40 text-xs mt-1">
          Aquí ajustas tus textos: nombres, historia, despedida. El diseño, la
          fecha y el lugar los cuida el equipo — escríbenos para esos cambios.
        </p>
      </div>

      {!puedeEditar ? (
        <Aviso texto="Tu acceso no incluye editar la invitación: pídeselo al propietario de la cuenta." />
      ) : !candado.ok ? (
        <Aviso texto={candado.motivo} />
      ) : (
        <FormContenido
          invitacionId={invitacion.id}
          valores={Object.fromEntries(
            CAMPOS_CONTENIDO.map((c) => [
              c.id,
              String((datos as unknown as Record<string, unknown>)[c.id] ?? ""),
            ])
          )}
        />
      )}
    </div>
  );
}

function Aviso({ texto }: { texto: string }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-3xl p-8 text-center">
      <p className="text-white/60 text-sm">{texto}</p>
    </div>
  );
}
