import test from "node:test";
import assert from "node:assert/strict";

import { catalogoPublico } from "@/lib/catalogo-publico";
import { CATALOGO, PLANES, VIGENCIA_MESES, LIMITE_FOTOS } from "@/lib/planes";
import { validarLead } from "@/lib/leads";
import { demosPublicas, type DemoConInvitacion } from "@/lib/demos";
import { cabecerasCors } from "@/lib/cors-publico";
import { normalizarTelefono, telefonoValido } from "@/lib/telefono";
import type { Plan } from "@/lib/tipos";

/**
 * LA API PÚBLICA — pruebas de contrato
 * =====================================
 * /api/public/* es lo único del sistema que consume otra aplicación (la
 * web). Su contrato tiene dos promesas: lo que sale ES VERDAD (nada
 * vendido-sin-implementar) y NADA INTERNO SALE (ni estados, ni ids de
 * pedidos, ni tokens). Romper cualquiera de las dos no da error en ningún
 * sitio — solo miente en la web o filtra datos — así que se vigilan aquí.
 */

/* ---------- Catálogo ---------- */

test("los derivados legados salen del catálogo: una sola fuente de verdad", () => {
  for (const plan of Object.keys(CATALOGO) as Plan[]) {
    assert.equal(PLANES[plan].precioDOP, CATALOGO[plan].precioDOP);
    assert.equal(VIGENCIA_MESES[plan], CATALOGO[plan].vigenciaMeses);
    assert.equal(LIMITE_FOTOS[plan], CATALOGO[plan].limiteFotos);
  }
});

test("lo vendido-sin-implementar NO sale por la API pública", () => {
  // El QR individual se anuncia en la web pero el sistema no lo tiene.
  // Hasta que exista, la API no puede prometerlo.
  const publico = catalogoPublico();
  const ids = publico.planes.flatMap((p) => p.capacidades.map((c) => c.id));
  assert.ok(!ids.includes("qr_individual"), "salió el QR sin existir");
  // Y lo real sí sale — incluidas las dos promesas que YA se cumplieron
  // (2026-08-26): recordatorios y galería colaborativa.
  assert.ok(ids.includes("recordatorios"), "los recordatorios ya existen y deben anunciarse");
  assert.ok(ids.includes("galeria_post_evento"), "la galería ya existe y debe anunciarse");
  assert.ok(ids.includes("rsvp"));
  assert.ok(ids.includes("panel_confirmaciones"));
});

test("las capacidades manuales sí salen: son reales aunque las cumpla el equipo", () => {
  const luxury = catalogoPublico().planes.find((p) => p.id === "luxury")!;
  assert.ok(luxury.capacidades.some((c) => c.id === "diseno_personalizado"));
});

test("nada interno viaja en el catálogo público", () => {
  const json = JSON.stringify(catalogoPublico());
  for (const prohibido of ["estado", "vendida_sin_implementar", "notasEquipo", "token"]) {
    assert.ok(!json.includes(prohibido), `se filtró "${prohibido}"`);
  }
});

test("Infinity no viaja en JSON: el sin-límite sale como null", () => {
  const premium = catalogoPublico().planes.find((p) => p.id === "premium")!;
  assert.equal(premium.limiteFotos, null);
  const esencial = catalogoPublico().planes.find((p) => p.id === "esencial")!;
  assert.equal(esencial.limiteFotos, 0);
});

test("revisiones sin decidir no se anuncian", () => {
  // En el catálogo son null (decisión comercial pendiente): no deben salir
  // como 0 ni como undefined-serializado, simplemente no estar.
  for (const plan of catalogoPublico().planes) {
    assert.ok(!("revisiones" in plan), `el plan ${plan.id} anuncia revisiones sin decidirlas`);
  }
});

/* ---------- Teléfono ---------- */

test("el teléfono se normaliza igual que en el alta de pedidos", () => {
  assert.equal(normalizarTelefono("(809) 269-3214"), "18092693214");
  assert.equal(normalizarTelefono("18092693214"), "18092693214");
  assert.ok(telefonoValido("18092693214"));
  assert.ok(!telefonoValido("12345"));
});

/* ---------- Leads ---------- */

const leadValido = {
  nombre: "María Pérez",
  telefono: "809-269-3214",
  tipo_evento: "boda",
  consentimiento: true,
  clave_idempotencia: "a".repeat(32),
};

test("un lead válido pasa, con el teléfono ya normalizado", () => {
  const r = validarLead(leadValido);
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.lead.telefono, "18092693214");
    assert.equal(r.lead.fuente, "web");
    assert.equal(r.lead.idioma, "es");
  }
});

