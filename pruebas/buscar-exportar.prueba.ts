import test from "node:test";
import assert from "node:assert/strict";

import {
  consultaValida,
  digitosDeTelefono,
  patronBusqueda,
  tipoDeConsulta,
} from "@/lib/buscar";
import { aCsv, campoCsv, nombreArchivo } from "@/lib/exportar";

/**
 * EL BUSCADOR Y LA EXPORTACIÓN
 * =============================
 * El buscador tiene que adivinar bien QUÉ le pegaron (un token confundido
 * con un nombre no encuentra nada), y el CSV tiene que abrir en Excel con
 * las columnas en su sitio — un CSV corrido en dinero es un error de
 * contabilidad esperando turno.
 */

test("el buscador reconoce qué le pegaron", () => {
  assert.equal(tipoDeConsulta("a1b2c3d4e5f60718293a4b5c6d7e8f90"), "token", "32 hex es un token");
  assert.equal(tipoDeConsulta("8091234567"), "telefono");
  assert.equal(tipoDeConsulta("(809) 123-4567"), "telefono", "el formato no lo despista");
  assert.equal(tipoDeConsulta("+1 809 123 4567"), "telefono");
  assert.equal(tipoDeConsulta("Camila Pérez"), "texto");
  assert.equal(tipoDeConsulta("camila-y-lucas"), "texto", "un slug es texto");
  assert.equal(tipoDeConsulta("casa 123"), "texto", "pocos dígitos entre letras no es teléfono");
});

test("el teléfono se busca por dígitos, venga como venga", () => {
  assert.equal(digitosDeTelefono("(809) 123-4567"), "8091234567");
});

test("los comodines del usuario no se vuelven un tráeme-todo", () => {
  assert.equal(patronBusqueda("ana"), "%ana%");
  assert.ok(patronBusqueda("100%").includes("\\%"), "el % del usuario va escapado");
  assert.ok(patronBusqueda("a_b").includes("\\_"), "el _ del usuario va escapado");
});

test("la consulta corta no dispara búsquedas", () => {
  assert.equal(consultaValida("a"), false);
  assert.equal(consultaValida("  a  "), false);
  assert.equal(consultaValida("an"), true);
});

/* ---------- CSV ---------- */

test("una coma, una comilla o un salto de línea no corren las columnas", () => {
  assert.equal(campoCsv("sin nada raro"), "sin nada raro");
  assert.equal(campoCsv("Pérez, Ana"), '"Pérez, Ana"');
  assert.equal(campoCsv('dijo "hola"'), '"dijo ""hola"""');
  assert.equal(campoCsv("línea\nrota"), '"línea\nrota"');
  assert.equal(campoCsv(null), "");
  assert.equal(campoCsv(2500), "2500");
});

test("el archivo abre en Excel: BOM al frente y CRLF entre filas", () => {
  const csv = aCsv(
    [{ nombre: "Pérez, Ana", monto: 2500 }],
    [
      { titulo: "Cliente", valor: (f) => f.nombre },
      { titulo: "Monto (DOP)", valor: (f) => f.monto },
    ]
  );
  assert.equal(csv.charCodeAt(0), 0xfeff, "sin BOM, Excel lee PÃ©rez");
  assert.ok(csv.includes("\r\n"), "las filas van con CRLF");
  assert.ok(csv.includes('"Pérez, Ana",2500'));
  assert.ok(csv.includes("Cliente,Monto (DOP)"));
});

test("el nombre del archivo lleva la fecha para no pisarse", () => {
  assert.equal(nombreArchivo("pagos", new Date("2026-08-28T15:00:00Z")), "invifty-pagos-2026-08-28.csv");
});
