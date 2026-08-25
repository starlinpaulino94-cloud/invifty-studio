import Link from "next/link";
import { contratoDePedido } from "@/lib/capacidades";
import { capacidadesDelCliente, NOTA_ESTADO_CAPACIDAD, resumenRsvp } from "@/lib/portal";
import { desglosePagos, estadoPago, pagoActivo, NOMBRE_ESTADO_PAGO } from "@/lib/pagos";
import { estadoDeRevision, puedeDecidir, NOMBRE_ESTADO_REVISION } from "@/lib/revision";
import {
  PLANES, TIPOS_EVENTO, formatoDOP, formatoFecha, nombreEstado,
} from "@/lib/planes";
import type { EstadoCapacidad } from "@/lib/planes";
import type { Plan, TipoEvento, EstadoPedido } from "@/lib/tipos";
import {
  ArrowLeft, FileText, ExternalLink, Users, Wallet, Sparkles, PenLine, Check, Clock,
} from "lucide-react";

export interface PedidoDelPortal {
  id: string;
  plan: string;
  tipo_evento: string;
  estado: string;
  precio: number;
  fecha_evento: string | null;
  fecha_entrega: string | null;
  fecha_vencimiento: string | null;
  capacidades_contratadas: unknown;
  formularios: { token: string; estado: string }[];
  invitaciones: { id: string; slug: string; token_lista: string | null; estado: string }[];
  pagos: {
    id: string;
    monto: number;
    tipo: "pago" | "reembolso" | "ajuste";
    metodo: string | null;
    fecha: string;
    fecha_efectiva: string | null;
    anulado_en: string | null;
  }[];
}

export interface RevisionDelPortal {
  token: string;
  estado: "abierta" | "cambios_solicitados" | "aprobada";
  expira_en: string;
  revocada_en: string | null;
}

/**
 * La vista del detalle, separada de la consulta: la página trae los
 * datos (con la sesión del cliente, RLS mediante) y esto solo pinta.
 * Todo lo que se enseña se DERIVA aquí con la misma lógica pura que usa
 * el panel — el cliente y el equipo nunca ven números distintos.
 */
