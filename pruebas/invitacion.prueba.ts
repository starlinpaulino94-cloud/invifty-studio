import test from "node:test";
import assert from "node:assert/strict";

import { derivarDatosInvitacion, slugificar } from "@/lib/invitacion";
import { fechaLarga, fechaSinDiaSemana, fechaCorta, hora12 } from "@/lib/fechas";

/**
 * GENERACIÓN DE LA INVITACIÓN
 * ============================
 * Lo que convierte las respuestas del cliente en su invitación. Si esto se
 * rompe, el fallo no se ve hasta que alguien abre el editor y nota que
 * falta algo — justo el tipo de regresión silenciosa que conviene cazar.
 */

test("slugificar produce direcciones limpias", () => {
  assert.equal(slugificar("Camila & Lucas"), "camila-y-lucas");
  assert.equal(slugificar("María José Peña"), "maria-jose-pena");
  assert.equal(slugificar("  ¡Los 15 de Valeria!  "), "los-15-de-valeria");
  assert.equal(slugificar("Boda   con    espacios"), "boda-con-espacios");
  // Nunca puede quedar vacío: sería una URL rota.
  assert.equal(slugificar(""), "invitacion");
  assert.equal(slugificar("¿¡!?"), "invitacion");
  assert.ok(slugificar("a".repeat(200)).length <= 60);
});

test("las fechas se escriben en español sin depender del servidor", () => {
  assert.equal(fechaLarga("2026-02-14"), "sábado, 14 de febrero de 2026");
  assert.equal(fechaSinDiaSemana("2026-02-14"), "14 de febrero de 2026");
  assert.equal(fechaLarga(""), "");
  assert.equal(fechaLarga("no es una fecha"), "");

  const corta = fechaCorta("2026-11-28");
  assert.deepEqual(corta, { dia: "28", mes: "noviembre", anio: "2026", diaSemana: "sábado" });
});

test("la hora se muestra en formato de 12 horas", () => {
  assert.equal(hora12("17:30"), "5:30 p. m.");
  assert.equal(hora12("00:15"), "12:15 a. m.");
  assert.equal(hora12("12:00"), "12:00 p. m.");
  assert.equal(hora12("09:05"), "9:05 a. m.");
  assert.equal(hora12(""), "");
});

test("una boda completa llega entera a la invitación", () => {
  const { datos, plantilla } = derivarDatosInvitacion(
    "boda",
    {
      nombres_novios: "Camila & Lucas",
      fecha_boda: "2026-02-14",
      hora_ceremonia: "17:30",
      lugar_ceremonia: "Iglesia Santa Ana, Santo Domingo",
      lugar_recepcion: "Salón Jardín, Piantini",
      estilo_diseno: "clasico_elegante",
      paleta_colores: "vino_nude",
      historia_pareja: "Nos conocimos en la universidad.",
      hashtag: "#CamilaYLucas2026",
      personas_especiales: [
        { rol: "Padrino", nombre: "Luis Herrera" },
        { rol: "", nombre: "" },
      ],
      hitos_dia: [{ hora: "17:30", actividad: "Ceremonia" }],
      mesa_regalos: [{ titulo: "Banreservas", detalle: "9600000000" }],
    },
    "18095550101",
    null
  );

  assert.equal(plantilla, "editorial");
  assert.equal(datos.titulo, "Camila & Lucas");
  assert.equal(datos.paleta, "vino_nude", "la paleta que eligió el cliente debe aplicarse");
  assert.equal(datos.hashtag, "#CamilaYLucas2026");
  assert.equal(datos.fechaEvento, "2026-02-14");
  assert.equal(datos.rsvp.whatsapp, "18095550101");

  // Los dos lugares distintos se listan por separado
  assert.equal(datos.lugares.length, 2);

  // Las filas vacías de una lista no llegan a la invitación
  assert.deepEqual(datos.padrinos, [{ rol: "Padrino", nombre: "Luis Herrera" }]);

  // Las secciones se encienden solas según lo que el cliente completó
  assert.equal(datos.secciones.historia, true);
  assert.equal(datos.secciones.padrinos, true);
  assert.equal(datos.secciones.cronograma, true);
  assert.equal(datos.secciones.regalos, true);
});

