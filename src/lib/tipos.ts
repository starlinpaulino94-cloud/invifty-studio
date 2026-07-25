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

/**
 * Foto ya lista para mostrarse en una invitación, con sus dos tamaños:
 * `url` es la versión a pantalla completa y `urlMiniatura` la de la
 * cuadrícula. En fotos subidas antes de las versiones ligeras, ambas
 * apuntan al mismo original.
 */
export interface FotoInvitacion {
  nombre: string;
  url?: string;
  urlMiniatura?: string;
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
  paleta: string;            // id de paleta (ver config/diseno.ts)
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
    padrinos?: boolean;
    notas?: boolean;
  };

  /* ---------- Detalle premium (todo opcional: las invitaciones
     creadas antes siguen funcionando con valores por defecto) ---------- */

  /** Pareja tipográfica (ver config/diseno.ts) */
  tipografia?: string;
  /** Iniciales del monograma; si se omite se derivan del título */
  monograma?: string;
  /** Etiqueta social del evento, ej. "#CamilaYLucas2026" */
  hashtag?: string;
  /** Despedida al final de la invitación */
  mensajeFinal?: string;
  /** Enlace directo a un audio (mp3) para la música de fondo */
  musicaUrl?: string;
  /** Corte de honor, padrinos, damas, ponentes… */
  padrinos?: { rol: string; nombre: string }[];
  /** Avisos para los invitados: parqueo, niños, hospedaje, etc. */
  notas?: { titulo: string; texto: string }[];
  /**
   * Lo que pidió el cliente en su formulario y el equipo tiene que aplicar
   * a mano (canción, ambiente musical, referencias de diseño…).
   * NUNCA se publica: solo se ve en el editor del panel.
   */
  notasEquipo?: { titulo: string; texto: string }[];
  /** Efectos de la experiencia */
  efectos?: {
    sobre: boolean;      // apertura tipo sobre lacrado
    textura: boolean;    // grano de papel + viñeta
    musica: boolean;     // reproductor flotante
  };
}

/** Valores por defecto de los campos nuevos (compatibilidad hacia atrás). */
export const EFECTOS_POR_DEFECTO = { sobre: true, textura: true, musica: false };

/** Confirmación de asistencia enviada por un invitado desde la invitación. */
export interface Confirmacion {
  id: string;
  invitacion_id: string;
  nombre: string;
  nombre_normalizado: string;
  asiste: boolean;
  /** Personas en total, incluyendo al invitado. 0 si no asiste. */
  cantidad: number;
  nota: string | null;
  creado_en: string;
  actualizado_en: string;
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
