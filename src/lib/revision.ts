/**
 * LA REVISIÓN DEL CLIENTE
 * ========================
 * El cliente no tiene cuenta y no debe necesitarla: revisa su invitación
 * con un enlace secreto /revision/<token>, igual que rellenó su
 * formulario en /f/<token>. Lo que sí cambia respecto al formulario es
 * el peso de lo que ahí pasa: una aprobación es un "sí, publícala así",
 * y eso exige tres cosas que el formulario no exigía:
 *
 *  1. VERSIONES INMUTABLES. Se aprueba una foto exacta (tabla
 *     `versiones`, protegida por trigger), no "lo que haya en el editor
 *     ahora mismo". Si el equipo edita después, la aprobación no se
 *     mueve con la edición: apunta a la versión que el cliente vio.
 *  2. TOKEN CON CADUCIDAD Y REVOCABLE. Un enlace de revisión reenviado
 *     por WhatsApp acaba donde acaba; que muera solo a los 30 días y
 *     que el equipo pueda matarlo antes.
 *  3. CANDADO TRAS APROBAR. Aprobado ≠ editable: la invitación se
 *     bloquea contra el "toque rápido" que nadie pidió, y desbloquear
 *     es un acto explícito que queda en auditoría.
 */

/** El enlace de revisión muere solo, aunque nadie se acuerde de él. */
export const REVISION_DIAS_VIGENCIA = 30;

/**
 * Sobre qué puede comentar el cliente. Coincide con las secciones que la
 * invitación dibuja; "general" es el cajón para lo que no encaja en una.
 */
export const SECCIONES_COMENTABLES = [
  "general",
  "portada",
  "historia",
  "galeria",
  "cronograma",
  "regalos",
  "rsvp",
  "textos",
] as const;

export type SeccionComentable = (typeof SECCIONES_COMENTABLES)[number];

export function seccionValida(seccion: string): seccion is SeccionComentable {
  return (SECCIONES_COMENTABLES as readonly string[]).includes(seccion);
}

export interface RevisionVigencia {
  estado: "abierta" | "cambios_solicitados" | "aprobada";
  expira_en: string;
  revocada_en: string | null;
}

/**
 * El estado REAL de una revisión, que no es solo la columna `estado`:
 * una revisión revocada o caducada deja de valer aunque estuviera
 * abierta. El orden importa — revocada gana a todo (el equipo la mató a
 * propósito), y una aprobación hecha A TIEMPO sigue siendo válida como
 * evidencia aunque el enlace caduque después.
 */
export type EstadoRevision =
  | "abierta"
  | "cambios_solicitados"
  | "aprobada"
  | "revocada"
  | "expirada";

export function estadoDeRevision(revision: RevisionVigencia, ahora: Date): EstadoRevision {
  if (revision.revocada_en) return "revocada";
  if (revision.estado === "aprobada") return "aprobada";
  if (new Date(revision.expira_en).getTime() <= ahora.getTime()) return "expirada";
  return revision.estado;
}

/** Solo una revisión viva y sin decidir acepta comentarios o decisión. */
export function puedeDecidir(revision: RevisionVigencia, ahora: Date): boolean {
  return estadoDeRevision(revision, ahora) === "abierta";
}

/** Cuándo caduca un enlace creado ahora. */
export function fechaExpiracion(ahora: Date): string {
  return new Date(ahora.getTime() + REVISION_DIAS_VIGENCIA * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Token opaco para enlaces sin cuenta: 128 bits de azar en hex, el mismo
 * trato que el formulario (/f) y el panel del anfitrión (/lista). No
 * lleva ningún dato del cliente: quien lo mire solo ve ruido.
 */
export function tokenOpaco(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

/** Etiquetas humanas para el panel y la página de revisión. */
export const NOMBRE_ESTADO_REVISION: Record<EstadoRevision, string> = {
  abierta: "Esperando al cliente",
  cambios_solicitados: "Pidió cambios",
  aprobada: "Aprobada",
  revocada: "Revocada",
  expirada: "Caducada",
};

export const NOMBRE_SECCION: Record<SeccionComentable, string> = {
  general: "General",
  portada: "Portada",
  historia: "Historia",
  galeria: "Galería",
  cronograma: "Cronograma",
  regalos: "Regalos",
  rsvp: "Confirmación",
  textos: "Textos",
};

/* ============================================================
   LA IMAGEN DE REFERENCIA DEL COMENTARIO
   ============================================================ */

/** "Quiero algo así" necesita un así: imágenes, no cualquier archivo. */
export const REFERENCIA_TIPOS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const REFERENCIA_MAX_MB = 8;

/** Tope de imágenes por revisión: protege el Storage sin limitar a nadie real. */
export const MAX_REFERENCIAS_POR_REVISION = 10;

/**
 * Un comentario vale si trae texto O imagen: "mira esta referencia" sin
 * palabras es un comentario legítimo, y un texto sin imagen también.
 * Vacío del todo, no.
 */
export function comentarioValido(texto: string, tieneImagen: boolean): boolean {
  return texto.trim().length >= 2 || tieneImagen;
}
