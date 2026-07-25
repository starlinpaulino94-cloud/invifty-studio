import Link from "next/link";
import { notFound } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import {
  PLANES, EXTRAS, TIPOS_EVENTO, formatoDOP, formatoFecha,
} from "@/lib/planes";
import { construirFormulario } from "@/config/formularios";
import { formatearValor } from "@/lib/respuestas";
import { Cliente, Formulario, Pago, Pedido, Plan, TipoEvento } from "@/lib/tipos";
import BotonImprimir from "@/components/panel/BotonImprimir";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * Brief de diseño imprimible: todo el pedido en un solo documento
 * (cliente, plan, respuestas por sección y fotos) listo para
 * imprimir o guardar como PDF desde el navegador.
 */
export default async function ExportarPedido({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .from("pedidos")
    .select("*, clientes(*), formularios(*), pagos(*)")
    .eq("id", id)
    .single();

  if (!data) notFound();

  const pedido = data as Pedido & {
    clientes: Cliente;
    formularios: Formulario[];
    pagos: Pago[];
  };
  const cliente = pedido.clientes;
  const formulario = pedido.formularios?.[0];
  const respuestas = (formulario?.respuestas ?? {}) as Record<string, unknown>;
  const bloques = construirFormulario(pedido.tipo_evento as TipoEvento, pedido.plan as Plan);

  const abonado = (pedido.pagos ?? []).reduce((s, p) => s + Number(p.monto), 0);
  const saldo = Number(pedido.precio) - abonado;

  const admin = crearClienteAdmin();
  const { data: archivos } = await admin.storage
    .from("fotos-pedidos")
    .list(pedido.id, { limit: 200 });
  const fotos = await Promise.all(
    (archivos ?? [])
      .filter((a) => !a.name.startsWith("video-"))
      .map(async (a) => {
        const { data: firmada } = await admin.storage
          .from("fotos-pedidos")
          .createSignedUrl(`${pedido.id}/${a.name}`, 3600);
        return { nombre: a.name, url: firmada?.signedUrl };
      })
  );

  const generado = new Date().toLocaleString("es-DO", {
    dateStyle: "long",
    timeStyle: "short",
  });

  return (
    <div className="max-w-3xl bg-white print:max-w-none">
      {/* Controles (no se imprimen) */}
      <div className="flex items-center justify-between gap-3 mb-8 print:hidden">
        <Link
          href={`/panel/pedidos/${pedido.id}`}
          className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 font-medium"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Volver a la ficha
        </Link>
        <BotonImprimir />
      </div>

      <div className="border border-gray-200 rounded-2xl p-8 print:border-0 print:p-0 print:rounded-none">
        {/* Encabezado del documento */}
        <header className="border-b-2 border-[#D4AF37] pb-5 mb-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-serif text-lg tracking-[0.25em] uppercase text-gray-900">Invifty</p>
              <p className="text-[9px] uppercase tracking-[0.3em] text-[#B08D2A] font-semibold">
                Brief de diseño · Documento interno
              </p>
            </div>
            <p className="text-[10px] text-gray-400 text-right">Generado: {generado}</p>
          </div>

          <h1 className="font-serif text-3xl text-gray-900 mt-5">{cliente.nombre}</h1>
          <p className="text-sm text-gray-600 mt-1">
            {TIPOS_EVENTO[pedido.tipo_evento as TipoEvento]} · Plan{" "}
            <strong>{PLANES[pedido.plan as Plan].nombre}</strong>
            {pedido.fecha_evento && <> · Evento: <strong>{formatoFecha(pedido.fecha_evento)}</strong></>}
          </p>
        </header>

        {/* Datos generales */}
        <section className="mb-7">
          <h2 className="text-xs font-bold uppercase tracking-widest text-[#B08D2A] mb-3">
            Datos del pedido
          </h2>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-gray-100">
              <Fila etiqueta="WhatsApp" valor={cliente.telefono} />
              {cliente.email && <Fila etiqueta="Email" valor={cliente.email} />}
              <Fila
                etiqueta="Extras contratados"
                valor={
                  pedido.extras.length
                    ? pedido.extras.map((e) => EXTRAS.find((x) => x.id === e)?.nombre ?? e).join(" · ")
                    : "Ninguno"
                }
              />
              <Fila etiqueta="Precio acordado" valor={formatoDOP(pedido.precio)} />
              <Fila
                etiqueta="Pagos"
                valor={`Abonado ${formatoDOP(abonado)} · Pendiente ${formatoDOP(Math.max(saldo, 0))}`}
              />
              {formulario?.fecha_completado && (
                <Fila etiqueta="Formulario completado" valor={formatoFecha(formulario.fecha_completado)} />
              )}
              {pedido.notas && <Fila etiqueta="Notas internas" valor={pedido.notas} />}
            </tbody>
          </table>
        </section>

        {/* Respuestas por sección */}
        {bloques.map((bloque) => {
          const conRespuesta = bloque.preguntas.some(
            (p) => p.tipo !== "fotos" && respuestas[p.id] !== undefined && respuestas[p.id] !== ""
          );
          if (!conRespuesta) return null;
          return (
            <section key={bloque.id} className="mb-7 break-inside-avoid">
              <h2 className="text-xs font-bold uppercase tracking-widest text-[#B08D2A] mb-3">
                {bloque.titulo}
              </h2>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-gray-100">
                  {bloque.preguntas
                    .filter((p) => p.tipo !== "fotos")
                    .map((p) => (
                      <Fila
                        key={p.id}
                        etiqueta={p.titulo}
                        valor={formatearValor(p, respuestas[p.id])}
                      />
                    ))}
                </tbody>
              </table>
            </section>
          );
        })}

        {/* Fotos */}
        {fotos.length > 0 && (
          <section className="mb-7 break-inside-avoid">
            <h2 className="text-xs font-bold uppercase tracking-widest text-[#B08D2A] mb-3">
              Fotos del cliente ({fotos.length})
            </h2>
            <div className="grid grid-cols-4 gap-2">
              {fotos.map((foto) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={foto.nombre}
                  src={foto.url}
                  alt={foto.nombre}
                  className="w-full aspect-square object-cover rounded-lg border border-gray-200"
                />
              ))}
            </div>
          </section>
        )}

        <footer className="border-t border-gray-200 pt-4 text-[10px] text-gray-400 text-center">
          Invifty Studio · Documento de uso interno para producción de la invitación
        </footer>
      </div>
    </div>
  );
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <tr className="align-top">
      <td className="py-2 pr-4 text-gray-400 text-xs font-medium w-44">{etiqueta}</td>
      <td className="py-2 text-gray-900 whitespace-pre-line">{valor}</td>
    </tr>
  );
}
