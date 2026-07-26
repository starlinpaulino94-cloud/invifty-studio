import type { FotoInvitacion } from "./tipos";

/**
 * INVITACIONES CON CÓDIGO PROPIO
 * ===============================
 * Permite publicar en el sistema una invitación hecha fuera de él —por
 * ejemplo con IA— y administrarla como cualquier otra: su dirección, su
 * vista previa al compartir, su contador de visitas y su vencimiento.
 *
 * SEGURIDAD — por qué va en un iframe aislado
 * --------------------------------------------
 * Este HTML lo escribe una herramienta externa y puede traer JavaScript.
 * Servido tal cual en nuestro dominio compartiría origen con /panel, así
 * que un script podría leer la sesión del equipo.
 *
 * Por eso se sirve dentro de un iframe con `sandbox` SIN `allow-same-origin`
 * (ver ATRIBUTOS_SANDBOX): el navegador le asigna un origen opaco, y desde
 * ahí no puede tocar cookies, ni almacenamiento, ni la página que lo
 * contiene. Puede pintar y animar lo que quiera, y nada más.
 *
 * De ahí que NO se filtre ni se limpie el HTML: el aislamiento es la
 * frontera de seguridad, y limpiarlo solo rompería código legítimo.
 */

/** Valor de `plantilla` que marca una invitación de código propio. */
export const PLANTILLA_CODIGO = "codigo";

export function esInvitacionDeCodigo(plantilla?: string | null): boolean {
  return plantilla === PLANTILLA_CODIGO;
}

/**
 * Permisos del iframe. Falta `allow-same-origin` a propósito: es lo que
 * mantiene el código en un origen opaco, sin acceso a la sesión del panel.
 * Los demás permisos son para que la invitación se comporte con
 * naturalidad: animaciones, enlaces que abren, formularios propios.
 */
export const ATRIBUTOS_SANDBOX =
  "allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms allow-modals";

/* ============================================================
   MARCADORES
   ============================================================ */

/**
 * Marcadores que el equipo puede dejar en el HTML para que el sistema
 * ponga los datos reales del pedido. Sin esto habría que pegar a mano las
 * direcciones de las fotos, que además caducan.
 */
export const MARCADORES_DISPONIBLES = [
  { marcador: "{{PORTADA}}", descripcion: "Dirección de la foto de portada" },
  { marcador: "{{FOTO_1}}", descripcion: "Primera foto (FOTO_2, FOTO_3… para el resto)" },
  { marcador: "{{TITULO}}", descripcion: "Título de la invitación" },
  { marcador: "{{FECHA}}", descripcion: "Fecha del evento, en palabras" },
];

/**
 * Sustituye los marcadores por los datos reales.
 *
 * Un marcador que no tenga valor —una foto que no existe— se reemplaza por
 * cadena vacía en vez de quedarse escrito: es preferible una imagen que no
 * carga a que el invitado lea "{{FOTO_7}}" en su invitación.
 */
export function aplicarMarcadores(
  html: string,
  datos: { fotos: FotoInvitacion[]; titulo?: string; fecha?: string }
): string {
  const { fotos, titulo = "", fecha = "" } = datos;

  return html.replace(/\{\{\s*([A-Z_]+[0-9]*)\s*\}\}/g, (_todo, nombre: string) => {
    if (nombre === "TITULO") return titulo;
    if (nombre === "FECHA") return fecha;
    if (nombre === "PORTADA") return fotos[0]?.url ?? "";

    const foto = /^FOTO_(\d+)$/.exec(nombre);
    if (foto) return fotos[Number(foto[1]) - 1]?.url ?? "";

    // Un marcador desconocido se deja tal cual: probablemente sea parte
    // del propio diseño (una plantilla de texto, por ejemplo).
    return _todo;
  });
}

/* ============================================================
   REVISIÓN AL PEGAR EL CÓDIGO
   ============================================================ */

export interface AvisoCodigo {
  tipo: "error" | "aviso";
  texto: string;
}

/**
 * Comprobaciones rápidas sobre el código pegado. No bloquean nada: son
 * avisos para que el equipo detecte antes de publicar los descuidos que
 * de otro modo vería el invitado.
 */
export function revisarCodigo(html: string): AvisoCodigo[] {
  const avisos: AvisoCodigo[] = [];
  const limpio = html.trim();

  if (!limpio) {
    return [{ tipo: "error", texto: "Todavía no has pegado el código de la invitación." }];
  }

  if (!/<[a-z][\s\S]*>/i.test(limpio)) {
    avisos.push({ tipo: "error", texto: "Esto no parece HTML: no se encontró ninguna etiqueta." });
  }

  if (/<script[^>]*\ssrc\s*=\s*["']?http:\/\//i.test(limpio)) {
    avisos.push({
      tipo: "aviso",
      texto: "Hay un script cargado por http:// sin cifrar; muchos navegadores lo bloquearán.",
    });
  }

  if (/\ssrc\s*=\s*["']http:\/\//i.test(limpio)) {
    avisos.push({
      tipo: "aviso",
      texto: "Hay imágenes o recursos por http:// sin cifrar: no se verán en la invitación publicada.",
    });
  }

  if (/\s(href|src)\s*=\s*["']\.{0,2}\//i.test(limpio)) {
    avisos.push({
      tipo: "aviso",
      texto:
        "Hay rutas relativas (empiezan por / o ./). El código se sirve aislado y no puede " +
        "resolverlas: usa direcciones completas o los marcadores de foto.",
    });
  }

  if (!/\{\{\s*(PORTADA|FOTO_\d+)\s*\}\}/.test(limpio) && /<img/i.test(limpio)) {
    avisos.push({
      tipo: "aviso",
      texto:
        "Hay imágenes pero ningún marcador de foto. Si querías usar las fotos del cliente, " +
        "pon {{PORTADA}} o {{FOTO_1}} en el src.",
    });
  }

  return avisos;
}
