# Rotación de la clave secreta de Supabase

**Por qué existe este documento:** el commit `550890b` subió `.env.local` a
GitHub con la clave administrativa dentro. El commit `393c301` sacó el archivo
del árbol, pero **el commit viejo sigue en el historial público de `main`**:
cualquiera que clone el repositorio puede leer la clave. Borrar el archivo no
revoca nada — la clave sigue funcionando hasta que se rote en Supabase.

**Estado: 🔴 BLOQUEANTE MANUAL.** Esto no lo puede hacer el código ni un
agente: requiere entrar al panel de Supabase con la cuenta propietaria.
Mientras no se haga, cualquiera con la clave vieja puede leer y modificar
toda la base de datos saltándose RLS.

---

## Pasos (30 minutos, en este orden)

### 1. Revocar la clave vieja y generar la nueva

1. [supabase.com/dashboard](https://supabase.com/dashboard) → proyecto de Invifty
   → **Project Settings → API Keys**.
2. Si el proyecto usa el sistema nuevo de claves: en **Secret keys**, crea una
   clave nueva y **revoca** la anterior.
3. Si usa el sistema clásico (`service_role` JWT): **Project Settings → API →
   JWT Settings → Rotate JWT secret**. Ojo: rotar el JWT secret invalida
   **también la clave `anon`** y cierra las sesiones activas del equipo —
   hazlo fuera de horario de clientes y copia las dos claves nuevas.

### 2. Actualizar Vercel

1. Vercel → proyecto `invifty-studio` → **Settings → Environment Variables**.
2. Actualiza `SUPABASE_SECRET_KEY` (o `SUPABASE_SERVICE_ROLE_KEY`; el código
   acepta ambas y prefiere la primera — ver `src/lib/entorno.ts`).
3. Si rotaste el JWT secret, actualiza también `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. **Redeploy** — sin redesplegar, las funciones siguen usando la clave vieja.

### 3. Actualizar desarrollo local

En `.env.local` (que ya NO está rastreado): pega la clave nueva. Nada más.

### 4. Comprobar que la clave vieja murió

Desde una terminal cualquiera (sustituye `<URL>` y `<CLAVE_VIEJA>`):

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  -H "apikey: <CLAVE_VIEJA>" -H "Authorization: Bearer <CLAVE_VIEJA>" \
  "<URL>/rest/v1/clientes?select=id&limit=1"
```

- **401 o 403** → la rotación funcionó.
- **200** → la clave vieja sigue viva; repite el paso 1.

Comprueba también que el sistema sigue vivo con la nueva: abre el panel,
abre un formulario `/f/<token>`, confirma un RSVP de prueba.

### 5. Revisar si alguien la usó

Supabase → **Logs → API / Postgres**. Busca en el rango desde la fecha del
commit filtrado: peticiones REST con volumen o tablas inusuales, orígenes
desconocidos, lecturas masivas de `clientes` o `formularios`. Si hay señales
de uso ajeno, trata los datos de clientes como potencialmente expuestos y
decide el aviso que corresponda.

### 6. Deployments antiguos

Los deployments viejos de Vercel conservan las variables con las que se
compilaron. Tras rotar: Vercel → Deployments → borra los deployments
antiguos accesibles por URL, o desactiva el acceso público a previews
(**Settings → Deployment Protection**).

### 7. Evitar la próxima

Ya está hecho en el repositorio:

- `.gitignore` cubre `.env*` y `.env.local` no está rastreado.
- `src/lib/entorno.ts` centraliza la lectura: las claves secretas revientan
  con un error claro si algún componente de navegador las pide (la prueba
  `pruebas/entorno.prueba.ts` lo garantiza).
- CI compila con valores de relleno: ningún secreto real vive en GitHub.

Queda a criterio del propietario: reescribir el historial de `main` para
extirpar el commit (`git filter-repo` + force push + reclonar todo el mundo).
**Con la clave rotada es opcional** — el commit expone una clave muerta — y
rompe los clones existentes, así que solo vale la pena si el repositorio va
a hacerse público.

---

## Historial

| Fecha | Qué pasó |
|---|---|
| jul 2026 | `.env.local` subido con la clave (`550890b`) |
| jul 2026 | Archivo sacado del árbol; el historial la conserva (`393c301`) |
| ago 2026 | Lectura centralizada en `entorno.ts` con guardia anti-navegador |
| _pendiente_ | **Rotación en Supabase (pasos 1–6 de arriba)** |
