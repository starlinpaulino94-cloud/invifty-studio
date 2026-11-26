/**
 * CUÁNDO DOS FICHAS SON LA MISMA PERSONA
 * =======================================
 * Pasó de verdad: el propietario creaba un pedido nuevo y la ficha salía a
 * nombre de un cliente de prueba que él no había vuelto a escribir. No era
 * un fantasma: `crearPedido` (lib/acciones.ts) reutiliza el cliente cuyo
 * WhatsApp coincide — misma persona, una sola ficha — y lo hacía en
 * silencio. Escribías "Camila", el número era el de la prueba, y el pedido
 * se colgaba de la ficha vieja sin decir nada.
 *
 * La regla sigue siendo la buena (un WhatsApp = una persona). Lo que
 * cambia es que ahora se ve: si el nombre tecleado NO se parece al
 * guardado, el sistema para y pregunta en vez de decidir por su cuenta.
 */

/** Nombre comparable: sin acentos, sin mayúsculas, sin espacios de más. */
export function nombreComparable(nombre: string): string {
  return (nombre ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036F]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * ¿El nombre tecleado y el guardado son la misma persona?
 *
 * Se acepta la variación normal de quien escribe deprisa: acentos,
 * mayúsculas, un apellido de más o de menos ("Camila" y "Camila
 * Rodríguez"). No se acepta un nombre distinto: ahí hay que preguntar.
 */
export function mismaPersona(tecleado: string, guardado: string): boolean {
  const a = nombreComparable(tecleado);
  const b = nombreComparable(guardado);
  if (!a || !b) return false;
  if (a === b) return true;

  // Uno contiene al otro por palabras completas: "camila" ⊂ "camila rodriguez".
  const pa = a.split(" ");
  const pb = b.split(" ");
  const corto = pa.length <= pb.length ? pa : pb;
  const largo = pa.length <= pb.length ? pb : pa;
  return corto.every((palabra) => largo.includes(palabra));
}

/**
 * El aviso que ve quien crea el pedido. Dice el nombre guardado a
 * propósito: sin él, "ya existe un cliente con ese número" no le sirve a
 * nadie para decidir si es un acierto o un dedazo en el teléfono.
 */
export function avisoClienteExistente(nombreGuardado: string): string {
  return `Este WhatsApp ya está guardado a nombre de «${nombreGuardado}». Si es la misma persona, el pedido se sumará a su ficha; si te equivocaste de número, corrígelo.`;
}

/** El freno del servidor, cuando nadie confirmó y los nombres no cuadran. */
export function errorClienteDistinto(
  nombreGuardado: string,
  telefono: string
): string {
  return `El WhatsApp ${telefono} ya está guardado a nombre de «${nombreGuardado}», no del nombre que escribiste. Vuelve atrás: si es la misma persona marca «Sí, es la misma persona» y guarda otra vez; si te equivocaste de número, corrígelo. El pedido no se creó.`;
}