export default function DetallePedido({
  pedido,
  confirmaciones,
  revision,
  ahora,
}: {
  pedido: PedidoDelPortal;
  confirmaciones: { asiste: boolean; cantidad: number }[];
  revision: RevisionDelPortal | null;
  ahora: Date;
}) {
  const contrato = contratoDePedido(pedido);
  const capacidades = capacidadesDelCliente(contrato);
  const formulario = pedido.formularios?.[0];
  const invitacion = pedido.invitaciones?.[0];

  // El dinero, derivado de las transacciones activas — igual que el panel.
  const pagos = (pedido.pagos ?? []).filter(pagoActivo);
  const dinero = desglosePagos(pagos);
  const saldo = Number(pedido.precio) - dinero.neto;
  const situacion = estadoPago(Number(pedido.precio), pagos);
  const rsvp = resumenRsvp(confirmaciones);

  return (
    <div className="space-y-6">
      <Link
        href="/portal"
        className="inline-flex items-center gap-1.5 text-white/40 hover:text-white text-xs"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Volver a mi portal
      </Link>

      {/* Cabecera */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-white text-xl font-semibold">
            {TIPOS_EVENTO[pedido.tipo_evento as TipoEvento] ?? pedido.tipo_evento}
          </h1>
          <p className="text-white/40 text-xs mt-1">
            {pedido.fecha_evento ? `${formatoFecha(pedido.fecha_evento)} · ` : ""}
            Plan {PLANES[pedido.plan as Plan]?.nombre ?? pedido.plan}
            {pedido.fecha_vencimiento
              ? ` · en línea hasta ${formatoFecha(pedido.fecha_vencimiento)}`
              : ""}
          </p>
        </div>
        <span className="text-[10px] uppercase tracking-[0.15em] text-[#D4AF37] border border-[#D4AF37]/40 rounded-full px-3 py-1 whitespace-nowrap">
          {nombreEstado(pedido.estado as EstadoPedido)}
        </span>
      </div>

      {/* Tu invitación */}
      <section className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4">
        <h2 className="text-white text-sm font-semibold flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#D4AF37]" /> Tu invitación
        </h2>
        {!invitacion ? (
          <p className="text-white/40 text-xs">
            {formulario && formulario.estado !== "completado"
              ? "Cuando completes el formulario, el equipo comienza el diseño."
              : "El equipo está trabajando en tu diseño. Te avisamos por WhatsApp cuando haya algo que ver."}
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {invitacion.estado === "publicada" && (
              <EnlacePortal
                href={`/i/${invitacion.slug}`}
                Icono={ExternalLink}
                titulo="Ver mi invitación"
                detalle="Como la ven tus invitados"
              />
            )}
            {invitacion.token_lista && (
              <EnlacePortal
                href={`/lista/${invitacion.token_lista}`}
                Icono={Users}
                titulo="Mis invitados"
                detalle={
                  rsvp.confirmaciones > 0
                    ? `${rsvp.personas} persona${rsvp.personas === 1 ? "" : "s"} confirmada${rsvp.personas === 1 ? "" : "s"}`
                    : "Lista, confirmaciones y recepción"
                }
              />
            )}
            {revision && (
              puedeDecidir(revision, ahora) ? (
                <EnlacePortal
                  href={`/revision/${revision.token}`}
                  Icono={PenLine}
                  titulo="Revisar mi diseño"
                  detalle="Hay una versión esperando tu visto bueno"
                />
              ) : (
                <p className="text-white/40 text-xs flex items-center gap-2 px-1">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  Última revisión: {NOMBRE_ESTADO_REVISION[estadoDeRevision(revision, ahora)]}
                </p>
              )
            )}
            {formulario && formulario.estado !== "completado" && (
              <EnlacePortal
                href={`/f/${formulario.token}`}
                Icono={FileText}
                titulo="Completar el formulario"
                detalle="Los datos de tu celebración"
              />
            )}
          </div>
        )}
        {invitacion && rsvp.confirmaciones + rsvp.noVienen > 0 && (
          <div className="grid grid-cols-3 gap-2 text-center">
            <Cifra valor={rsvp.confirmaciones} etiqueta="grupos que sí" />
            <Cifra valor={rsvp.personas} etiqueta="personas" />
            <Cifra valor={rsvp.noVienen} etiqueta="no vienen" />
          </div>
        )}
      </section>

      {/* Tu plan */}
      <section className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-white text-sm font-semibold">
            Tu plan {PLANES[contrato.plan]?.nombre ?? contrato.plan}
          </h2>
          {contrato.congeladoEn && (
            <span className="text-white/30 text-[10px]">
              contratado el {formatoFecha(contrato.congeladoEn)}
            </span>
          )}
        </div>
        <ul className="space-y-2">
          {capacidades.map((c) => {
            const nota = NOTA_ESTADO_CAPACIDAD[c.estado as Exclude<EstadoCapacidad, "no_disponible">];
            return (
              <li key={c.id} className="flex items-start gap-2.5 text-xs">
                <Check className="w-3.5 h-3.5 text-[#D4AF37] shrink-0 mt-0.5" />
                <span>
                  <span className="text-white/80">{c.nombre}</span>
                  {nota && <span className="block text-white/35 text-[11px]">{nota}</span>}
                </span>
              </li>
            );
          })}
        </ul>
        {Number.isFinite(contrato.limiteFotos) && contrato.limiteFotos > 0 && (
          <p className="text-white/35 text-[11px]">
            Incluye hasta {contrato.limiteFotos} fotos.
          </p>
        )}
      </section>

      {/* Tus pagos */}
      <section className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-white text-sm font-semibold flex items-center gap-2">
            <Wallet className="w-4 h-4 text-[#D4AF37]" /> Tus pagos
          </h2>
          <span
            className={`text-[10px] uppercase tracking-[0.15em] rounded-full px-3 py-1 ${
              situacion === "pagado"
                ? "bg-emerald-500/15 text-emerald-300"
                : "bg-white/10 text-white/60"
            }`}
          >
            {NOMBRE_ESTADO_PAGO[situacion]}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <Cifra valor={formatoDOP(Number(pedido.precio))} etiqueta="tu plan" />
          <Cifra valor={formatoDOP(dinero.neto)} etiqueta="abonado" />
          <Cifra valor={formatoDOP(Math.max(0, saldo))} etiqueta="pendiente" />
        </div>
        {pagos.length > 0 && (
          <ul className="divide-y divide-white/5">
            {pagos
              .slice()
              .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
              .map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2 text-xs">
                  <span className="text-white/50">
                    {formatoFecha(p.fecha_efectiva ?? p.fecha)}
                    {p.metodo ? ` · ${p.metodo}` : ""}
                    {p.tipo === "reembolso" ? " · reembolso" : ""}
                  </span>
                  <span className={p.tipo === "reembolso" ? "text-red-300" : "text-white/80"}>
                    {p.tipo === "reembolso" ? "−" : ""}{formatoDOP(Number(p.monto))}
                  </span>
                </li>
              ))}
          </ul>
        )}
        {saldo > 0.01 && (
          <p className="text-white/35 text-[11px]">
            Para abonar, escríbenos por WhatsApp y te pasamos las opciones de pago.
          </p>
        )}
      </section>
    </div>
  );
}

function EnlacePortal({
  href,
  Icono,
  titulo,
  detalle,
}: {
  href: string;
  Icono: typeof FileText;
  titulo: string;
  detalle: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 bg-black/30 border border-white/10 hover:border-[#D4AF37]/50 rounded-2xl px-4 py-3 transition-colors"
    >
      <Icono className="w-4 h-4 text-[#D4AF37] shrink-0" />
      <span>
        <span className="block text-white text-xs font-medium">{titulo}</span>
        <span className="block text-white/40 text-[11px]">{detalle}</span>
      </span>
    </Link>
  );
}

function Cifra({ valor, etiqueta }: { valor: string | number; etiqueta: string }) {
  return (
    <div className="bg-black/30 border border-white/10 rounded-2xl py-3 px-2">
      <p className="text-white text-sm font-semibold">{valor}</p>
      <p className="text-white/35 text-[10px] uppercase tracking-wide">{etiqueta}</p>
    </div>
  );
}
