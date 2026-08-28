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
 * 1b. El RLS multicuenta del portal de clientes
 * =====================================================================
 * El cliente firmado LEE lo suyo y nada más. Si una de estas guardas se
 * afloja, el fallo no se nota en ninguna pantalla: un cliente vería (o
 * escribiría) datos de otro hablando directo con la API de Supabase.
 */

test("las políticas del cliente son SOLO de lectura", () => {
  // Toda política cuyo nombre empiece por "cliente" o "miembro" es de la
  // capa del portal: si alguna deja de ser `for select`, un cliente puede
  // escribir en tablas cuyas validaciones viven en acciones de servidor.
  for (const { archivo, contenido } of sqlDelProyecto()) {
    const delPortal = contenido.match(/create policy "(cliente|miembro)[^"]*"[^;]*;/g) ?? [];
    for (const politica of delPortal) {
      assert.match(
        politica,
        /for\s+select/,
        `${archivo}: ${politica.slice(0, 60)}… debe ser solo de lectura`
      );
    }
    assert.ok(
      archivo !== "schema.sql" || delPortal.length >= 14,
      `schema.sql: faltan políticas del portal (hay ${delPortal.length})`
    );
  }
});

test("las políticas con subconsulta califican la referencia externa", () => {
  // Pasó de verdad: "cliente ve su cuenta" decía `m.cuenta_id = id` y ese
  // `id` se resolvía contra miembros_cuenta (que también tiene id) — la
  // condición era siempre falsa y el cliente no veía su propia cuenta.
  // Lo cazó probar-aislamiento.sql en producción (fila 15 en ❌).
  for (const { archivo, contenido } of sqlDelProyecto()) {
    assert.doesNotMatch(
      contenido,
      /m\.cuenta_id = id\b/,
      `${archivo}: referencia externa sin calificar — usa cuentas_cliente.id`
    );
  }
  const esquema = readFileSync(path.join(raiz, "supabase", "schema.sql"), "utf8");
  const politica = /create policy "cliente ve su cuenta"[\s\S]*?;/.exec(esquema);
  assert.ok(politica, "no encuentro la política cliente ve su cuenta");
  assert.match(politica[0], /m\.cuenta_id = cuentas_cliente\.id/, "la política perdió la calificación");
});

test("las tablas nuevas del portal también piden ser del equipo", () => {
  const esquema = readFileSync(path.join(raiz, "supabase", "schema.sql"), "utf8");
  for (const tabla of ["cuentas_cliente", "miembros_cuenta"]) {
    const politica = new RegExp(
      `create policy "equipo[^"]*" on public\\.${tabla}[\\s\\S]{0,200}?;`
    ).exec(esquema);
    assert.ok(politica, `no encuentro la política del equipo sobre ${tabla}`);
    assert.match(politica[0], /es_del_equipo\(\)/);
  }
});

test("la pertenencia exige cuenta ACTIVA: suspender cierra todo", () => {
  // mi_cliente_id() es la llave de todas las políticas del cliente. Si
  // deja de exigir estado = 'activa', suspender una cuenta no cierra nada.
  for (const archivo of [
    "supabase/schema.sql",
    "supabase/migrations/20260814090000_portal-cuentas.sql",
  ]) {
    const contenido = readFileSync(path.join(raiz, archivo), "utf8");
    const funcion = /function public\.mi_cliente_id\(\)[\s\S]*?\$\$;/.exec(contenido);
    assert.ok(funcion, `${archivo}: no encuentro mi_cliente_id()`);
    assert.match(funcion[0], /estado = 'activa'/, `${archivo}: mi_cliente_id ignora la suspensión`);
    assert.match(funcion[0], /security definer/, `${archivo}: mi_cliente_id necesita security definer`);
    assert.match(
      contenido,
      /revoke all on function public\.mi_cliente_id\(\) from public, anon/,
      `${archivo}: mi_cliente_id no puede quedar ejecutable para anon`
    );
  }
});

test("las acciones de cuentas exigen el permiso en el servidor", () => {
  // Esconder el botón no es seguridad: cada acción de gestión llama a
  // exigirPermiso("gestionar_cuentas") antes de tocar nada.
  const contenido = readFileSync(path.join(raiz, "src/lib/acciones-cuentas.ts"), "utf8");
  for (const accion of [
    "crearAccesoPortal",
    "reenviarActivacion",
    "suspenderCuenta",
    "reactivarCuenta",
  ]) {
    const cuerpo = new RegExp(
      `export async function ${accion}[\\s\\S]*?\\n\\}`
    ).exec(contenido);
    assert.ok(cuerpo, `no encuentro ${accion}`);
    assert.match(
      cuerpo[0],
      /exigirPermiso\(supabase, "gestionar_cuentas"\)/,
      `${accion} no exige el permiso gestionar_cuentas`
    );
  }
  // La única pública valida el token y su vigencia antes de crear nada.
  const activar = /export async function activarCuenta[\s\S]*?\n\}/.exec(contenido);
  assert.ok(activar, "no encuentro activarCuenta");
  assert.match(activar[0], /activacionVigente\(/, "activarCuenta no comprueba la vigencia");
  assert.match(activar[0], /token_activacion: null/, "activarCuenta no quema el token (un solo uso)");
});

