# Informe final — Mejora integral de Invifty Studio

Etapas A–F del plan maestro, ejecutadas en secuencia con confirmación
entre etapas. Este informe dice lo que HAY, lo que FALTA y lo que le toca
al propietario — sin presentar documentación como si fuera implementación.

## Resumen ejecutivo

Studio pasó de "panel interno con costuras" a un sistema con:
**seguridad verificable** (RLS + lista blanca con roles, auditoría e
historial inmutables, secretos fuera del repo y CI que los vigila),
**una sola fuente de verdad comercial** (catálogo de planes que consumen
el panel y la web pública por API con CORS e idempotencia), **operaciones
trazables** (transiciones de estado validadas, pagos que se anulan y no
se borran, exportación por pedido), **IA con contrato** (propone solo
dentro del catálogo real, datos factuales vetados, cada generación
registrada con costo), **el ciclo completo con el cliente y sus
invitados** (versiones inmutables → revisión por enlace → aprobación
firmada que bloquea → hogares con cupo → RSVP personal → recepción el día
del evento → avisos que no se pierden), y **escala razonable** (freno
compartido entre instancias, listas acotadas/paginadas, política de
retención propuesta, CI con detección de secretos).

## Cambios por etapa

| Etapa | Commit | Contenido |
|---|---|---|
| A — Bloqueantes | `5c4d0b3` | .env fuera del repo + guardas, RLS cerrada a la lista `equipo`, frenos en rutas públicas, slugs no adivinables, saneo de logs |
| B — Unificación comercial | `5c122c2` | `lib/planes.ts` como catálogo único (fichas, precios, vigencias, capacidades), API pública (catálogo, demos, leads con idempotencia + honeypot + CORS), panel de leads y demos |
| C — Operaciones | `60a700f` | Roles y permisos en servidor, auditoría e historial inmutables, transiciones de estado validadas, anulación de pagos (no borrado), exportación, timezone RD |
| D — IA (mock) | `d7bc5d4` | Pipeline creativo: brief sin PII → proveedor (mock determinista / Claude listo) → aduana de catálogo → registro `generaciones` → aplicar en estado local |
| E — Cliente e invitados | `e6e08bc` | Versiones inmutables, /revision/<token>, aprobación con firma + candado, hogares con cupo, RSVP personal, recepción/check-in, QRs opacos, outbox de avisos |
| F — Escala | (este commit) | Freno compartido en Postgres, panel acotado y paginado, política de retención, CI con secretos + auditoría de dependencias, documentación final |

## Base de datos

**Migraciones de la mejora** (todas repetibles, en `supabase/migrations/`,
espejadas en `schema.sql` y verificables con `verificar-instalacion.sql`):

1. `20260805120000_leads-y-demos.sql` — leads (idempotencia), demos
2. `20260805150000_operaciones.sql` — rol en equipo, historial_estados y auditoria (inmutables), anulación en pagos
3. `20260805180000_generaciones-ia.sql` — registro de generaciones de IA
4. `20260805210000_cliente-e-invitados.sql` — versiones, revisiones, comentarios, hogares, entradas, avisos; `bloqueada_en`, `hogar_id`
5. `20260805230000_escala.sql` — frenos + función `frenar()` atómica, índice del tablero

**RLS**: activa en todas las tablas; todas las políticas exigen
`es_del_equipo()`. `frenos` no tiene políticas a propósito (solo
service_role). Inmutables por trigger: `historial_estados`, `auditoria`,
`versiones`. **Backfill**: no hizo falta (columnas nuevas nullable o con
default). **Rollback**: las migraciones solo AÑADEN; revertir es no usar
lo añadido. Nada destructivo. **Riesgo**: ninguna migración se ha
ejecutado aún en producción — es el paso manual nº 1.

## Variables de entorno

| Variable | Propósito | Entorno |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Proyecto Supabase (públicas) | Local + Vercel |
| `SUPABASE_SECRET_KEY` (o `SUPABASE_SERVICE_ROLE_KEY`) | Clave de servidor; se salta RLS. **Jamás al navegador** | Local + Vercel |
| `NEXT_PUBLIC_APP_URL` | URL canónica (enlaces de formularios/revisión) | Local + Vercel |
| `RESEND_API_KEY`, `NOTIFICACIONES_EMAIL`, `NOTIFICACIONES_REMITENTE` | Avisos internos por email (opcionales) | Vercel |
| `CRON_SECRET` | Protege el repaso diario | Vercel |
| `ORIGENES_PERMITIDOS` | CORS de la API pública (dominios de la web) | Vercel |
| `IA_PROVEEDOR`, `IA_API_KEY` | Proveedor de conceptos (vacío = mock) | Vercel |

Ningún valor vive en el repositorio; una prueba y un job de CI lo vigilan.

## Verificación (resultados reales, último estado)

```text
npm run lint      → sin errores ni avisos
npx tsc --noEmit  → sin errores
npm test          → 299 pruebas, 299 pasan, 0 fallan
npm run build     → compila; todas las rutas presentes
```

## Pruebas

