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

/* ============================================================
   EL FRENO COMPARTIDO (entre instancias)
   ============================================================ */

/**
 * Lo que devuelve la función `frenar()` de Postgres
 * (migrations/20260805230000_escala.sql).
 */
export interface FilaFreno {
  permitido: boolean;
  espera_s: number;
}

/**
 * Traduce la respuesta de la base a un veredicto. Pura y aparte para
 * poder probarla: una fila rara (null, campos que faltan) se trata como
 * PERMITIDO — la política de fallo del freno compartido es abrir, no
 * cerrar (ver limitarCompartido).
 */
export function veredictoDeFreno(fila: unknown): Veredicto {
  if (fila && typeof fila === "object" && (fila as FilaFreno).permitido === false) {
    const espera = Number((fila as FilaFreno).espera_s);
    return { ok: false, esperaS: Number.isFinite(espera) && espera > 0 ? espera : 60 };
  }
  return { ok: true, esperaS: 0 };
}

/** Para no llenar el log si la migración no está: se avisa una vez. */
let faltaAvisado = false;

/**
 * El freno de verdad para rutas públicas de escritura: primero el local
 * (gratis, corta el bucle casero sin tocar la base) y después el
 * COMPARTIDO — el contador único en Postgres que ven todas las
 * instancias de Vercel a la vez, con una operación atómica.
 *
 * POLÍTICA DE FALLO: ABIERTO. Si la función no existe (migración
 * pendiente) o la base no responde, la petición pasa con el freno local
 * como única defensa, y se anota en el log. La alternativa —cerrar—
 * convertiría cualquier hipo de Supabase en "ningún invitado puede
 * confirmar", que es un daño seguro contra un riesgo hipotético.
 */
export async function limitarCompartido(
  admin: { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }> },
  clave: string,
  { max, ventanaS }: { max: number; ventanaS: number }
): Promise<Veredicto> {
  const local = limitar(clave, { max, ventanaMs: ventanaS * 1000 });
  if (!local.ok) return local;

  try {
    const { data, error } = await admin.rpc("frenar", {
      p_clave: clave,
      p_max: max,
      p_ventana_s: ventanaS,
    });
    if (error) throw new Error(error.message);
    return veredictoDeFreno(Array.isArray(data) ? data[0] : data);
  } catch (e) {
    if (!faltaAvisado) {
      faltaAvisado = true;
      console.error(
        "Freno compartido sin funcionar (¿falta la migración 20260805230000_escala.sql?). " +
          "Sigue activo el freno local por instancia.",
        e instanceof Error ? e.message : e
      );
    }
    return { ok: true, esperaS: 0 };
  }
}
