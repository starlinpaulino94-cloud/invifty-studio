// Tipos compartidos de Invifty Studio

export type TipoEvento = "boda" | "cumpleanos" | "empresarial" | "otro";
export type Plan = "esencial" | "popular" | "premium" | "luxury";

export type EstadoPedido =
  | "nuevo"
  | "formulario_enviado"
  | "formulario_completado"
  | "en_diseno"
  | "revision_cliente"
  | "entregada"
  | "activa"
  | "vencida";

export type EstadoFormulario = "pendiente" | "en_progreso" | "completado";

export interface Cliente {
  id: string;
  nombre: string;
  telefono: string;
  email: string | null;
  como_nos_conocio: string | null;
  creado_en: string;
}

export interface Pedido {
  id: string;
  cliente_id: string;
  tipo_evento: TipoEvento;
  plan: Plan;
  extras: string[];
  fecha_evento: string | null;
  estado: EstadoPedido;
  precio: number;
  url_entregada: string | null;
  fecha_entrega: string | null;
  fecha_vencimiento: string | null;
  notas: string | null;
  creado_en: string;
  actualizado_en: string;
}

export interface Pago {
  id: string;
  pedido_id: string;
  monto: number;
  metodo: string | null;
  nota: string | null;
  fecha: string;
}

export interface Formulario {
  id: string;
  pedido_id: string;
  token: string;
  estado: EstadoFormulario;
  respuestas: Record<string, unknown>;
  fecha_completado: string | null;
  creado_en: string;
  actualizado_en: string;
}

export interface PedidoConCliente extends Pedido {
  clientes: Cliente;
}

export interface FotoSubida {
  nombre: string;
  ruta: string;
  url?: string;
}

export type EstadoInvitacion = "borrador" | "publicada";

/** Contenido editable de una invitación generada (columna datos, JSONB). */
export interface DatosInvitacion {
  titulo: string;            // "Camila & Lucas" / "Mis 15 Años — Valeria"
  subtitulo: string;         // "¡Nos casamos!" / "Te invitamos a celebrar"
  frase: string;             // frase o versículo de portada
  fechaEvento: string;       // YYYY-MM-DD
  horaEvento: string;        // HH:MM
  lugares: { nombre: string; detalle: string }[];
  dressCode: string;
  paleta: string;            // id de paleta (ver PALETAS_INVITACION)
  historia: string;
  cronograma: { hora: string; actividad: string }[];
  regalos: { titulo: string; detalle: string }[];
  rsvp: {
    whatsapp: string;        // número que recibe las confirmaciones
    fechaLimite: string;
    acompanantes: boolean;
  };
  secciones: {
    historia: boolean;
    galeria: boolean;
    cronograma: boolean;
    regalos: boolean;
    rsvp: boolean;
  };
}

export interface Invitacion {
  id: string;
  pedido_id: string;
  slug: string;
  plantilla: string;
  datos: DatosInvitacion;
  estado: EstadoInvitacion;
  publicada_en: string | null;
  creado_en: string;
  actualizado_en: string;
}
