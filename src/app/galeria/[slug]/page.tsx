import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { contratoDePedido } from "@/lib/capacidades";
import { estadoDeGaleria, tieneGaleria, MAX_FOTOS_GALERIA } from "@/lib/galeria";
import { BUCKET, HORAS_FIRMA } from "@/lib/fotos";
import GaleriaEvento from "@/components/galeria/GaleriaEvento";
import type { DatosInvitacion } from "@/lib/tipos";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Álbum del evento — Invifty",
  description: "Las fotos del evento, tomadas por los invitados.",
  robots: { index: false, follow: false },
};

/**
 * EL ÁLBUM COLABORATIVO — /galeria/<slug>
 * ========================================
 * El QR/enlace que se comparte en el evento. Público como la invitación:
 * quien tiene el enlace es un invitado. Solo existe si el pedido incluye
 * la galería (extra o contrato) y la invitación está publicada; abrirla
 * y cerrarla es del anfitrión, desde su panel de la lista.
 */
export default async function PaginaGaleria({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const admin = crearClienteAdmin();

  const { data: invitacion } = await admin
    .from("invitaciones")
    .select("id, estado, galeria_abierta, datos, pedidos(id, extras, plan, capacidades_contratadas)")
    .eq("slug", slug)
    .maybeSingle();

  const pedido = invitacion?.pedidos as unknown as {
    id: string; extras: string[]; plan: string; capacidades_contratadas: unknown;
  } | null;
  if (!invitacion || !pedido) notFound();

  const estado = estadoDeGaleria(
    tieneGaleria(pedido, contratoDePedido(pedido)),
    invitacion as unknown as { estado: string; galeria_abierta: boolean }
  );
  // Sin galería contratada o invitación sin publicar: página inexistente,
  // sin explicar nada a quien esté probando enlaces.
  if (estado === "no_disponible") notFound();

  const datos = (invitacion.datos ?? {}) as DatosInvitacion;

  // Las fotos visibles, firmadas de una vez para el primer render.
  const { data: filas } = await admin
    .from("fotos_galeria")
    .select("id, ruta, miniatura_ruta, autor")
    .eq("invitacion_id", invitacion.id)
    .eq("estado", "visible")
    .order("creado_en", { ascending: false })
    .limit(MAX_FOTOS_GALERIA);
  const fotos = filas ?? [];
  const rutas = fotos.flatMap((f) => [f.ruta, f.miniatura_ruta]);
  const { data: firmadas } = rutas.length
    ? await admin.storage.from(BUCKET).createSignedUrls(rutas, HORAS_FIRMA * 60 * 60)
    : { data: [] };
  const porRuta = new Map((firmadas ?? []).map((f) => [f.path, f.signedUrl]));

  return (
    <div className="min-h-dvh bg-[#0D0D0F] px-4 py-10">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="text-center">
          <span className="text-[10px] uppercase tracking-[0.4em] text-[#D4AF37] font-semibold">
            Álbum del evento
          </span>
          <h1 className="font-serif text-3xl text-white mt-2 text-balance">
            {datos.titulo || "Nuestro evento"}
          </h1>
          <p className="text-white/40 text-sm mt-2">
            Las fotos las ponemos entre todos: sube las tuyas y mira las de los demás.
          </p>
        </div>

        <GaleriaEvento
          slug={slug}
          abierta={estado === "abierta"}
          fotosIniciales={fotos.map((f) => ({
            id: f.id,
            autor: f.autor,
            url: porRuta.get(f.ruta) ?? null,
            miniatura: porRuta.get(f.miniatura_ruta) ?? null,
          }))}
        />

        <p className="text-white/20 text-[11px] text-center">
          Invifty · las fotos solo son visibles para quienes tienen este enlace
        </p>
      </div>
    </div>
  );
}
