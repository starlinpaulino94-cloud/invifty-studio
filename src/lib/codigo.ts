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
   PUENTE DE CONFIRMACIONES
   ============================================================ */

/** Nombre del canal de mensajes. Cualquier otro mensaje se ignora. */
export const CANAL = "invifty";

/**
 * Guion que se inyecta en el código pegado para que sus confirmaciones
 * lleguen al sistema.
 *
 * Hace falta porque el iframe va aislado: desde un origen opaco no se
 * puede llamar a nuestra API ni leer cookies. Lo único que sí puede es
 * mandarle un mensaje a la página que lo contiene, y que sea ella quien
 * guarde. El puente esconde ese ir y venir.
 *
 * Dos formas de usarlo, según lo que sepa quien escribe el HTML:
 *
 *  1. Un formulario normal marcado con `data-invifty-rsvp`, cuyos campos
 *     se llamen nombre / asiste / cantidad / nota. Cero JavaScript.
 *  2. `invifty.confirmar({...})`, que devuelve una promesa, para flujos
 *     propios.
 */
const PUENTE = `
<script>
(function () {
  var pendientes = {}, n = 0;

  window.invifty = {
    confirmar: function (datos) {
      return new Promise(function (resolver) {
        var id = "m" + (++n);
        pendientes[id] = resolver;
        parent.postMessage({ canal: "${CANAL}", accion: "rsvp", id: id, datos: datos }, "*");
      });
    }
  };

  window.addEventListener("message", function (e) {
    var m = e.data;
    if (!m || m.canal !== "${CANAL}" || m.accion !== "rsvp:respuesta") return;
    var resolver = pendientes[m.id];
    if (resolver) { delete pendientes[m.id]; resolver(m.resultado); }
  });

  // Cableado automático de <form data-invifty-rsvp>
  document.addEventListener("submit", function (e) {
    var f = e.target;
    if (!f || !f.matches || !f.matches("[data-invifty-rsvp]")) return;
    e.preventDefault();

    var d = new FormData(f);
    f.setAttribute("data-invifty-estado", "enviando");

    window.invifty.confirmar({
      nombre: d.get("nombre"),
      asiste: d.get("asiste") !== "no",
      cantidad: Number(d.get("cantidad") || 1),
      nota: d.get("nota") || ""
    }).then(function (res) {
      f.setAttribute("data-invifty-estado", res && res.ok ? "ok" : "error");
      var aviso = f.querySelector("[data-invifty-mensaje]");
      if (aviso) {
        aviso.textContent = res && res.ok
          ? "¡Gracias por confirmar!"
          : (res && res.error) || "No se pudo guardar tu confirmación.";
      }
    });
  });
})();
</script>`;

/**
 * Añade el puente al final del código pegado. Si el HTML tiene </body> se
 * pone justo antes, para que el guion corra con el documento ya montado.
 */
export function inyectarPuente(html: string): string {
  if (!html.trim()) return html;
  const cierre = /<\/body\s*>/i;
  return cierre.test(html) ? html.replace(cierre, `${PUENTE}\n</body>`) : html + PUENTE;
}

/** Lo que el código pegado manda al confirmar. */
export interface MensajeRsvp {
  canal: typeof CANAL;
  accion: "rsvp";
  id: string;
  datos: { nombre?: unknown; asiste?: unknown; cantidad?: unknown; nota?: unknown };
}

/** Comprueba que un mensaje recibido es una confirmación con la forma esperada. */
export function esMensajeRsvp(dato: unknown): dato is MensajeRsvp {
  if (!dato || typeof dato !== "object") return false;
  const m = dato as Record<string, unknown>;
  return (
    m.canal === CANAL &&
    m.accion === "rsvp" &&
    typeof m.id === "string" &&
    !!m.datos &&
    typeof m.datos === "object"
  );
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