test("un formulario casi vacío produce una invitación válida", () => {
  const { datos, plantilla } = derivarDatosInvitacion("boda", {}, "18090000000", null);

  assert.ok(plantilla, "siempre tiene que haber plantilla");
  assert.ok(datos.titulo, "el título nunca puede quedar vacío");
  assert.ok(datos.paleta, "la paleta nunca puede quedar vacía");
  assert.deepEqual(datos.lugares, []);
  assert.equal(datos.secciones.historia, false);
  assert.equal(datos.secciones.padrinos, false);
});

test("la recepción en el mismo sitio no se repite como segundo lugar", () => {
  const { datos } = derivarDatosInvitacion(
    "boda",
    { lugar_ceremonia: "Iglesia Santa Ana", lugar_recepcion: "En el mismo lugar" },
    "18090000000",
    null
  );
  assert.equal(datos.lugares.length, 1);
});

test("una paleta que el sistema no sabe aplicar deja aviso y no se pierde", () => {
  const { datos } = derivarDatosInvitacion(
    "empresarial",
    { nombre_evento: "Gala Anual", tipo_evento_corp: "gala", paleta_colores: "colores_marca" },
    "18090000000",
    "2026-09-03"
  );

  // Se usa la paleta de la plantilla como base…
  assert.notEqual(datos.paleta, "colores_marca");
  // …pero queda constancia para el equipo, y NO en las notas públicas.
  const aviso = datos.notasEquipo?.find((n) => n.titulo.includes("Paleta"));
  assert.ok(aviso, "tiene que quedar una nota interna sobre la paleta pedida");
  assert.equal(
    datos.notas?.some((n) => n.titulo.includes("Paleta")),
    false,
    "las notas internas no pueden acabar entre los avisos a los invitados"
  );
});

test("el tipo de evento corporativo elige la plantilla", () => {
  const casos: [string, string][] = [
    ["conferencia", "moderna"],
    ["gala", "editorial"],
    ["aniversario", "deco"],
    ["lanzamiento", "cinema"],
  ];

  for (const [tipo, esperada] of casos) {
    const { plantilla } = derivarDatosInvitacion(
      "empresarial",
      { tipo_evento_corp: tipo },
      "18090000000",
      null
    );
    assert.equal(plantilla, esperada, `un evento de tipo "${tipo}" debería usar "${esperada}"`);
  }
});

test("la música pedida activa el efecto y queda anotada para el equipo", () => {
  const { datos } = derivarDatosInvitacion(
    "boda",
    { ambiente_musical: "instrumental_romantico", cancion_propia: "Perfect — Ed Sheeran" },
    "18090000000",
    null
  );

  assert.equal(datos.efectos?.musica, true);
  const nota = datos.notasEquipo?.find((n) => n.titulo.includes("Música"));
  assert.ok(nota, "el equipo tiene que ver qué música pidió el cliente");
  assert.match(nota!.texto, /Perfect/);
  assert.match(nota!.texto, /Instrumental romántico/);
});

test("sin respuestas de música, el efecto se queda apagado", () => {
  const { datos } = derivarDatosInvitacion("boda", {}, "18090000000", null);
  assert.equal(datos.efectos?.musica, false);
  assert.deepEqual(datos.notasEquipo, []);
});

test("el aviso del QR sí va dirigido a los invitados", () => {
  const { datos } = derivarDatosInvitacion(
    "empresarial",
    { nombre_evento: "Congreso", usa_qr: "si" },
    "18090000000",
    null
  );
  assert.ok(
    datos.notas?.some((n) => n.titulo.includes("QR")),
    "el aviso del QR es para los invitados, no una instrucción interna"
  );
});
