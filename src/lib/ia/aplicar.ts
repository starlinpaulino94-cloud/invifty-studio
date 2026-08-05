import type { ConceptoCreativo } from "./tipos";
import type { DatosInvitacion } from "../tipos";

/**
 * APLICAR UN CONCEPTO — el único puente entre la IA y la invitación
 * ==================================================================
 * Un concepto elegido no escribe en la base: se aplica AL ESTADO DEL
 * EDITOR, delante del equipo, con la vista previa en vivo enseñando el
 * antes y el después. Guardar sigue siendo el botón de siempre, con sus
 * permisos y su auditoría. La IA propone; la mano que guarda es humana.
 *
 * Esta función es una lista BLANCA: copia exactamente los campos que un
 * concepto puede tocar y ni uno más. Los datos factuales (fecha, hora,
 * lugares, RSVP, regalos…) ni se leen ni se escriben — la prueba
 * pruebas/ia.prueba.ts lo garantiza campo por campo.
 */

export type ModoAplicar = "todo" | "estilo" | "textos";

export function aplicarConcepto(
  datos: DatosInvitacion,
  concepto: ConceptoCreativo,
  modo: ModoAplicar
): { datos: DatosInvitacion; plantilla?: string } {
  const nuevos: DatosInvitacion = { ...datos };
  let plantilla: string | undefined;

  if (modo === "todo" || modo === "estilo") {
    nuevos.paleta = concepto.paleta;
    nuevos.tipografia = concepto.tipografia;
    nuevos.densidad = concepto.densidad;
    plantilla = concepto.plantilla;
  }

  if (modo === "todo" || modo === "textos") {
    // Solo los textos que el concepto trae: un copy vacío no borra lo escrito.
    if (concepto.copy.subtitulo) nuevos.subtitulo = concepto.copy.subtitulo;
    if (concepto.copy.frase) nuevos.frase = concepto.copy.frase;
    if (concepto.copy.mensajeFinal) nuevos.mensajeFinal = concepto.copy.mensajeFinal;
  }

  return { datos: nuevos, plantilla };
}
