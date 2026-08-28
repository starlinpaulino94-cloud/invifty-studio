import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { cruzarLista, type InvitadoDeLista, type ConfirmacionCruzada } from "@/lib/lista";
import PanelInvitados from "@/components/lista/PanelInvitados";
import type { HogarDeLista } from "@/components/lista/Hogares";
import type { EntradaDeLista } from "@/components/lista/Recepcion";
import type { DatosInvitacion } from "@/lib/tipos";
import { tieneGaleria } from "@/lib/galeria";
import { tieneRecordatorios } from "@/lib/recordatorios";
import { tieneMesaRegalos } from "@/lib/regalos";
import { contratoDePedido } from "@/lib/capacidades";

/**
 * EL PANEL DEL ANFITRIÓN
 * =======================
 * Lo que el cliente que pagó la invitación quiere ver: quién viene, quién
 * no, y —lo que más pregunta— a quién le falta contestar.
 *
 * Entra con un enlace secreto, sin cuenta ni contraseña, igual que el
 * formulario en /f/<token>. El anfitrión no es usuario del sistema: es el
 * cliente, y pedirle que se registre para ver su propia boda sobraría.
 *
 * `noindex` y sin caché: es la lista de invitados de una persona.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tus confirmaciones — Invifty",
  description: "Quién ha confirmado su asistencia a tu evento.",
  robots: { index: false, follow: false },
};

export default async function PaginaLista({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = crearClienteAdmin();

  const { data: invitacion } = await supabase
    .from("invitaciones")
    .select("id, slug, datos, estado, galeria_abierta, pedidos(extras, plan, capacidades_contratadas)")
    .eq("token_lista", token)
    .maybeSingle();

  // Un token que no existe se trata como página inexistente, sin decir "ese
  // enlace no vale": no hay por qué confirmarle nada a quien esté probando.
  if (!invitacion) notFound();

  // Hogares, entradas y el cruce por hogar van en consultas APARTE de las
  // de siempre: si la migración de la Etapa E aún no se corrió, fallan
  // ellas solas (data null) y el panel clásico sigue completo.
  const [
    { data: invitadosData },
    { data: confirmacionesData },
    { data: hogaresData },
    { data: entradasData },
    { data: confirmacionesConHogar },
    { data: confirmacionesConRespuestas },
  ] = await Promise.all([
    supabase
      .from("invitados")
      .select("id, nombre, nombre_normalizado")
      .eq("invitacion_id", invitacion.id)
      .order("creado_en"),
    supabase
      .from("confirmaciones")
      .select("nombre, nombre_normalizado, asiste, cantidad, nota, creado_en")
      .eq("invitacion_id", invitacion.id)
      .order("creado_en", { ascending: false }),
    supabase
      .from("hogares")
      .select("id, nombre, cupo, token")
      .eq("invitacion_id", invitacion.id)
      .order("creado_en"),
    supabase
      .from("entradas")
      .select("id, hogar_id, nombre, personas, operador, anulada_en, creado_en")
      .eq("invitacion_id", invitacion.id)
      .order("creado_en", { ascending: false })
      .limit(200),
    supabase
      .from("confirmaciones")
      .select("hogar_id, asiste, cantidad")
      .eq("invitacion_id", invitacion.id)
      .not("hogar_id", "is", null),
    supabase
      .from("confirmaciones")
      .select("nombre_normalizado, respuestas")
      .eq("invitacion_id", invitacion.id)
      .neq("respuestas", "{}"),
  ]);

  // Cuántas personas confirmó cada hogar (para el cupo y la puerta).
  const confirmadosPorHogar: Record<string, number> = {};
  for (const c of (confirmacionesConHogar ?? []) as {
    hogar_id: string;
    asiste: boolean;
    cantidad: number;
  }[]) {
    if (c.asiste) {
      confirmadosPorHogar[c.hogar_id] = (confirmadosPorHogar[c.hogar_id] ?? 0) + c.cantidad;
    }
  }

  const cruce = cruzarLista(
    (invitadosData ?? []) as InvitadoDeLista[],
    (confirmacionesData ?? []) as ConfirmacionCruzada[]
  );

  const datos = (invitacion.datos ?? {}) as DatosInvitacion;

  // Respuestas a las preguntas extra del RSVP, por invitado (clave: el
  // nombre normalizado, la misma que usa el cruce), con el texto de cada
  // pregunta para enseñarlas legibles.
  const respuestasPorInvitado: Record<string, Record<string, string>> = {};
  for (const c of (confirmacionesConRespuestas ?? []) as {
    nombre_normalizado: string;
    respuestas: Record<string, string>;
  }[]) {
    if (c.respuestas && Object.keys(c.respuestas).length > 0) {
      respuestasPorInvitado[c.nombre_normalizado] = c.respuestas;
    }
  }
  const etiquetasRsvp = Object.fromEntries(
    (datos.rsvp?.preguntas ?? []).map((p) => [p.id, p.texto])
  );

  // La galería: solo si el pedido la incluye (extra o contrato). El
  // conteo y las fotos las trae la propia pestaña por la API; aquí solo
  // viaja el estado. `galeria_abierta` llega undefined si la migración
  // no ha corrido: la sección simplemente no sale.
  const pedidoDeLista = invitacion.pedidos as unknown as {
    extras: string[]; plan: string; capacidades_contratadas: unknown;
  } | null;
  const galeriaIncluida = Boolean(
    pedidoDeLista &&
      invitacion.galeria_abierta !== undefined &&
      tieneGaleria(pedidoDeLista, contratoDePedido(pedidoDeLista))
  );

  // Recordatorios: qué hogares YA respondieron (sí o no) — a esos no se
  // les insiste. La capacidad viene del contrato del pedido.
  const recordatoriosIncluidos = Boolean(
    pedidoDeLista && tieneRecordatorios(contratoDePedido(pedidoDeLista))
  );

  // Mesa de regalos: la incluye el contrato, y la columna de cuentas
  // existe (consulta aparte, a prueba de migración sin correr).
  const { data: cuentasRegaloProbe } = await supabase
    .from("invitaciones")
    .select("cuentas_regalo")
    .eq("id", invitacion.id)
    .maybeSingle();
  const regalosIncluidos = Boolean(
    pedidoDeLista &&
      cuentasRegaloProbe &&
      tieneMesaRegalos(contratoDePedido(pedidoDeLista))
  );
  const hogaresQueRespondieron = [
    ...new Set(
      ((confirmacionesConHogar ?? []) as { hogar_id: string }[]).map((c) => c.hogar_id)
    ),
  ];

  // Mesas (seating): consultas APARTE y a prueba de migración sin correr —
  // si fallan, la sección no sale y el panel clásico sigue completo.
  const [{ data: mesasData }, { data: asignacionesData }] = await Promise.all([
    supabase
      .from("mesas")
      .select("id, nombre, capacidad")
      .eq("invitacion_id", invitacion.id)
      .order("creado_en"),
    supabase.from("hogares").select("id, mesa_id").eq("invitacion_id", invitacion.id),
  ]);
  const asignaciones = Object.fromEntries(
    ((asignacionesData ?? []) as { id: string; mesa_id: string | null }[]).map((h) => [
      h.id,
      h.mesa_id,
    ])
  );

  return (
    <PanelInvitados
      token={token}
      galeria={galeriaIncluida ? { abierta: Boolean(invitacion.galeria_abierta) } : null}
      mesaRegalos={regalosIncluidos}
      mesas={
        mesasData
          ? {
              lista: mesasData as { id: string; nombre: string; capacidad: number }[],
              asignaciones,
            }
          : null
      }
      recordatorios={
        recordatoriosIncluidos
          ? {
              fechaLimite: datos.rsvp?.fechaLimite || null,
              hogaresQueRespondieron,
            }
          : null
      }
      titulo={datos.titulo || "Tu evento"}
      fechaEvento={datos.fechaEvento ?? null}
      publicada={invitacion.estado === "publicada"}
      invitados={(invitadosData ?? []) as InvitadoDeLista[]}
      cruce={cruce}
      slug={invitacion.slug}
      hogares={(hogaresData ?? []) as HogarDeLista[]}
      entradas={(entradasData ?? []) as EntradaDeLista[]}
      confirmadosPorHogar={confirmadosPorHogar}
      respuestasPorInvitado={respuestasPorInvitado}
      etiquetasRsvp={etiquetasRsvp}
    />
  );
}
