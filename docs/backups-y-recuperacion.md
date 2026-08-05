# Backups y recuperación

Qué se pierde si Supabase amanece vacío, y cómo evitarlo. El dato que no
tiene copia es el trabajo de los clientes: pedidos, formularios contestados,
invitaciones diseñadas, confirmaciones de asistencia y fotos.

## Qué hay que respaldar

| Qué | Dónde vive | Cuánto duele perderlo |
|---|---|---|
| Base de datos (todas las tablas) | Supabase Postgres | 🔴 El negocio entero |
| Fotos y videos de clientes | Supabase Storage, bucket `fotos-pedidos` | 🔴 Irrecuperable: son SUS archivos |
| Esquema | `supabase/schema.sql` en Git | 🟢 Ya versionado |
| Código | GitHub | 🟢 Ya versionado |
| Variables de entorno | Vercel | 🟡 Reconstruibles, pero apunta los nombres |

## Lo que Supabase hace solo (y sus límites)

- **Plan gratuito:** NO hay backups automáticos de Postgres. Si el proyecto
  sigue en free, hoy no existe ninguna copia — el respaldo manual de abajo
  no es opcional.
- **Plan Pro:** backups diarios con 7 días de retención, restauración desde
  el dashboard (Database → Backups). El Storage **no entra** en esos backups:
  las fotos hay que respaldarlas aparte en cualquier plan.

## Respaldo manual (mientras no haya plan Pro)

**Base de datos — semanal, 10 minutos:**

```bash
# La cadena está en Supabase → Project Settings → Database → Connection string
pg_dump "<CONNECTION_STRING>" \
  --schema=public --no-owner --no-privileges \
  -f respaldo-$(date +%Y%m%d).sql
```

Guarda el archivo fuera del repositorio (Drive/Dropbox cifrado). **Contiene
datos personales de clientes: nunca a Git, nunca por WhatsApp.**

**Storage — mensual o tras cada tanda de eventos:**

```bash
# Con el CLI de Supabase autenticado:
supabase storage cp -r ss:///fotos-pedidos ./respaldo-fotos --experimental
```

**Calendario propuesto** (ajústalo al volumen real):

| Qué | Frecuencia | Retención |
|---|---|---|
| `pg_dump` | Semanal, y SIEMPRE antes de una migración | 8 copias (2 meses) |
| Storage | Mensual | 2 copias |
| Prueba de restauración | Trimestral | — |

## Restauración

1. Crear un proyecto de Supabase limpio (sirve el de staging).
2. `psql "<CONNECTION_STRING_NUEVO>" -f respaldo-AAAAMMDD.sql`
3. Subir el respaldo del Storage al bucket `fotos-pedidos` del proyecto nuevo.
4. Sembrar `equipo` (los usuarios de Auth no viajan en `pg_dump` del esquema
   `public`; hay que recrearlos en Authentication y re-insertarlos en `equipo`).
5. Apuntar las variables de Vercel al proyecto restaurado y redesplegar.
6. `supabase/verificar-instalacion.sql` → todo OK.

**La prueba trimestral es el paso que todo el mundo se salta** y el único
que convierte "tenemos backups" en "podemos volver". Hacerla en staging con
el último respaldo real; si falla, el backup era decorativo.

## Objetivos honestos (con respaldo manual)

- **RPO** (cuánto trabajo se puede perder): una semana — lo que diga la
  última copia. Con plan Pro baja a 24 h sin esfuerzo.
- **RTO** (cuánto se tarda en volver): medio día siguiendo la restauración
  de arriba, si la prueba trimestral se ha hecho alguna vez.
- **Responsable:** el propietario del proyecto de Supabase. Un backup sin
  dueño con nombre no existe.

## Qué NO cubre esto

- Los tokens de sesión del equipo (se regeneran al entrar de nuevo).
- Deployments de Vercel (se reconstruyen desde Git).
- El historial de Git de GitHub (considera un mirror si el repo se vuelve
  crítico).
