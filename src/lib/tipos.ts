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
