# Privacidad y retención de datos

Invifty Studio guarda datos de tres personas distintas: el **cliente**
(quien paga), sus **invitados** (quienes confirman) y los **interesados**
(quienes llegan de la web). Esta es la política técnica de cuánto tiempo
vive cada dato y por qué.

**Estado: PROPUESTA.** Nada se borra automáticamente todavía — el sistema
no ejecuta ninguna de estas limpiezas hasta que el propietario apruebe la
política. Lo que sí está ya en producción: minimización (no se recogen
datos que no hagan falta), tokens opacos sin datos personales, `noindex`
en todo lo personal, y errores sin PII (`lib/registro.ts` redacta tokens
y claves antes de escribir un log).

## Tabla de retención propuesta

| Dato | Dónde | Retención propuesta | Motivo |
|---|---|---|---|
| Leads no convertidos | `leads` | 12 meses desde el último contacto | Ciclo de compra de un evento; después ya no hay interés legítimo |
| Leads convertidos | `leads` | Mientras exista el cliente | Es el origen de la relación comercial |
| Clientes y pedidos | `clientes`, `pedidos` | Mientras dure la relación + 10 años los datos fiscales | Obligaciones fiscales (RD): facturación y comprobantes |
| Pagos | `pagos` | 10 años, nunca menos | Registro financiero; jamás se borra, se anula |
| Formularios | `formularios` | Hasta 12 meses después del evento | Material de producción; después solo estorba |
| Fotografías y vídeos | Storage `fotos-pedidos` | Hasta el vencimiento del plan + 3 meses de gracia | Es el archivo del cliente; la gracia cubre renovaciones tardías |
| Invitaciones | `invitaciones` | Vigencia del plan + 3 meses | Igual que las fotos; la demo pública se despublica al vencer |
| RSVP / confirmaciones | `confirmaciones` | 6 meses después del evento | El anfitrión ya usó su lista; son nombres de terceros |
| Lista de invitados y hogares | `invitados`, `hogares` | 6 meses después del evento | Ídem — datos de terceros que no son clientes |
| Entradas (recepción) | `entradas` | 6 meses después del evento | Historial operativo del día del evento |
| Visitas | `visitas` | 12 meses | Ya son anónimas (hash irreversible por invitación, sin IP) |
| Versiones y revisiones | `versiones`, `revisiones`, `comentarios` | Mientras exista la invitación | Evidencia de qué se aprobó; se va con la invitación (cascade) |
| Auditoría e historial | `auditoria`, `historial_estados` | 5 años | Trazabilidad de acciones sensibles; inmutables por diseño |
| Generaciones de IA | `generaciones` | 24 meses | Costos y calidad del proveedor; sin datos de contacto dentro |
| Avisos (outbox) | `avisos` | 6 meses | Diagnóstico de entregas; el contenido es interno |
| Frenos | `frenos` | Horas (los barre el cron) | Contadores efímeros con IP: lo más corto posible |

## Derechos del cliente (cómo se atienden hoy)

- **Acceso / exportación**: la ficha del pedido tiene "Exportar"
  (`/panel/pedidos/<id>/exportar`) con todo lo del cliente en una página
  imprimible. Para sus invitados, el panel del anfitrión ya es suyo.
- **Corrección**: cualquier dato se corrige desde el panel; los cambios
  sensibles quedan en auditoría.
- **Eliminación**: a petición del cliente, borrar el pedido elimina en
  cascada formularios, invitación, confirmaciones, hogares y entradas
  (así están las FK). Las EXCEPCIONES que se conservan: pagos (registro
  financiero, se conservan anulados/anonimizados) y auditoría (inmutable,
  sin contenido personal). Las fotos del Storage hay que borrarlas
  aparte: `/panel/mantenimiento` tiene la herramienta.
- **Los invitados no son clientes**: sus datos (nombre, asistencia, nota)
  los carga el anfitrión o ellos mismos, viven bajo la invitación del
  anfitrión y se van con ella.

## Reglas que ya se cumplen (y las pruebas las sostienen)

- El QR y los enlaces personales llevan **solo tokens opacos** — nunca
  nombre, teléfono, correo ni dirección.
- Los briefs de IA **no llevan** teléfono, fecha, lugares ni la historia
  literal del cliente (`pruebas/ia.prueba.ts`).
- Las visitas se cuentan con un **hash irreversible por invitación**, sin
  IP ni cookies (`visitas`).
- Los logs **redactan** JWT, claves `sb_*` y tokens hex antes de
  escribirse (`lib/registro.ts`).
- Los correos internos van **solo** a `NOTIFICACIONES_EMAIL`, nunca a
  listas de invitados.
- Todo lo personal es `noindex` + `no-referrer`.

## Backups

Los backups (cuando existan — ver `docs/backups-y-recuperacion.md`)
retienen lo que retiene la base en el momento de la copia. Una
eliminación a petición del cliente NO reescribe backups pasados: caduca
con ellos según su propia rotación. Esto hay que decírselo al cliente
que pida borrar: "desaparece del sistema ya; de las copias de seguridad,
en N días".

## Qué falta para activar esta política

1. Que el propietario revise los plazos de la tabla y los apruebe (o los
   cambie: son propuestas razonadas, no ley).
2. Una herramienta de limpieza en `/panel/mantenimiento` que ENSEÑE qué
   borraría (cuántas filas, de qué) y pida confirmación explícita — nunca
   un cron que borra solo en silencio.
3. Anotar la limpieza ejecutada en auditoría (qué, cuánto, quién).