test("los pagos exigen el permiso ver_pagos EN LA BASE", () => {
  // Si la política de pagos vuelve a ser solo es_mi_pedido, un colaborador
  // sin permiso vería el dinero hablando directo con la API — con la
  // sección escondida en pantalla y todo.
  const esquema = readFileSync(path.join(raiz, "supabase", "schema.sql"), "utf8");
  const politica = /create policy "cliente ve sus pagos"[^;]*;/.exec(esquema);
  assert.ok(politica, "no encuentro la política de pagos del cliente");
  assert.match(politica[0], /mi_permiso\('ver_pagos'\)/, "pagos no exige el permiso en la base");

  const migracion = readFileSync(
    path.join(raiz, "supabase/migrations/20260825090000_colaboradores-recuperacion.sql"),
    "utf8"
  );
  assert.match(migracion, /mi_permiso\('ver_pagos'\)/, "la migración no rehace la política de pagos");
});

test("las funciones nuevas del portal son security definer y no ejecutables por anon", () => {
  for (const archivo of [
    "supabase/schema.sql",
    "supabase/migrations/20260825090000_colaboradores-recuperacion.sql",
  ]) {
    const contenido = readFileSync(path.join(raiz, archivo), "utf8");
    for (const funcion of ["soy_propietario", "mi_permiso"]) {
      const cuerpo = new RegExp(`function public\\.${funcion}\\([^)]*\\)[\\s\\S]*?\\$\\$;`).exec(contenido);
      assert.ok(cuerpo, `${archivo}: no encuentro ${funcion}()`);
      assert.match(cuerpo[0], /security definer/, `${archivo}: ${funcion} sin security definer`);
      assert.match(cuerpo[0], /estado = 'activa'/, `${archivo}: ${funcion} ignora la suspensión`);
      assert.match(
        contenido,
        new RegExp(`revoke all on function public\\.${funcion}\\([^)]*\\) from public, anon`),
        `${archivo}: ${funcion} ejecutable por anon`
      );
    }
  }
});

test("las acciones del propietario validan al firmante en el servidor", () => {
  // Cada acción del portal pasa por propietarioFirmado(), que comprueba
  // sesión + rol propietario + cuenta activa ANTES de que el admin toque
  // nada. Y la pertenencia de lo que se toca se compara contra la cuenta
  // del firmante, no contra lo que mande el navegador.
  const contenido = readFileSync(path.join(raiz, "src/lib/acciones-portal.ts"), "utf8");
  for (const accion of ["invitarColaborador", "revocarInvitacionColaborador", "quitarColaborador"]) {
    const cuerpo = new RegExp(`export async function ${accion}[\\s\\S]*?\\n\\}`).exec(contenido);
    assert.ok(cuerpo, `no encuentro ${accion}`);
    assert.match(cuerpo[0], /propietarioFirmado\(\)/, `${accion} no valida al propietario`);
  }
  assert.match(
    contenido,
    /rol !== "propietario"/,
    "propietarioFirmado no exige el rol propietario"
  );
  // Al propietario no lo quita nadie desde el portal.
  const quitar = /export async function quitarColaborador[\s\S]*?\n\}/.exec(contenido)!;
  assert.match(quitar[0], /miembro\.rol !== "colaborador"/, "quitarColaborador podría quitar al propietario");
});

test("la recuperación quema el token ANTES de cambiar la contraseña", () => {
  // Un solo uso de verdad: si el orden se invierte, dos peticiones
  // simultáneas con el mismo enlace cambiarían la contraseña dos veces.
  const contenido = readFileSync(path.join(raiz, "src/lib/acciones-cuentas.ts"), "utf8");
  const cuerpo = /export async function recuperarPassword[\s\S]*?\n\}/.exec(contenido);
  assert.ok(cuerpo, "no encuentro recuperarPassword");
  assert.match(cuerpo[0], /recuperacionVigente\(/, "no comprueba la vigencia");
  const quema = cuerpo[0].indexOf('.is("usado_en", null)');
  const cambia = cuerpo[0].indexOf("updateUserById");
  assert.ok(quema > 0 && cambia > 0 && quema < cambia, "el token debe quemarse antes del cambio");
});

