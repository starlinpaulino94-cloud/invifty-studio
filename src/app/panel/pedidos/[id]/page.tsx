import Link from "next/link";
import { notFound } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { registrarPago, guardarFicha } from "@/lib/acciones";
import {
  PLANES, EXTRAS, TIPOS_EVENTO, formatoDOP, formatoFecha, mensajeWhatsAppFormulario,
} from "@/lib/planes";
import { construirFormulario } from "@/config/formularios";
import { formatearValor, textoDeBloque } from "@/lib/respuestas";
import { Cliente, Formulario, Pago, Pedido, Plan, TipoEvento } from "@/lib/tipos";
import {
  SelectorEstado, BotonCopiar, BotonMensajeWhatsApp, BotonEliminarPago,
} from "@/components/panel/Interactivos";
import {
  ArrowLeft, Phone, Mail, Link2, StickyNote, Wallet, Image as ImageIcon, Download, Sparkles,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function FichaPedido({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ nuevo?: string }>;
}) {
  const { id } = await params;
  const { nuevo } = await searchParams;

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
  const pagos = (pedido.pagos ?? []).sort(
    (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
  );
  const abonado = pagos.reduce((s, p) => s + Number(p.monto), 0);
  const saldo = Number(pedido.precio) - abonado;

  const urlBase = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const urlFormulario = formulario ? `${urlBase}/f/${formulario.token}` : "";
  const mensaje = formulario
    ? mensajeWhatsAppFormulario(cliente.nombre, pedido.plan as Plan, urlFormulario)
    : "";

  // Respuestas organizadas por bloques del formulario
  const bloques = construirFormulario(pedido.tipo_evento as TipoEvento, pedido.plan as Plan);
  const respuestas = (formulario?.respuestas ?? {}) as Record<string, unknown>;

  // Fotos subidas (URLs firmadas por 1 hora)
  const admin = crearClienteAdmin();
  const { data: archivos } = await admin.storage.from("fotos-pedidos").list(pedido.id, { limit: 200 });
  const fotos = await Promise.all(
    (archivos ?? []).map(async (a) => {
      const { data: firmada } = await admin.storage
        .from("fotos-pedidos")
        .createSignedUrl(`${pedido.id}/${a.name}`, 3600, { download: a.name });
      const { data: vista } = await admin.storage
        .from("fotos-pedidos")
        .createSignedUrl(`${pedido.id}/${a.name}`, 3600);
      return { nombre: a.name, descarga: firmada?.signedUrl, vista: vista?.signedUrl };
    })
  );

  const inputBase =
    "w-full bg-white border border-gray-200 focus:border-[#D4AF37] rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none";

  return (
    <div className="space-y-6 max-w-4xl">
      <Link
        href="/panel"
        className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 font-medium"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Volver al tablero
      </Link>

      {/* Banner de pedido recién creado */}
      {nuevo && formulario && (
        <div className="bg-[#0D0D0F] text-white rounded-2xl p-6">
          <div className="flex items-center gap-2 text-[#D4AF37] text-sm font-semibold mb-2">
            <Sparkles className="w-4 h-4" /> ¡Pedido creado! Envía el formulario al cliente:
          </div>
          <p className="text-white/60 text-xs mb-4 break-all">{urlFormulario}</p>
          <BotonMensajeWhatsApp pedidoId={pedido.id} mensaje={mensaje} telefono={cliente.telefono} />
        </div>
      )}

      {/* Encabezado */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="font-serif text-3xl text-gray-900">{cliente.nombre}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {TIPOS_EVENTO[pedido.tipo_evento as TipoEvento]} · Plan {PLANES[pedido.plan as Plan].nombre} ·{" "}
              {pedido.fecha_evento ? `Evento: ${formatoFecha(pedido.fecha_evento)}` : "Sin fecha de evento"}
            </p>
            <div className="flex flex-wrap gap-3 mt-3 text-xs text-gray-600">
              <a
                href={`https://wa.me/${cliente.telefono}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 hover:text-[#0D0D0F] font-medium"
              >
                <Phone className="w-3.5 h-3.5 text-[#D4AF37]" /> {cliente.telefono}
              </a>
              {cliente.email && (
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-[#D4AF37]" /> {cliente.email}
                </span>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="font-serif text-2xl text-gray-900">{formatoDOP(pedido.precio)}</p>
            <p className={`text-xs font-semibold mt-1 ${saldo <= 0 ? "text-emerald-600" : "text-amber-600"}`}>
              {saldo <= 0 ? "Pagado completo ✓" : `Pendiente: ${formatoDOP(saldo)}`}
            </p>
          </div>
        </div>

        {pedido.extras.length > 0 && (
          <p className="text-xs text-gray-500 mb-4">
            <strong className="text-gray-700">Extras:</strong>{" "}
            {pedido.extras.map((e) => EXTRAS.find((x) => x.id === e)?.nombre ?? e).join(" · ")}
          </p>
        )}

        <SelectorEstado pedidoId={pedido.id} estado={pedido.estado} />

        {pedido.fecha_vencimiento && (
          <p className="text-xs text-gray-500 mt-4">
            Entregada el {formatoFecha(pedido.fecha_entrega)} · Vence el{" "}
            <strong className="text-gray-800">{formatoFecha(pedido.fecha_vencimiento)}</strong>
          </p>
        )}
      </div>

      {/* Link del formulario */}
      {formulario && !nuevo && (
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
            <h2 className="font-serif text-lg text-gray-900">Formulario del cliente</h2>
            <span
              className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${
                formulario.estado === "completado"
                  ? "bg-emerald-100 text-emerald-700"
                  : formulario.estado === "en_progreso"
                  ? "bg-amber-100 text-amber-700"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              {formulario.estado === "completado"
                ? `Completado ${formulario.fecha_completado ? "· " + formatoFecha(formulario.fecha_completado) : ""}`
                : formulario.estado === "en_progreso"
                ? "En progreso"
                : "Pendiente"}
            </span>
          </div>
          <p className="text-xs text-gray-400 break-all mb-4">{urlFormulario}</p>
          <BotonMensajeWhatsApp pedidoId={pedido.id} mensaje={mensaje} telefono={cliente.telefono} />
        </div>
      )}

      {/* Respuestas */}
      {formulario && Object.keys(respuestas).length > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-6">
          <h2 className="font-serif text-lg text-gray-900">Respuestas del formulario</h2>
          {bloques.map((bloque) => {
            const conRespuesta = bloque.preguntas.some(
              (p) => p.tipo !== "fotos" && respuestas[p.id] !== undefined && respuestas[p.id] !== ""
            );
            if (!conRespuesta) return null;
            return (
              <section key={bloque.id} className="border-t border-gray-100 pt-5 first:border-0 first:pt-0">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">
                    {bloque.titulo}
                  </h3>
                  <BotonCopiar texto={textoDeBloque(bloque, respuestas)} etiqueta="Copiar sección" />
                </div>
                <dl className="space-y-3">
                  {bloque.preguntas
                    .filter((p) => p.tipo !== "fotos")
                    .map((p) => (
                      <div key={p.id}>
                        <dt className="text-xs text-gray-400 font-medium">{p.titulo}</dt>
                        <dd className="text-sm text-gray-900 whitespace-pre-line mt-0.5">
                          {formatearValor(p, respuestas[p.id])}
                        </dd>
                      </div>
                    ))}
                </dl>
              </section>
            );
          })}
        </div>
      )}

      {/* Fotos */}
      {fotos.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
          <h2 className="font-serif text-lg text-gray-900 mb-4 flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-[#D4AF37]" />
            Archivos subidos ({fotos.length})
          </h2>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
            {fotos.map((foto) => (
              <a
                key={foto.nombre}
                href={foto.descarga}
                className="group relative aspect-square rounded-xl overflow-hidden border border-gray-200 bg-gray-50"
                title={`Descargar ${foto.nombre}`}
              >
                {foto.nombre.startsWith("video-") ? (
                  <video src={foto.vista} className="w-full h-full object-cover" muted />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={foto.vista} alt={foto.nombre} className="w-full h-full object-cover" />
                )}
                <span className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Download className="w-5 h-5 text-white" />
                </span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Pagos */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
        <h2 className="font-serif text-lg text-gray-900 mb-4 flex items-center gap-2">
          <Wallet className="w-4 h-4 text-[#D4AF37]" /> Pagos
        </h2>

        <div className="grid grid-cols-3 gap-3 text-center mb-5">
          <div className="bg-gray-50 rounded-xl py-3">
            <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Precio</p>
            <p className="text-sm font-bold text-gray-900">{formatoDOP(pedido.precio)}</p>
          </div>
          <div className="bg-emerald-50 rounded-xl py-3">
            <p className="text-[10px] uppercase tracking-wider text-emerald-600 font-semibold">Abonado</p>
            <p className="text-sm font-bold text-emerald-700">{formatoDOP(abonado)}</p>
          </div>
          <div className={`${saldo <= 0 ? "bg-gray-50" : "bg-amber-50"} rounded-xl py-3`}>
            <p className="text-[10px] uppercase tracking-wider text-amber-600 font-semibold">Pendiente</p>
            <p className="text-sm font-bold text-amber-700">{formatoDOP(Math.max(saldo, 0))}</p>
          </div>
        </div>

        {pagos.length > 0 && (
          <ul className="divide-y divide-gray-100 mb-5">
            {pagos.map((pago) => (
              <li key={pago.id} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                <div>
                  <span className="font-semibold text-gray-900">{formatoDOP(pago.monto)}</span>
                  <span className="text-gray-400 text-xs ml-2">
                    {formatoFecha(pago.fecha)}{pago.metodo ? ` · ${pago.metodo}` : ""}{pago.nota ? ` · ${pago.nota}` : ""}
                  </span>
                </div>
                <BotonEliminarPago pagoId={pago.id} pedidoId={pedido.id} />
              </li>
            ))}
          </ul>
        )}

        <form action={registrarPago.bind(null, pedido.id)} className="flex flex-wrap gap-2">
          <input
            name="monto" type="number" min="1" step="50" required placeholder="Monto RD$"
            className={`${inputBase} w-32`}
          />
          <select name="metodo" className={`${inputBase} w-40`}>
            <option value="">Método…</option>
            <option value="transferencia">Transferencia</option>
            <option value="efectivo">Efectivo</option>
            <option value="zelle">Zelle</option>
            <option value="paypal">PayPal</option>
            <option value="tarjeta">Tarjeta</option>
          </select>
          <input name="nota" placeholder="Nota (opcional)" className={`${inputBase} flex-1 min-w-32`} />
          <button
            type="submit"
            className="bg-[#0D0D0F] text-white text-xs font-semibold px-5 py-2.5 rounded-xl hover:bg-black transition-colors"
          >
            Registrar abono
          </button>
        </form>
      </div>

      {/* Entrega y notas */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
        <h2 className="font-serif text-lg text-gray-900 mb-4 flex items-center gap-2">
          <Link2 className="w-4 h-4 text-[#D4AF37]" /> Entrega y notas
        </h2>
        <form action={guardarFicha.bind(null, pedido.id)} className="space-y-4">
          <div>
            <label htmlFor="url_entregada" className="block text-xs font-semibold text-gray-600 mb-1.5">
              URL de la invitación entregada
            </label>
            <input
              id="url_entregada" name="url_entregada" type="url"
              defaultValue={pedido.url_entregada ?? ""}
              placeholder="https://invifty.com/boda-camila-lucas"
              className={inputBase}
            />
          </div>
          <div>
            <label htmlFor="notas" className="block text-xs font-semibold text-gray-600 mb-1.5">
              <StickyNote className="w-3.5 h-3.5 inline mr-1 text-[#D4AF37]" />
              Notas internas
            </label>
            <textarea
              id="notas" name="notas" rows={3}
              defaultValue={pedido.notas ?? ""}
              className={`${inputBase} resize-none`}
            />
          </div>
          <button
            type="submit"
            className="bg-white border border-gray-300 hover:border-gray-900 text-gray-900 text-xs font-semibold px-5 py-2.5 rounded-xl transition-colors"
          >
            Guardar cambios
          </button>
        </form>
      </div>
    </div>
  );
}
