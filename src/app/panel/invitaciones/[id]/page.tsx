import MiniaturaInvitacion from "@/components/MiniaturaInvitacion";
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
import { BUCKET, HORAS_FIRMA, listarArchivos, urlsDeFoto } from "@/lib/fotos";
import { urlBase as resolverUrlBase } from "@/lib/url";
import { urlsDeMedios } from "@/lib/codigo-medios-servidor";
import { ArrowLeft, Link2 } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * EL RELOJ DE LA PLATAFORMA
 * ==========================
 * Esta página hospeda dos acciones de servidor que llaman a un modelo:
 * los conceptos y el arte a medida. Dibujar tres SVG con esfuerzo alto
 * tarda minutos, no segundos, y en Vercel una función se corta sola al
 * llegar a su tope — con un error genérico, justo cuando el dibujo iba
 * a salir bien.
 *
 * Para Server Actions el tope se pone AQUÍ, en la página, no en la
 * acción (ver la guía de maxDuration de esta versión de Next). 300 s es
 * el máximo de los planes de pago de Vercel; en Hobby la plataforma
 * aplicará el suyo, más bajo, y entonces conviene pedir las piezas de
 * una en una desde la tarjeta.
 *
 * El cliente del SDK espera MENOS que esto a propósito
 * (lib/ia/arte-anthropic.ts): así, cuando algo se eterniza, quien
 * responde es nuestro mensaje y no el corte seco de la plataforma.
 */
export const maxDuration = 300;

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

  // Archivos que el código propio lleva alojados aparte ({{MEDIO_…}}), para la vista previa.
  const archivosCodigo = await urlsDeMedios(admin, pedido.id, invitacion.codigo_html);

  // El ciclo de revisión con el cliente: versiones enviadas, su estado y
  // los comentarios de cada una. Si las tablas aún no están migradas, la
  // tarjeta simplemente aparece vacía (data = null).
  // `comentarios(*)` a propósito: trae imagen_ruta cuando la migración de
  // referencias corrió, y funciona igual si todavía no.
  const { data: revisionesData } = await supabase
    .from("revisiones")
    .select(
      "id, estado, expira_en, revocada_en, aprobada_en, aprobada_por, creado_en, token, " +
        "versiones(numero), comentarios(*)"
    )
    .eq("invitacion_id", invitacion.id)
    .order("creado_en", { ascending: false });

  type RevisionCruda = Omit<RevisionPanel, "numeroVersion" | "comentarios"> & {
    versiones: { numero: number } | null;
    comentarios: (ComentarioPanel & { imagen_ruta?: string | null })[] | null;
  };

  // La imagen de referencia del cliente se enseña con URL firmada del
  // bucket privado, como las fotos y los comprobantes.
  const revisiones: RevisionPanel[] = await Promise.all(
    ((revisionesData ?? []) as unknown as RevisionCruda[]).map(async (r) => ({
      id: r.id,
      estado: r.estado,
      expira_en: r.expira_en,
      revocada_en: r.revocada_en,
      aprobada_en: r.aprobada_en,
      aprobada_por: r.aprobada_por,
      creado_en: r.creado_en,
      token: r.token,
      numeroVersion: r.versiones?.numero ?? 0,
      comentarios: await Promise.all(
        (r.comentarios ?? [])
          .sort((a, b) => a.creado_en.localeCompare(b.creado_en))
          .map(async (c) => {
            let imagenUrl: string | undefined;
            if (c.imagen_ruta) {
              const { data: firmada } = await admin.storage
                .from(BUCKET)
                .createSignedUrl(c.imagen_ruta, HORAS_FIRMA * 3600);
              imagenUrl = firmada?.signedUrl;
            }
            return {
              id: c.id,
              seccion: c.seccion,
              texto: c.texto,
              estado: c.estado,
              creado_en: c.creado_en,
              imagenUrl,
            };
          })
      ),
    }))
  );

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
            className="mt-3 flex items-start gap-3 w-fit max-w-full group"
          >
            <MiniaturaInvitacion
              slug={invitacion.slug}
              version={invitacion.actualizado_en}
              className="w-44 shrink-0"
            />
            <span className="inline-flex items-center gap-1.5 text-xs text-[#B08D2A] group-hover:underline break-all">
              <Link2 className="w-3.5 h-3.5 shrink-0" /> {urlPublica}
            </span>
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
        archivosCodigoIniciales={archivosCodigo}
      />
    </div>
  );
}