test("los permisos de un colaborador se cambian saneados y solo por el propietario", () => {
  const contenido = readFileSync(path.join(raiz, "src/lib/acciones-portal.ts"), "utf8");
  const cuerpo = /export async function actualizarPermisosColaborador[\s\S]*?\n\}/.exec(contenido);
  assert.ok(cuerpo, "no encuentro actualizarPermisosColaborador");
  assert.match(cuerpo[0], /propietarioFirmado\(\)/, "no exige al propietario");
  assert.match(cuerpo[0], /rol !== "colaborador"/, "podría tocar la fila del propietario");
  assert.match(cuerpo[0], /sanearPermisos\(/, "guarda permisos sin sanear");

  // Y en TODO camino que escribe permisos: invitar y activar también.
  const invitar = /export async function invitarColaborador[\s\S]*?\n\}/.exec(contenido)!;
  assert.match(invitar[0], /sanearPermisos\(/, "invitarColaborador guarda permisos sin sanear");
  assert.match(
    invitar[0],
    /invitacionVigente\(/,
    "el cupo y los duplicados deben contar solo invitaciones vigentes"
  );
  const cuentas = readFileSync(path.join(raiz, "src/lib/acciones-cuentas.ts"), "utf8");
  const activar = /export async function activarColaborador[\s\S]*?\n\}/.exec(cuentas)!;
  assert.match(activar[0], /sanearPermisos\(/, "activarColaborador copia permisos sin sanear");
});

test("la prueba de aislamiento existe y cubre lo que no perdona errores", () => {
  // El RLS multicuenta solo se prueba de verdad contra la base: este
  // script lo hace (dos cuentas de mentira, suplantación con claims,
  // limpieza total). Aquí se vigila que siga cubriendo los casos duros.
  const sql = readFileSync(path.join(raiz, "supabase/probar-aislamiento.sql"), "utf8");
  assert.match(sql, /set_config\('request\.jwt\.claims'/, "sin claims no hay suplantación real");
  assert.match(sql, /set role authenticated/, "debe probar como usuario firmado");
  assert.match(sql, /set role anon/, "debe probar como anónimo");
  assert.match(sql, /suspendida/, "debe probar que suspender cierra todo");
  assert.match(sql, /colaborador SIN permiso NO ve pagos/i, "debe probar el permiso de pagos en la base");
  assert.match(sql, /delete from public\.clientes where id in/, "debe borrar lo que creó");
  assert.match(sql, /delete from auth\.users where email like '%@aislamiento\.invifty\.test'/,
    "debe borrar los usuarios de mentira");
  assert.ok(
    sql.indexOf("delete from auth.users") < sql.indexOf("select orden, que, estado"),
    "la limpieza va ANTES del veredicto: el editor solo enseña la última consulta"
  );
});

test("la edición del cliente revalida permiso, pertenencia y candado en el servidor", () => {
  const contenido = readFileSync(path.join(raiz, "src/lib/acciones-portal.ts"), "utf8");
  const cuerpo = /export async function guardarContenidoInvitacion[\s\S]*?\n\}/.exec(contenido);
  assert.ok(cuerpo, "no encuentro guardarContenidoInvitacion");
  assert.match(cuerpo[0], /miembroFirmado\(\)/, "no valida la sesión del miembro");
  assert.match(
    cuerpo[0],
    /tienePermiso\(quien, "editar_invitacion"\)/,
    "no exige el permiso editar_invitacion"
  );
  assert.match(cuerpo[0], /puedeEditarContenido\(/, "no comprueba el candado");
  assert.match(cuerpo[0], /validarContenido\(/, "no valida contra la lista blanca");
  // La pertenencia se lee con la SESIÓN del cliente (RLS), no con admin.
  assert.match(cuerpo[0], /crearClienteServidor\(\)/, "la pertenencia debe leerse con la sesión");
  // El update re-exige el candado: sin carrera entre leer y escribir.
  assert.match(
    cuerpo[0],
    /\.is\("bloqueada_en", null\)/,
    "el update debe exigir el candado otra vez"
  );
});

test("el portal lee SOLO con la sesión del cliente, nunca con la llave administrativa", () => {
  // Si una página del portal importara el cliente admin, saltaría el RLS
  // y una consulta mal filtrada enseñaría datos de OTRO cliente sin que
  // nada falle a la vista. La activación (/activar) es la excepción a
  // propósito: ahí todavía no hay sesión y la credencial es el token.
  const dirPortal = path.join(raiz, "src/app/portal");
  const archivos: string[] = [];
  const recorrer = (dir: string) => {
    for (const entrada of readdirSync(dir, { withFileTypes: true })) {
      const ruta = path.join(dir, entrada.name);
      if (entrada.isDirectory()) recorrer(ruta);
      else if (/\.tsx?$/.test(entrada.name)) archivos.push(ruta);
    }
  };
  recorrer(dirPortal);
  assert.ok(archivos.length >= 4, "el portal perdió páginas: revisa esta prueba");

  for (const archivo of archivos) {
    assert.doesNotMatch(
      readFileSync(archivo, "utf8"),
      /supabase\/admin/,
      `${path.relative(raiz, archivo)} importa la llave administrativa: el portal lee con la sesión del cliente`
    );
  }
});

test("el portal se guarda en el servidor: proxy y layout", () => {
  const proxy = readFileSync(path.join(raiz, "src/proxy.ts"), "utf8");
  assert.match(proxy, /\/portal\/entrar/, "el proxy no conoce la puerta del portal");

  const layout = readFileSync(
    path.join(raiz, "src/app/portal/(privado)/layout.tsx"),
    "utf8"
  );
  assert.match(layout, /getUser\(\)/, "el layout del portal no comprueba la sesión");
  assert.match(layout, /miembros_cuenta/, "el layout del portal no comprueba la membresía");
  assert.match(layout, /suspendida/, "el layout del portal no distingue la suspensión");
});

/* =====================================================================
 * 1c. Borrar y corregir desde el panel
 * ===================================================================== */

test("borrar exige el permiso, la confirmación escrita y el rastro ANTES", () => {
  const contenido = readFileSync(path.join(raiz, "src/lib/acciones.ts"), "utf8");
  for (const accion of ["eliminarPedido", "eliminarCliente"]) {
    const cuerpo = new RegExp(`export async function ${accion}[\\s\\S]*?\\n\\}`).exec(contenido);
    assert.ok(cuerpo, `no encuentro ${accion}`);
    assert.match(cuerpo[0], /exigirPermiso\(supabase, "eliminar_datos"\)/, `${accion} sin permiso`);
    assert.match(cuerpo[0], /confirmacionCorrecta\(/, `${accion} sin confirmación escrita`);
    // La auditoría se escribe ANTES del delete: su fila no tiene FK y
    // sobrevive contando qué había.
    const auditoria = cuerpo[0].indexOf("registrarAccion");
    const borrado = cuerpo[0].indexOf(".delete()");
    assert.ok(auditoria > 0 && borrado > 0 && auditoria < borrado, `${accion}: el rastro va antes del borrado`);
  }
  // Un cliente con pedidos no se borra: primero se mira lo que se lleva.
  const cliente = /export async function eliminarCliente[\s\S]*?\n\}/.exec(contenido)!;
  assert.match(cliente[0], /count/, "eliminarCliente debe contar los pedidos antes");
});

test("cambiar el plan de un pedido vuelve a congelar el contrato y lo firma", () => {
  const contenido = readFileSync(path.join(raiz, "src/lib/acciones.ts"), "utf8");
  const cuerpo = /export async function actualizarPedido[\s\S]*?\n\}/.exec(contenido);
  assert.ok(cuerpo, "no encuentro actualizarPedido");
  assert.match(cuerpo[0], /exigirPermiso\(supabase, "editar_fichas"\)/, "sin permiso editar_fichas");
  assert.match(cuerpo[0], /cambioDePlan.*snapshotDeContrato|snapshotDeContrato[\s\S]*?cambioDePlan/, "no re-congela la foto al cambiar plan");
  assert.match(cuerpo[0], /plan_anterior/, "el cambio de plan debe firmar el plan anterior");
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
    "src/app/api/galeria/[slug]/fotos/route.ts",
    "src/app/api/cobro/[token]/reportar/route.ts",
    "src/app/api/regalos/[slug]/aportar/route.ts",
  ];
  for (const ruta of compartido) {
    const contenido = readFileSync(path.join(raiz, ruta), "utf8");
    assert.match(contenido, /limitarCompartido\(/, `${ruta} no usa el freno compartido`);
  }
});

test("la subida de fotos frena ANTES de leer el archivo", () => {
  // Si el freno fuera después de req.formData(), ya nos habríamos tragado
  // los MB y el freno no ahorraría lo que más cuesta.
  for (const ruta of [
    "src/app/api/formulario/[token]/fotos/route.ts",
    "src/app/api/galeria/[slug]/fotos/route.ts",
  ]) {
    const contenido = readFileSync(path.join(raiz, ruta), "utf8");
    assert.ok(
      contenido.indexOf("limitar") < contenido.indexOf("req.formData()"),
      `${ruta}: el freno tiene que ir antes de leer el cuerpo de la petición`
    );
  }
});

test("un reporte de pago NO es un pago: solo confirmar mueve el balance", () => {
  const contenido = readFileSync(path.join(raiz, "src/lib/acciones.ts"), "utf8");
  const cuerpo = /export async function confirmarPagoReportado[\s\S]*?\n\}/.exec(contenido);
  assert.ok(cuerpo, "no encuentro confirmarPagoReportado");
  assert.match(cuerpo[0], /exigirPermiso\(supabase, "registrar_pagos"\)/, "confirmar sin permiso");
  assert.match(
    cuerpo[0],
    /clave_idempotencia: `reporte:\$\{reporte\.id\}`/,
    "sin idempotencia, confirmar dos veces duplica el dinero"
  );
  assert.match(cuerpo[0], /estado !== "pendiente"/, "un reporte ya revisado no se reconfirma");

  // Y la API pública jamás toca la tabla `pagos`: solo reporta.
  const api = readFileSync(
    path.join(raiz, "src/app/api/cobro/[token]/reportar/route.ts"),
    "utf8"
  );
  assert.ok(!api.includes('from("pagos")'), "la API pública no puede escribir pagos reales");
  assert.match(api, /pagos_reportados/, "la API debe escribir en pagos_reportados");
});

test("la moderación de la galería exige la pertenencia en cada escritura", () => {
  // Ocultar o borrar una foto de OTRA invitación no puede pasar ni
  // sabiendo su id: el update y el select llevan el invitacion_id del
  // token que firma, no el que diga el navegador.
  const contenido = readFileSync(
    path.join(raiz, "src/app/api/lista/[token]/galeria/route.ts"),
    "utf8"
  );
  const escrituras = contenido.match(/\.eq\("id", fotoId\)/g) ?? [];
  const pertenencias = contenido.match(/\.eq\("invitacion_id", invitacion\.id\)/g) ?? [];
  assert.ok(escrituras.length >= 2, "el escaneo dejó de encontrar las escrituras");
  assert.ok(
    pertenencias.length >= escrituras.length,
    "hay una escritura sobre fotos sin exigir la invitación del token"
  );
});

test("los montos de los regalos son privados del anfitrión", () => {
  // La página pública de la mesa jamás consulta los aportes: quién dio
  // qué solo lo ve el anfitrión (por su token) y el cliente del portal.
  const publica = readFileSync(path.join(raiz, "src/app/regalos/[slug]/page.tsx"), "utf8");
  assert.ok(
    !publica.includes('from("aportes")'),
    "la página pública no puede listar aportes ajenos"
  );
  // Y el anfitrión guarda sus cuentas SIEMPRE saneadas.
  const anfitrion = readFileSync(
    path.join(raiz, "src/app/api/lista/[token]/regalos/route.ts"),
    "utf8"
  );
  assert.match(anfitrion, /sanearCuentasRegalo\(body\.cuentas\)/, "las cuentas entran sin sanear");
  const pertenencias = anfitrion.match(/\.eq\("invitacion_id", invitacion\.id\)/g) ?? [];
  assert.ok(pertenencias.length >= 3, "cada consulta de aportes debe llevar la invitación del token");
});

test("las mesas exigen la pertenencia en cada escritura", () => {
  // Igual que la galería: una mesa o un hogar de OTRA invitación no se
  // toca ni sabiendo su id, y asignar valida que la mesa sea de la
  // invitación del token.
  const contenido = readFileSync(
    path.join(raiz, "src/app/api/lista/[token]/mesas/route.ts"),
    "utf8"
  );
  const pertenencias = contenido.match(/\.eq\("invitacion_id", invitacion\.id\)/g) ?? [];
  assert.ok(
    pertenencias.length >= 5,
    "cada lectura y escritura de mesas/hogares debe llevar la invitación del token"
  );
  assert.match(
    contenido,
    /Esa mesa no existe/,
    "asignar un hogar a una mesa ajena debe fallar como inexistente"
  );
});

test("las rutas de mantenimiento siguen pidiendo sesión", () => {
  // Una de ellas reescribe fechas de vencimiento de todos los pedidos.
  for (const ruta of [
    "src/app/api/panel/mantenimiento/vencimientos/route.ts",
    "src/app/api/panel/mantenimiento/fotos/route.ts",
    // La exportación entrega la cartera de clientes entera: sin sesión, no.
    "src/app/api/panel/exportar/route.ts",
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
