/**
 * FRENO DE PETICIONES (rate limit)
 * =================================
 * Cuatro rutas de /api son públicas a propósito: el invitado que confirma,
 * el cliente que rellena su formulario y sube fotos. Sin freno, una sola
 * persona con un bucle puede llenar la tabla de confirmaciones de basura,
 * llenar el Storage de archivos de 50 MB, o dejarnos sin cuota de Supabase.
 *
 * HASTA DÓNDE LLEGA ESTO — importa saberlo
 * -----------------------------------------
 * El contador vive en la memoria del proceso. En Vercel eso significa que
 * cada instancia lleva el suyo y que se borra cuando la función se duerme.
 * O sea: frena el bucle casero, que es lo que de verdad pasa; no frena un
 * ataque repartido entre muchas máquinas.
 *
 * Se hace así porque el proyecto no tiene Redis ni Vercel KV, y montarlo
 * costaría más que el problema que resuelve hoy. Si algún día hace falta de
 * verdad, lo único que hay que cambiar es esta función: quienes la llaman
 * ya están puestos.
 *
 * La memoria no crece sin control: cada escritura barre lo caducado.
 */

export interface Veredicto {
  /** false = hay que devolver 429. */
  ok: boolean;
  /** Segundos que faltan para que se le vuelva a permitir. */
  esperaS: number;
}

interface Ventana {
  cuenta: number;
  /** Momento en que la ventana caduca y el contador vuelve a cero. */
  expiraEn: number;
}

const ventanas = new Map<string, Ventana>();

/** Cada cuántas escrituras se hace la limpieza. Barrer en todas sería caro. */
const CADA_CUANTO_SE_BARRE = 500;
let escrituras = 0;

function barrerCaducadas(ahora: number) {
  for (const [clave, ventana] of ventanas) {
    if (ventana.expiraEn <= ahora) ventanas.delete(clave);
  }
}

/**
 * Cuenta una petición y dice si se permite.
 *
 * Ventana fija: el primer intento abre una ventana de `ventanaMs` y dentro
 * de ella caben `max` peticiones. Es menos fino que una ventana deslizante
 * —justo al cambiar de ventana se cuela un pico del doble— y es mucho más
 * barato. Para frenar abusos sobra.
 *
 * @param clave  A quién se le cuenta: IP, token del formulario, lo que sea.
 *               Conviene prefijarla con la ruta ("rsvp:1.2.3.4") para que
 *               dos rutas distintas no compartan cupo.
 * @param ahora  Inyectable para poder probarlo sin esperar de verdad.
 */
export function limitar(
  clave: string,
  { max, ventanaMs }: { max: number; ventanaMs: number },
  ahora: number = Date.now()
): Veredicto {
  if (++escrituras % CADA_CUANTO_SE_BARRE === 0) barrerCaducadas(ahora);

  const ventana = ventanas.get(clave);

  // Primera petición, o la anterior ya caducó: ventana nueva.
  if (!ventana || ventana.expiraEn <= ahora) {
    ventanas.set(clave, { cuenta: 1, expiraEn: ahora + ventanaMs });
    return { ok: true, esperaS: 0 };
  }

  if (ventana.cuenta >= max) {
    return { ok: false, esperaS: Math.ceil((ventana.expiraEn - ahora) / 1000) };
  }

  ventana.cuenta++;
  return { ok: true, esperaS: 0 };
}

/** Solo para las pruebas: deja el contador como recién arrancado. */
export function olvidarTodo() {
  ventanas.clear();
  escrituras = 0;
}

/**
 * La IP de quien pide, según las cabeceras que pone Vercel. Cuando no hay
 * ninguna (una petición local, por ejemplo) todos comparten la clave
 * "desconocida": es lo prudente, porque prefiere frenar de más a dejar un
 * agujero por el que colarse mandando la cabecera vacía.
 */
export function ipDePeticion(cabeceras: Headers): string {
  const reenviada = cabeceras.get("x-forwarded-for");
  if (reenviada) return reenviada.split(",")[0]!.trim();
  return cabeceras.get("x-real-ip")?.trim() || "desconocida";
}
