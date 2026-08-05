import Link from "next/link";
import { notFound } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import EditorInvitacion from "@/components/panel/EditorInvitacion";
import RevisionCliente, {
  type ComentarioPanel, type RevisionPanel,
} from "@/components/panel/RevisionCliente";
import { PLANES, TIPOS_EVENTO } from "@/lib/planes";
import type { Cliente, DatosInvitacion, Invitacion, Pedido, Plan, TipoEvento } from "@/lib/tipos";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { listarArchivos, urlsDeFoto } from "@/lib/fotos";
import { urlBase as resolverUrlBase } from "@/lib/url";
import { ArrowLeft, Link2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PaginaEditorInvitacion({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .from("invitaciones")
    .select("*, pedidos(*, clientes(*))")
    .eq("id", id)
    .single();

  if (!data) notFound();

  const invitacion = data as Invitacion & { pedidos: Pedido & { clientes: Cliente } };
  const pedido = invitacion.pedidos;
  const urlBase = resolverUrlBase();
  const urlPublica = `${urlBase}/i/${invitacion.slug}`;

  // Fotos del cliente, para que el equipo elija portada y orden.
  // Se pasan SIN ordenar: el editor aplica el orden guardado y deja
  // cambiarlo, y así también se ven las que están ocultas.
  const admin = crearClienteAdmin();
  const archivos = await listarArchivos(admin, pedido.id, 60);
  const fotos = await Promise.all(
    archivos.filter((a) => !a.esVideo).map((a) => urlsDeFoto(admin, pedido.id, a))
  );

  // El video va aparte de las fotos: no se ordena ni se oculta como ellas,
  // se enciende o se apaga con su interruptor.
  const archivoVideo = archivos.find((a) => a.esVideo);
  const video = archivoVideo ? await urlsDeFoto(admin, pedido.id, archivoVideo) : undefined;

  // El ciclo de revisión con el cliente: versiones enviadas, su estado y
  // los comentarios de cada una. Si las tablas aún no están migradas, la
  // tarjeta simplemente aparece vacía (data = null).
  const { data: revisionesData } = await supabase
    .from("revisiones")
    .select(
      "id, estado, expira_en, revocada_en, aprobada_en, aprobada_por, creado_en, token, " +
        "versiones(numero), comentarios(id, seccion, texto, estado, creado_en)"
    )
    .eq("invitacion_id", invitacion.id)
    .order("creado_en", { ascending: false });

  type RevisionCruda = Omit<RevisionPanel, "numeroVersion" | "comentarios"> & {
    versiones: { numero: number } | null;
    comentarios: ComentarioPanel[] | null;
  };

  const revisiones: RevisionPanel[] = ((revisionesData ?? []) as unknown as RevisionCruda[]).map((r) => ({
    id: r.id,
    estado: r.estado,
    expira_en: r.expira_en,
    revocada_en: r.revocada_en,
    aprobada_en: r.aprobada_en,
    aprobada_por: r.aprobada_por,
    creado_en: r.creado_en,
    token: r.token,
    numeroVersion: r.versiones?.numero ?? 0,
    comentarios: (r.comentarios ?? []).sort((a, b) => a.creado_en.localeCompare(b.creado_en)),
  }));

  return (
    // Más ancho que el resto del panel: aquí conviven el formulario y la
    // vista previa en vivo, una al lado de la otra.
    <div className="space-y-6 max-w-[1500px]">
      <Link
        href={`/panel/pedidos/${pedido.id}`}
        className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 font-medium"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Volver a la ficha del pedido
      </Link>

      <div>
        <h1 className="font-serif text-3xl text-gray-900">Editor de invitación</h1>
        <p className="text-sm text-gray-500 mt-1">
          {pedido.clientes.nombre} · {TIPOS_EVENTO[pedido.tipo_evento as TipoEvento]} · Plan{" "}
          {PLANES[pedido.plan as Plan].nombre}
        </p>
        {invitacion.estado === "publicada" && (
          <a
            href={urlPublica}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-[#B08D2A] hover:underline mt-2 break-all"
          >
            <Link2 className="w-3.5 h-3.5" /> {urlPublica}
          </a>
        )}
      </div>

      <RevisionCliente
        invitacionId={invitacion.id}
        bloqueadaEn={invitacion.bloqueada_en ?? null}
        revisiones={revisiones}
        urlBase={urlBase}
      />

      <EditorInvitacion
        invitacionId={invitacion.id}
        slugInicial={invitacion.slug}
        dominioInicial={invitacion.dominio ?? null}
        plantillaInicial={invitacion.plantilla}
        datosIniciales={invitacion.datos as DatosInvitacion}
        estado={invitacion.estado}
        urlPublica={urlPublica}
        fotos={fotos}
        video={video}
        codigoInicial={invitacion.codigo_html}
      />
    </div>
  );
}
