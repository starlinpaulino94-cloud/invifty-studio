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
  | "vencida"
  | "cancelado";

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
  /** Cuándo se avisó al equipo de que esta invitación está por vencer. */
  aviso_vencimiento_en: string | null;
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
  tipo: "pago" | "reembolso" | "ajuste";
  /** Un pago anulado se tacha, no se borra: el balance lo ignora (lib/pagos.ts). */
  anulado_en: string | null;
  anulado_por: string | null;
  motivo_anulacion: string | null;
  /** Número de transferencia/Zelle, para cruzar con el banco. */
  referencia: string | null;
  /** Cuándo ENTRÓ el dinero (no cuándo se anotó). */
  fecha_efectiva: string | null;
  usuario_id: string | null;
  usuario_email: string | null;
  clave_idempotencia: string | null;
  /** Ruta del voucher en el bucket privado (comprobantes/<pedido>/...). */
  comprobante_ruta: string | null;
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

/** Interesado llegado desde la web pública (POST /api/public/leads). */
export type EstadoLead = "nuevo" | "contactado" | "calificado" | "convertido" | "perdido";

export interface Lead {
  id: string;
  nombre: string;
  telefono: string;
  tipo_evento: string;
  fecha_evento: string | null;
  plan_id: Plan | null;
  demo_slug: string | null;
  mensaje: string | null;
  idioma: string;
  fuente: string;
  utm: Record<string, string>;
  consentimiento: boolean;
  clave_idempotencia: string;
  estado: EstadoLead;
  cliente_id: string | null;
  convertido_en: string | null;
  convertido_por: string | null;
  creado_en: string;
  actualizado_en: string;
}

/** Marca de "esta invitación se enseña de demo en la web" (GET /api/public/demos). */
export interface Demo {
  id: string;
  invitacion_id: string;
  tipo_evento: string;
  plan_minimo: Plan;
  orden: number;
  destacada: boolean;
  activa: boolean;
  idioma: string;
  creado_en: string;
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

/** Cuánto adorno lleva la invitación. */
export type DensidadOrnamental = "sobrio" | "equilibrado" | "extravagante";

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
  /**
   * Cuánto adorno lleva la invitación (ver DENSIDADES en config/diseno.ts).
   * Si se omite vale "equilibrado", que es exactamente el aspecto que ha
   * tenido siempre: ninguna invitación existente cambia por esto.
   */
  densidad?: DensidadOrnamental;
  /**
   * Orden en que se muestran las fotos, por nombre de archivo. La primera
   * es la PORTADA. Las que no estén aquí van después, en el orden en que
   * las subió el cliente. Si se omite, manda ese orden de subida.
   */
  ordenFotos?: string[];
  /** Fotos que el cliente subió pero que no salen en la invitación. */
  fotosOcultas?: string[];
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
    sobre: boolean;         // apertura tipo sobre lacrado
    textura: boolean;       // grano de papel + viñeta
    musica: boolean;        // reproductor flotante
    videoPortada: boolean;  // el video del cliente, en bucle, de portada
  };
}

/** Valores por defecto de los campos nuevos (compatibilidad hacia atrás). */
export const EFECTOS_POR_DEFECTO = {
  sobre: true,
  textura: true,
  musica: false,
  // Encendido por defecto: si el cliente subió un video es porque lo quiere
  // en su portada, que es justo lo que le vendió el plan Luxury. Sin video
  // no cambia nada. El equipo puede apagarlo desde el editor.
  videoPortada: true,
};

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
  /**
   * HTML de una invitación hecha fuera del sistema (por ejemplo con IA).
   * Solo se usa cuando `plantilla` es PLANTILLA_CODIGO.
   */
  codigo_html: string | null;
  /**
   * Dominio propio del cliente (extra del catálogo), sin protocolo ni
   * "www". Vacío en la mayoría: la invitación vive en /i/<slug>.
   */
  dominio: string | null;
  /**
   * Enlace secreto del panel del anfitrión: /lista/<token_lista>. Se crea
   * junto con la invitación (ver acciones-invitacion.ts).
   */
  token_lista: string | null;
  /**
   * El candado de la aprobación: cuando el cliente aprueba una versión,
   * aquí queda la fecha y el editor deja de guardar. Desbloquear es un
   * acto explícito que firma en auditoría (acciones-revision.ts).
   */
  bloqueada_en: string | null;
  estado: EstadoInvitacion;
  publicada_en: string | null;
  creado_en: string;
  actualizado_en: string;
}
