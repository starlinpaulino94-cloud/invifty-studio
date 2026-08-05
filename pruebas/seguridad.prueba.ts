import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { decidirAcceso, TABLA_NO_EXISTE } from "@/lib/equipo";

/**
 * LO QUE NO PUEDE VOLVER A QUEDAR ABIERTO
 * ========================================
 * Dos agujeros que ya estuvieron ahí y que ninguna prueba habría notado,
 * porque el sistema funcionaba perfectamente con ellos puestos. Esa es la
 * clase de fallo que estas pruebas vigilan: el que no se nota.
 */

const raiz = path.resolve(import.meta.dirname, "..");

/* =====================================================================
 * 1. Las políticas de la base de datos
 * =====================================================================
 * `for all to authenticated using (true)` suena a "solo el equipo" y no lo
 * es: "authenticated" es cualquiera con una sesión en nuestro proyecto de
 * Supabase, y la clave anon va en el navegador, así que registrarse es
 * gratis. Con esa política puesta, un extraño leía la tabla de clientes
 * entera sin pasar por el panel: hablando directo con la API de Supabase.
 */

const TABLAS_CON_DATOS = [
  "clientes", "pedidos", "pagos", "formularios",
  "invitaciones", "confirmaciones", "visitas",
];

function sqlDelProyecto(): { archivo: string; contenido: string }[] {
  const dir = path.join(raiz, "supabase");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .map((f) => ({ archivo: f, contenido: readFileSync(path.join(dir, f), "utf8") }));
}

test("ninguna política deja entrar a todo el que esté autenticado", () => {
  for (const { archivo, contenido } of sqlDelProyecto()) {
    // Se mira el texto tal cual: lo que cuenta es lo que se va a ejecutar
    // en el SQL Editor, no lo que creamos que dice.
    const abiertas = contenido
      .split("\n")
      .map((linea, i) => ({ linea: linea.trim(), n: i + 1 }))
      .filter(({ linea }) => /^for\s+all\s+to\s+authenticated\s+using\s*\(\s*true\s*\)/.test(linea));

    assert.equal(
      abiertas.length,
      0,
      `${archivo}:${abiertas[0]?.n} deja pasar a cualquiera que se registre. ` +
        `Usa: using (public.es_del_equipo()) with check (public.es_del_equipo())`
    );
  }
});

test("todas las tablas con datos de clientes piden ser del equipo", () => {
  const esquema = readFileSync(path.join(raiz, "supabase", "schema.sql"), "utf8");

  for (const tabla of TABLAS_CON_DATOS) {
    const politica = new RegExp(
      `create policy "[^"]*${tabla}" on public\\.${tabla}[\\s\\S]{0,200}?;`
    ).exec(esquema);

    assert.ok(politica, `no encuentro la política de ${tabla} en schema.sql`);
    assert.match(
      politica[0],
      /es_del_equipo\(\)/,
      `la política de ${tabla} no comprueba que sea del equipo`
    );
  }
});

test("la lista del equipo no se la puede escribir uno mismo", () => {
  // Si `equipo` tuviera una política de insert para authenticated, quien se
  // registrara podría añadirse solo y todo lo demás daría igual.
  for (const { archivo, contenido } of sqlDelProyecto()) {
    const politicasDeEquipo = contenido.match(/create policy[^;]*on public\.equipo[^;]*;/g) ?? [];
    for (const politica of politicasDeEquipo) {
      assert.match(
        politica,
        /for\s+select/,
        `${archivo}: sobre la tabla equipo solo puede haber políticas de lectura`
      );
    }
  }
});

/* =====================================================================
 * 2. Las cabeceras de seguridad
 * =====================================================================
 * Y, sobre todo, la que NO se puede poner: ver el comentario largo de
 * next.config.ts. Un CSP que limite scripts se hereda dentro del iframe
 * `srcDoc` y mata las invitaciones de código propio, que son de pago.
 */

const configuracionNext = readFileSync(path.join(raiz, "next.config.ts"), "utf8");

/**
 * El archivo sin comentarios. Hace falta porque el propio next.config.ts
 * explica largo y tendido por qué NO lleva ciertas cosas: buscarlas en el
 * texto entero encontraría la explicación y no el código.
 */
const codigoNext = configuracionNext
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "");

test("las cabeceras básicas están puestas", () => {
  for (const cabecera of [
    "X-Content-Type-Options",
    "Referrer-Policy",
    "Strict-Transport-Security",
  ]) {
    assert.match(configuracionNext, new RegExp(cabecera), `falta ${cabecera}`);
  }
});

