# Auditoría de Invifty Studio — antes de la mejora integral

**Fecha:** agosto 2026 · **Punto de partida de la Etapa A** (bloqueantes)
del plan de mejora integral. Complementa `AUDITORIA.md` (julio 2026): aquí
no se repite aquel informe — se **verifica** qué hallazgo sigue vigente y se
retrata el estado actual con evidencia de este repositorio.

## 1. Línea base (medida, no supuesta)

Ejecutada sobre `main` en `e7d86a2` antes de tocar nada:

| Verificación | Resultado |
|---|---|
| `npm run lint` | ✅ limpio |
| `npx tsc --noEmit` | ✅ sin errores |
| `npm test` | ✅ 208/208 |
| `npm run build` | ✅ compila (Next.js 16, App Router) |
| CI (GitHub Actions) | ✅ lint + tipos + pruebas + build en cada push |

## 2. Arquitectura actual

```text
Navegador público                    Equipo (con sesión)
│                                    │
├─ /i/<slug>  invitación             ├─ /panel/**  (proxy exige sesión
├─ /d/<host>  ídem, dominio propio   │   Supabase + lista blanca `equipo`)
├─ /f/<token> formulario cliente     ├─ /muestra/<plantilla>
├─ /lista/<token> panel anfitrión    └─ /login
├─ /revision… (no existe aún)
│
└─ /api/**  ←― ÚNICA vía de escritura pública, siempre con clave admin
   ├─ formulario/<token>(+fotos)   token = credencial del cliente
   ├─ invitacion/<slug>/rsvp|visita|ics
   ├─ lista/<token>/invitados
   ├─ panel/mantenimiento/**       exige sesión + equipo
   └─ cron/vencimientos            exige CRON_SECRET (Bearer)
```

- **Server Actions** (`"use server"`): `lib/acciones.ts` (clientes, pedidos,
  pagos) y `lib/acciones-invitacion.ts` (invitación, publicar, slug, dominio).
- **Clave administrativa**: solo en `lib/supabase/admin.ts`, consumida por
  rutas API y acciones de servidor. Desde esta etapa, leída vía
  `lib/entorno.ts`, que revienta con error claro si se pide en el navegador.
- **HTML de terceros** (invitaciones de código): iframe `sandbox` sin
  `allow-same-origin` (`lib/codigo.ts`); el puente RSVP valida
  `event.source` contra el iframe propio (`CodigoPropio.tsx:51`) y la forma
  del mensaje (`esMensajeRsvp`). **Verificado en esta auditoría.**

**Base de datos (9 tablas):** `clientes`, `pedidos`, `pagos`, `formularios`,
`invitaciones`, `confirmaciones`, `visitas`, `invitados`, `equipo` — todas
con RLS y política `es_del_equipo()`; bucket `fotos-pedidos` privado con URLs
firmadas. `verificar-instalacion.sql` comprueba tablas, columnas, índices,
RLS y políticas contra conteos esperados.

## 3. Hallazgos de AUDITORIA.md — verificación de vigencia

| Hallazgo (jul 2026) | ¿Sigue vigente? (ago 2026) |
|---|---|
| 1. Clave secreta filtrada en Git | 🔴 **SÍ — bloqueante manual.** `.env.local` ya no está rastreado (`393c301`), pero `550890b` sigue alcanzable desde `main` con la clave dentro. Rotarla es lo único que la mata: `docs/rotacion-credenciales.md`. |
| 2–9 (OG, fotos, RSVP, paletas, visitas, deuda, catálogo, enlaces) | ✅ Resueltos y verificados: el código citado existe y sus pruebas pasan. |

## 4. Estado real por área (agosto 2026)

### Sólido y verificado
- Seguridad de borde: RLS + lista blanca, bucket privado, tokens
  `crypto.randomUUID`, sandbox de código externo, rate limiting en rutas
  públicas, cabeceras (nosniff, HSTS, X-Frame-Options en lo privado,
  no-referrer + noindex en invitaciones).
- 220 pruebas tras la Etapa A (208 en la base), incluyendo seguridad de
  dominios, cierre de RSVP con zona horaria, ICS, redacción de logs y
  variables de entorno.
- Flujos completos: pedido→formulario→invitación→publicación→RSVP→
  vencimiento, con panel del anfitrión y cierre por fecha límite.

### Riesgos vigentes (entran en etapas B–F)
| Riesgo | Evidencia | Etapa |
|---|---|---|
| Rate limiter por instancia (memoria de proceso) | `lib/limite.ts:11-21` — honesto en sus límites; no frena ataque distribuido y se resetea al dormir la función | F |
| Listados del panel sin paginación | ningún `.range()`/`.limit()` en `src/app/panel/**`; con cientos de pedidos cargará todo en memoria | C |
| Sin auditoría de acciones sensibles | pagos se borran vía `eliminarPago` sin rastro de quién/cuándo | C |
| Un solo rol (equipo sí/no) | `es_del_equipo()` binario; sin distinción propietario/ventas/diseño | C |
| Estados de pedido como strings en check constraint | transiciones no validadas: cualquier estado puede saltar a cualquier otro | C |
| Sin errores del navegador (Sentry) | solo logs de servidor; un crash del editor es invisible | A parcial → F |
| Backups: ninguno automatizado en plan free | `docs/backups-y-recuperacion.md` define el manual | A (doc) / manual |
| Sin staging | un solo proyecto Supabase; migraciones se prueban en producción | manual |
| `EditorInvitacion.tsx` con 999 líneas | monolito de editor; funcional pero costoso de tocar | D |
| Concurrencia en RSVP mitigada solo por índice único | correcto hoy; revisar al pasar a hogares | E |

### Brecha vendido-vs-implementado (para el catálogo central, etapa B)
- "QR individual" (plan Premium): no existe en el sistema.
- "Recordatorios" (Premium): solo email interno al equipo; nada hacia
  invitados.
- "Galería post-evento" (extra): sin soporte específico.
- Los planes viven en `lib/planes.ts` (código): la web pública no puede
  consultarlos; cambiar un precio exige deploy.

## 5. Migraciones y esquema
- Desde esta etapa: `supabase/migrations/` con 8 migraciones en orden
  cronológico (`AAAAMMDDHHMMSS_`), movidas con `git mv` (historial íntegro).
- `schema.sql` = foto completa para instalación nueva; **regla de los tres
  sitios** documentada en `docs/migraciones.md`.
- Sin drift conocido entre schema y migraciones: `verificar-instalacion.sql`
  es el árbitro y cubre las 8 tablas + lista blanca + políticas abiertas.

## 6. Qué cambió la Etapa A (resumen)
1. Migraciones versionadas + verificación de esquema al día.
2. `lib/entorno.ts`: variables centralizadas, errores con nombre, guardia
   anti-navegador para secretos (con pruebas).
3. `lib/registro.ts`: logs de servidor con redacción de secretos, cableado
   en los 500 ciegos de RSVP y lista de invitados (con pruebas).
4. Documentos: rotación de credenciales (bloqueante manual), migraciones,
   backups/recuperación, observabilidad, esta auditoría.

**Bloqueantes manuales abiertos:** rotar la clave de Supabase; decidir plan
Pro o respaldo manual programado; crear proyecto staging.