test("sin consentimiento no hay lead", () => {
  const r = validarLead({ ...leadValido, consentimiento: false });
  assert.ok(!r.ok);
});

test("un teléfono inservible se rechaza: no se le puede escribir", () => {
  assert.ok(!validarLead({ ...leadValido, telefono: "12345" }).ok);
  assert.ok(!validarLead({ ...leadValido, telefono: "no tengo" }).ok);
});

test("un plan inventado se rechaza: es un bot o una web desactualizada", () => {
  assert.ok(!validarLead({ ...leadValido, plan_id: "diamante" }).ok);
  const r = validarLead({ ...leadValido, plan_id: "popular" });
  assert.ok(r.ok && r.lead.plan_id === "popular");
});

test("una fecha rota se rechaza; sin fecha, pasa", () => {
  assert.ok(!validarLead({ ...leadValido, fecha_evento: "mañana" }).ok);
  assert.ok(!validarLead({ ...leadValido, fecha_evento: "2026-13-45" }).ok);
  const r = validarLead({ ...leadValido, fecha_evento: "" });
  assert.ok(r.ok && r.lead.fecha_evento === null);
});

test("sin clave de idempotencia no hay lead: el doble clic la necesita", () => {
  assert.ok(!validarLead({ ...leadValido, clave_idempotencia: "" }).ok);
  assert.ok(!validarLead({ ...leadValido, clave_idempotencia: "corta" }).ok);
});

test("las UTM se quedan con las cinco llaves conocidas y nada más", () => {
  const r = validarLead({
    ...leadValido,
    utm: { source: "instagram", campaign: "bodas26", inventada: "x", script: "<script>" },
  });
  assert.ok(r.ok);
  if (r.ok) {
    assert.deepEqual(Object.keys(r.lead.utm).sort(), ["campaign", "source"]);
  }
});

test("los textos largos se recortan, no revientan", () => {
  const r = validarLead({ ...leadValido, mensaje: "x".repeat(5000) });
  assert.ok(r.ok);
  if (r.ok) assert.ok(r.lead.mensaje!.length <= 1000);
});

/* ---------- Demos ---------- */

const filaDemo = (extra: Partial<DemoConInvitacion> = {}): DemoConInvitacion => ({
  id: "d1",
  invitacion_id: "i1",
  tipo_evento: "boda",
  plan_minimo: "popular",
  orden: 1,
  destacada: true,
  activa: true,
  idioma: "es",
  creado_en: "2026-08-01T00:00:00Z",
  invitaciones: {
    slug: "camila-lucas-x7",
    plantilla: "editorial",
    estado: "publicada",
    datos: { titulo: "Camila & Lucas" },
  },
  ...extra,
});

test("una demo publicada sale con su enlace y su estilo", () => {
  const [demo] = demosPublicas([filaDemo()], "https://studio.invifty.com");
  assert.equal(demo.titulo, "Camila & Lucas");
  assert.equal(demo.url, "https://studio.invifty.com/i/camila-lucas-x7");
  assert.equal(demo.estilo, "Editorial Luxe");
});

test("una demo que apunta a un borrador NO sale, aunque esté activa", () => {
  const fila = filaDemo();
  fila.invitaciones!.estado = "borrador";
  assert.equal(demosPublicas([fila], "x").length, 0);
});

test("una demo apagada no sale", () => {
  assert.equal(demosPublicas([filaDemo({ activa: false })], "x").length, 0);
});

test("nada interno viaja en las demos: ni ids, ni pedido, ni tokens", () => {
  const json = JSON.stringify(demosPublicas([filaDemo()], "https://x.com"));
  for (const prohibido of ["invitacion_id", "pedido", "token", '"id"']) {
    assert.ok(!json.includes(prohibido), `se filtró ${prohibido}`);
  }
});

/* ---------- CORS ---------- */

test("la marca puede llamar; el resto del internet, no", () => {
  assert.ok(cabecerasCors("https://invifty.com")["Access-Control-Allow-Origin"]);
  assert.ok(cabecerasCors("https://www.invifty.com")["Access-Control-Allow-Origin"]);
  assert.ok(cabecerasCors("http://localhost:3000")["Access-Control-Allow-Origin"]);
  assert.deepEqual(cabecerasCors("https://malvado.com"), {});
  assert.deepEqual(cabecerasCors("https://invifty.com.malvado.com"), {});
});

test("sin cabecera Origin (curl, servidor a servidor) no hace falta CORS", () => {
  assert.deepEqual(cabecerasCors(null), {});
});
