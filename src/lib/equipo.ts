/**
 * QUIÉN ES DEL EQUIPO
 * ====================
 * "Tener sesión" y "ser del equipo" no son lo mismo, y confundirlos fue el
 * agujero más grande que tuvo el sistema: la clave anon viaja en el
 * navegador, así que cualquiera puede registrarse contra nuestro proyecto de
 * Supabase y quedar autenticado. Quien manda de verdad es la lista blanca
 * `equipo` de la base (ver supabase/migrations/20260726135300_cerrar-acceso-equipo.sql).
 *
 * Este archivo es solo la decisión, sin nada de Supabase ni de Next, para
 * poder probarla: es una regla de seguridad con una excepción, y las
 * excepciones son lo que se rompe.
 */

/** Código de Postgres para "esa tabla no existe". */
export const TABLA_NO_EXISTE = "42P01";

/**
 * ¿Le dejamos entrar, a la vista de lo que respondió la base?
 *
 * SI LA TABLA TODAVÍA NO EXISTE, SE CEDE EL PASO. No es un descuido:
 *
 * El código y la migración que crea la tabla se despliegan por caminos
 * distintos —uno con git, la otra a mano en el SQL Editor— así que pueden
 * llegar en cualquier orden. Si el código llegara primero y aquí dijéramos
 * que no, el equipo se quedaría fuera de su propio panel sin saber por qué,
 * y la forma de arreglarlo estaría justo detrás de la puerta cerrada.
 *
 * Ceder ahí no abre nada que no estuviera ya abierto: mientras la migración
 * no corra, las políticas de la base siguen como estaban. En cuanto corre,
 * esta función empieza a decir la verdad y la RLS cierra.
 *
 * Cualquier otro fallo —permisos, red, consulta cancelada— es un no.
 */
export function decidirAcceso(
  fila: { usuario_id: string } | null,
  error: { code?: string } | null
): boolean {
  if (error) return error.code === TABLA_NO_EXISTE;
  return !!fila;
}
