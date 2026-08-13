# Migraciones de la base de datos

## Las dos puertas

**Instalación nueva:** ejecuta `supabase/schema.sql` completo y ya está — es
la foto actual del esquema entero, con RLS, índices, triggers y bucket. Las
migraciones no te hacen falta.

**Instalación que ya existe:** ejecuta las migraciones de
`supabase/migrations/` que te falten, **en orden de nombre**. Empiezan por su
fecha (`AAAAMMDDHHMMSS_`), así que el orden alfabético ES el orden
cronológico. Todas son repetibles: correr una que ya corriste no rompe nada
(usan `if not exists` / `drop policy if exists` donde toca), y cada una
termina con una consulta de comprobación cuyas filas deben decir OK.

Después de migrar, ejecuta `supabase/verificar-instalacion.sql`: compara
tablas, columnas, índices, RLS y políticas contra lo esperado y señala
exactamente qué falta. Esa es la verificación automatizada del esquema — no
te fíes de la memoria ni de este documento.

## La secuencia

| Migración | Qué agrega |
|---|---|
| `20260725151900_invitaciones` | Tabla `invitaciones` (slug, plantilla, datos, estado) |
| `20260725215600_rsvp-confirmaciones` | Tabla `confirmaciones` (RSVP persistente) |
| `20260726013400_visitas` | Tabla `visitas` (métrica de aperturas) |
| `20260726015600_aviso-vencimiento` | Columna `aviso_vencimiento_en` en `pedidos` |
| `20260726104800_codigo-propio` | Columna `codigo_html` (invitaciones hechas fuera) |
| `20260726123000_dominio-propio` | Columna `dominio` + índice único (dominio del cliente) |
| `20260726135300_cerrar-acceso-equipo` | Lista blanca `equipo`, `es_del_equipo()`, políticas cerradas |
| `20260803001800_panel-invitados` | `token_lista` en invitaciones + tabla `invitados` (panel del anfitrión) |
| `20260805120000_leads-y-demos` | Tablas `leads` (idempotencia, atribución) y `demos` (escaparate de la web) |
| `20260805150000_operaciones` | Columna `rol` en equipo; `historial_estados` y `auditoria` inmutables; anulación en `pagos` |
| `20260805180000_generaciones-ia` | Tabla `generaciones` (registro trazable del pipeline de IA) |
| `20260805210000_cliente-e-invitados` | `versiones`, `revisiones`, `comentarios`, `hogares`, `entradas`, `avisos`; candado `bloqueada_en`; `hogar_id` |
| `20260805230000_escala` | Tabla `frenos` + función atómica `frenar()` (rate limit compartido); índice del tablero |
| `20260806010000_pagos-completos` | `pagos`: referencia, fecha efectiva, firma, idempotencia y comprobante |
| `20260806030000_rsvp-avanzado` | `confirmaciones.respuestas` (preguntas extra configurables del RSVP) |

Los archivos se movieron aquí con `git mv` desde `supabase/migracion-*.sql`:
el historial de cada uno se conserva completo (`git log --follow`).

## Reglas para la próxima migración

1. **Nombre:** `AAAAMMDDHHMMSS_que-hace.sql`, fecha de cuando se escribe.
2. **Cabecera:** qué agrega, por qué, y qué pasa con los datos existentes.
3. **Repetible:** `if not exists` para tablas/columnas/índices; para políticas,
   `drop policy if exists` + `create`. Correrla dos veces no puede dañar.
4. **RLS siempre:** toda tabla nueva nace con `enable row level security` y su
   política `es_del_equipo()` en la misma migración, no en una posterior.
5. **Comprobación al final:** una consulta que diga OK/FALTA por cada cosa
   que la migración promete. Es lo que el equipo mira tras pegar y correr.
6. **Actualiza los tres sitios:** la migración (instalaciones viejas),
   `schema.sql` (instalaciones nuevas) y `verificar-instalacion.sql` (los
   conteos esperados). Si se te olvida el segundo, una instalación nueva y
   una migrada divergen en silencio.
7. **Irreversible = dilo:** si una migración borra o transforma datos sin
   vuelta atrás, la cabecera lo declara y explica el respaldo previo. Ninguna
   de las actuales lo es.
8. **Nada de datos personales** en seeds ni ejemplos.

## Entornos

Hoy existe un solo proyecto de Supabase (producción). Para staging:

1. Crear un segundo proyecto en Supabase (gratis) — nunca clonar datos reales.
2. Ejecutar `schema.sql` allí y sembrar `equipo` con usuarios de prueba.
3. En Vercel, apuntar los deployments de preview a ese proyecto con variables
   de entorno de ámbito Preview.

Está documentado como pendiente en `docs/auditoria-studio-antes.md`; montarlo
es acción manual del propietario (requiere crear el proyecto).

## Cómo se aplican (hoy)

A mano: Supabase Dashboard → SQL Editor → pegar → Run → leer la comprobación.
No hay pipeline que ejecute migraciones en producción, y eso es deliberado
mientras el equipo sea de este tamaño: el paso manual con comprobación a la
vista es más seguro que una automatización sin supervisión. Si algún día se
adopta el CLI de Supabase (`supabase db push`), esta carpeta ya tiene el
formato que espera.