test("el panel no se puede meter en un iframe ajeno", () => {
  assert.match(configuracionNext, /X-Frame-Options["\s:,]+value:\s*"DENY"/);
  assert.match(configuracionNext, /source:\s*"\/panel\/:path\*"/);
});

test("no hay un CSP que limite scripts: rompería las invitaciones de código", () => {
  // Esta prueba parece decir lo contrario de lo que se espera de una
  // prueba de seguridad, y por eso lleva explicación:
  //
  // El HTML que trae el cliente (a veces hecho con IA) se muestra en un
  // iframe con `srcDoc`. Un documento srcdoc no hace petición de red, así
  // que HEREDA el CSP de la página de fuera. Un `script-src 'self'` en la
  // página de la invitación —o en el panel, que enseña la misma vista
  // previa— dejaría sin JavaScript, sin tipografías y sin imágenes al
  // diseño del cliente. Invitaciones ya pagadas.
  //
  // El aislamiento de ese HTML no lo da el CSP: lo da el iframe con
  // `sandbox` y sin `allow-same-origin` (ver lib/codigo.ts), que es lo que
  // vigila codigo.prueba.ts.
  assert.doesNotMatch(
    codigoNext,
    /script-src/,
    "un script-src aquí se hereda dentro del srcDoc y rompe las invitaciones de código propio"
  );
});

test("la cámara sigue permitida: el cliente sube fotos desde el móvil", () => {
  const permisos = /Permissions-Policy["\s:,]+value:\s*"([^"]*)"/.exec(configuracionNext);
  assert.ok(permisos, "falta Permissions-Policy");
  assert.doesNotMatch(
    permisos[1],
    /camera=\(\)/,
    "apagar la cámara puede impedir subir fotos desde el móvil"
  );
});

test("HSTS no arrastra los subdominios de los clientes", () => {
  // Esta cabecera también viaja por el dominio propio de cada cliente. Con
  // includeSubDomains le obligaríamos a HTTPS todo lo que tenga colgando,
  // que no es nuestro. Y preload, encima, es casi irreversible.
  const hsts = /Strict-Transport-Security["\s:,]+value:\s*"([^"]*)"/.exec(configuracionNext);
  assert.ok(hsts, "falta Strict-Transport-Security");
  assert.doesNotMatch(hsts[1], /includeSubDomains|preload/);
});

/* =====================================================================
 * 3. Quién entra al panel
 * ===================================================================== */

test("está en la lista: entra", () => {
  assert.equal(decidirAcceso({ usuario_id: "abc" }, null), true);
});

test("tiene sesión pero no está en la lista: no entra", () => {
  // El caso que importa: alguien que se registró con la clave anon, que es
  // pública. Está autenticado y aun así no le toca nada.
  assert.equal(decidirAcceso(null, null), false);
});

test("si la tabla todavía no existe, se cede el paso", () => {
  // El código y la migración se despliegan por caminos distintos: uno con
  // git, la otra a mano en el SQL Editor. Si llegara antes el código y aquí
  // dijéramos que no, el equipo se quedaría fuera de su propio panel y la
  // forma de arreglarlo estaría detrás de la puerta cerrada.
  //
  // No abre nada nuevo: mientras la migración no corra, las políticas de la
  // base siguen como estaban de todos modos.
  assert.equal(decidirAcceso(null, { code: TABLA_NO_EXISTE }), true);
});

test("cualquier otro fallo es un no", () => {
  // La excepción de arriba es SOLO para la tabla que falta. Un fallo de red
  // o de permisos no puede convertirse en una puerta abierta.
  assert.equal(decidirAcceso(null, { code: "42501" }), false, "permiso denegado");
  assert.equal(decidirAcceso(null, { code: "57014" }), false, "consulta cancelada");
  assert.equal(decidirAcceso(null, {}), false, "fallo sin código");
});

/* =====================================================================
 * 4. Las rutas públicas llevan freno
 * ===================================================================== */

test("las rutas públicas de escritura llaman al freno", () => {
  const conFreno = [
    "src/app/api/invitacion/[slug]/rsvp/route.ts",
    "src/app/api/formulario/[token]/route.ts",
    "src/app/api/formulario/[token]/fotos/route.ts",
  ];

  for (const ruta of conFreno) {
    const contenido = readFileSync(path.join(raiz, ruta), "utf8");
    // Vale el freno local (limitar) o el compartido entre instancias
    // (limitarCompartido, que además incluye al local por dentro).
    assert.match(contenido, /limitar(Compartido)?\(/, `${ruta} no frena las peticiones`);
    assert.match(contenido, /429/, `${ruta} no responde 429 cuando frena`);
  }
});

test("las rutas MÁS públicas usan el freno compartido entre instancias", () => {
  // Estas las puede llamar cualquiera de internet sin token: el freno de
  // memoria por instancia no basta cuando Vercel reparte el tráfico.
  const compartido = [
    "src/app/api/public/leads/route.ts",
    "src/app/api/invitacion/[slug]/rsvp/route.ts",
    "src/app/api/revision/[token]/comentario/route.ts",
    "src/app/api/revision/[token]/decidir/route.ts",
  ];
  for (const ruta of compartido) {
    const contenido = readFileSync(path.join(raiz, ruta), "utf8");
    assert.match(contenido, /limitarCompartido\(/, `${ruta} no usa el freno compartido`);
  }
});

test("la subida de fotos frena ANTES de leer el archivo", () => {
  // Si el freno fuera después de req.formData(), ya nos habríamos tragado
  // los 50 MB y el freno no ahorraría lo que más cuesta.
  const contenido = readFileSync(
    path.join(raiz, "src/app/api/formulario/[token]/fotos/route.ts"),
    "utf8"
  );
  assert.ok(
    contenido.indexOf("limitar(") < contenido.indexOf("req.formData()"),
    "el freno tiene que ir antes de leer el cuerpo de la petición"
  );
});

test("las rutas de mantenimiento siguen pidiendo sesión", () => {
  // Una de ellas reescribe fechas de vencimiento de todos los pedidos.
  for (const ruta of [
    "src/app/api/panel/mantenimiento/vencimientos/route.ts",
    "src/app/api/panel/mantenimiento/fotos/route.ts",
  ]) {
    const contenido = readFileSync(path.join(raiz, ruta), "utf8");
    const metodos = contenido.match(/export async function (GET|POST)/g) ?? [];
    assert.ok(metodos.length > 0, `${ruta} no exporta métodos`);
    assert.equal(
      (contenido.match(/await haySesion\(\)/g) ?? []).length,
      metodos.length,
      `${ruta}: cada método tiene que comprobar la sesión por su cuenta`
    );
  }
});