- **Antes de la mejora**: 201 · **Ahora**: 299 (+98, y ninguna se eliminó).
- Áreas nuevas: catálogo/planes coherentes, API pública (contratos, CORS,
  idempotencia), roles y permisos, transiciones de estado, pagos
  (anulación), saneo de logs, pipeline de IA (aduana, brief sin PII,
  determinismo del mock, lista blanca de aplicar), revisión del cliente
  (estados, caducidad, evidencia), check-in (cupo, reingreso, anuladas),
  avisos (escapado HTML, reintentos), freno compartido (traducción de
  veredicto, política de fallo abierto, respaldo local).
- Pendientes: end-to-end con base real (hoy todo lo probado es lógica
  pura + guardas de código); pruebas de la función SQL `frenar()`.

## Seguridad

**Resuelto**: base cerrada a la lista `equipo` con roles validados en
servidor; auditoría inmutable de acciones sensibles; tokens opacos
revocables (formulario, lista, revisión, hogares); QR sin datos
personales; candado de aprobación; logs que redactan credenciales;
`noindex`/`no-referrer` en todo lo personal; freno local + compartido;
honeypot e idempotencia en leads; CI con detección de secretos;
`.env` fuera del repo con guardas.

**Pendiente (manual, P0)**: rotar la clave de Supabase que estuvo en el
historial de git (`docs/rotacion-credenciales.md`). **Riesgo residual**:
las claves del historial siguen siendo válidas hasta esa rotación;
`npm audit` arrastra 3 avisos altos en dependencias internas de Next 16
(postcss/sharp) que solo cierra el parche de Next — el job `dependencias`
del CI los vigila sin bloquear.

## Rendimiento

- Tablero acotado (400 más recientes + conteo real), leads paginados con
  embudo por conteo, métricas y vencimientos con tope explícito, visitas
  (la tabla que más crece) acotada a 5.000.
- Índices nuevos: `pedidos_creado_idx`, parciales en avisos/frenos, y los
  de cada tabla nueva (Etapas B–E).
- Procesos largos fuera de la petición: outbox con intento inmediato +
  barrido en cron; derivación de fotos ya vivía en mantenimiento.
- Invitación pública: imágenes derivadas, video con poster, lazy loading,
  animación reducida respetada (etapas previas).
- Sin medir aún: Web Vitals reales en producción (entra con la
  observabilidad de pago o el Analytics de Vercel).

## Integración con la web (INVIFTY, sin tocar ese repo)

- `GET /api/public/catalog` — catálogo de planes (ETag/304, CORS).
- `GET /api/public/demos` (+ `/portada`) — demos publicadas.
- `POST /api/public/leads` — leads con `clave_idempotencia`, honeypot,
  freno compartido y CORS por `ORIGENES_PERMITIDOS`.
- Contratos documentados en `docs/integracion-invifty-web.md`.
- **Falta activar**: que la web consuma estos endpoints (trabajo del otro
  repositorio) y definir `ORIGENES_PERMITIDOS` en Vercel.

## IA

- Proveedores: `mock` (activo, determinista, costo 0) · `anthropic`
  (escrito y apagado; se activa con `IA_API_KEY` + `IA_PROVEEDOR`).
- Esquema: salida estructurada con enums construidos del catálogo vivo;
  la aduana rechaza (no corrige) lo alucinado; datos factuales vetados
  incluso escondidos en el copy; exactamente 3 conceptos.
- Registro: tabla `generaciones` (proveedor, modelo, versión de prompt,
  hash del brief, tokens, costo, latencia, válido/fallido). Sin cadenas
  de razonamiento ni claves.
- Feature flag: `IA_PROVEEDOR` (off apaga el botón honestamente).
- Limitaciones: sin auditoría visual automatizada, sin generación de
  historia larga, huella de parecido solo dentro de la tanda.

## Pasos manuales (en orden)

1. **Rotar la clave de Supabase** — `docs/rotacion-credenciales.md` (P0).
2. **Correr las 5 migraciones** en el SQL Editor, en orden de fecha, y
   pegar `verificar-instalacion.sql` hasta que todo diga OK (P0).
3. Definir `ORIGENES_PERMITIDOS`, `CRON_SECRET` y (si se quiere email)
   `RESEND_API_KEY` + `NOTIFICACIONES_EMAIL` en Vercel.
4. Asignar roles reales en la tabla `equipo` (hoy: todos admin).
5. Decidir backups (plan free = cero hoy) — `docs/backups-y-recuperacion.md`.
6. Crear el proyecto de staging (mismo schema.sql, claves propias).
7. Aprobar (o ajustar) la política de retención — `docs/privacidad-y-retencion.md`.
8. Cuando toque: activar Claude (`IA_API_KEY` + `IA_PROVEEDOR=anthropic`)
   y Sentry u otra observabilidad de pago (`docs/observabilidad.md`).

## Riesgos pendientes

- **P0 — bloqueantes**: clave histórica sin rotar; migraciones sin
  ejecutar en producción (las funciones nuevas degradan con gracia, pero
  no existen hasta entonces).
- **P1 — importantes**: sin backups en plan free; sin staging real; sin
  observabilidad de producción (los errores viven en logs de Vercel).
- **P2 — siguientes**: e2e con base real; Web Vitals medidos; escaneo QR
  con cámara en recepción; los avisos de `npm audit` cuando Next parchee.
- **P3 — futuros**: multiempresa (hoy es un solo estudio a propósito);
  notificaciones directas a clientes/invitados (canal real: WhatsApp);
  colas dedicadas si el outbox se queda corto; huella global de IA.
