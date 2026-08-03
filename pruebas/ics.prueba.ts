import test from "node:test";
import assert from "node:assert/strict";

import { icsDeInvitacion, sumarHoras, fechaCompacta } from "@/lib/ics";

/**
 * EL ARCHIVO DE CALENDARIO
 * =========================
 * Un .ics mal formado no da error a medias: el calendario del invitado lo
 * rechaza ENTERO y el botón parece roto. Las reglas quisquillosas del
 * estándar (bytes por línea, escapes, CRLF) se prueban aquí porque son
 * invisibles a simple vista.
 */

const base = {
  slug: "camila-lucas-x7k2",
  titulo: "Camila & Lucas",
  fecha: "2026-12-12",
  hora: "17:30",
  lugar: "Jardín Botánico, Av. República de Colombia, Santo Domingo",
  descripcion: "¡Nos casamos!",
  url: "https://invifty.com/i/camila-lucas-x7k2",
  actualizadoEn: "2026-08-01T14:30:00.000Z",
};

test("el archivo trae lo que un calendario necesita", () => {
  const ics = icsDeInvitacion(base);

  for (const linea of [
    "BEGIN:VCALENDAR",
    "BEGIN:VEVENT",
    "UID:camila-lucas-x7k2@invifty",
    "DTSTAMP:20260801T143000Z",
    "DTSTART;TZID=America/Santo_Domingo:20261212T173000",
    "DTEND;TZID=America/Santo_Domingo:20261212T223000",
    "SUMMARY:Camila & Lucas",
    "END:VEVENT",
    "END:VCALENDAR",
  ]) {
    assert.ok(ics.includes(linea), `falta: ${linea}`);
  }
});

test("los retornos son CRLF, que es lo que pide el estándar", () => {
  const ics = icsDeInvitacion(base);
  assert.ok(ics.includes("\r\n"));
  assert.equal(ics.replace(/\r\n/g, "").includes("\n"), false, "hay saltos sueltos sin \\r");
});

test("las comas de la dirección van escapadas", () => {
  // "Av. República de Colombia, Santo Domingo": sin escapar, la coma corta
  // el campo y el calendario enseña media dirección o rechaza el archivo.
  const ics = icsDeInvitacion(base);
  assert.ok(ics.includes("Av. República de Colombia\\,"), "coma sin escapar en LOCATION");
});

test("un evento de noche no termina a las 25:00", () => {
  // El bug del botón viejo: 20:00 + 5 horas era "25:00", hora que no
  // existe. Tiene que pasar a la 01:00 del día siguiente.
  const fin = sumarHoras("2026-12-12", "20:00", 5);
  assert.equal(fin.fecha, "2026-12-13");
  assert.equal(fin.hora, "01:00");

  const ics = icsDeInvitacion({ ...base, hora: "20:00" });
  assert.ok(ics.includes("DTEND;TZID=America/Santo_Domingo:20261213T010000"));
});

test("fin de año también rueda bien", () => {
  const fin = sumarHoras("2026-12-31", "22:00", 5);
  assert.equal(fin.fecha, "2027-01-01");
  assert.equal(fin.hora, "03:00");
});

test("sin hora, se asume la tarde y no revienta", () => {
  const ics = icsDeInvitacion({ ...base, hora: undefined });
  assert.ok(ics.includes(":20261212T180000"));
});

test("ninguna línea pasa de 75 bytes", () => {
  // Los acentos ocupan dos bytes: una dirección larga y acentuada es el
  // caso que rompe si se cuenta en letras.
  const ics = icsDeInvitacion({
    ...base,
    lugar:
      "Salón de recepciones Jardín de las Ilusiones, Avenida los Próceres número 123, " +
      "Urbanización Renacimiento, Santiago de los Caballeros, República Dominicana",
  });

  for (const linea of ics.split("\r\n")) {
    const bytes = new TextEncoder().encode(linea).length;
    assert.ok(bytes <= 75, `línea de ${bytes} bytes: ${linea.slice(0, 40)}…`);
  }
});

test("una línea plegada se puede desplegar sin perder letras", () => {
  const lugarLargo = "Círculo Ñandú, José Pérez y María Muñoz — celebración número 1234567890, Santo Domingo Este";
  const ics = icsDeInvitacion({ ...base, lugar: lugarLargo });

  // Desplegar: quitar CRLF+espacio, como hace cualquier calendario.
  const desplegado = ics.replace(/\r\n /g, "");
  assert.ok(desplegado.includes("Círculo Ñandú"), "se partió una letra acentuada");
  assert.ok(desplegado.includes("María Muñoz"), "se perdieron letras al plegar");
});

test("la zona horaria dominicana va declarada en el archivo", () => {
  const ics = icsDeInvitacion(base);
  assert.ok(ics.includes("TZID:America/Santo_Domingo"));
  assert.ok(ics.includes("TZOFFSETTO:-0400"));
});

test("fechaCompacta produce el formato del estándar", () => {
  assert.equal(fechaCompacta("2026-12-12", "17:30"), "20261212T173000");
});

test("sin lugar ni descripción no quedan campos vacíos colgando", () => {
  const ics = icsDeInvitacion({ ...base, lugar: "", descripcion: "" });
  assert.equal(ics.includes("LOCATION"), false);
  assert.equal(ics.includes("DESCRIPTION"), false);
});
