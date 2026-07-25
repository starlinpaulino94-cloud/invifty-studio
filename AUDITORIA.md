# Auditoría de Invifty Studio

**Fecha:** julio 2026 · **Alcance:** todo el repositorio (58 archivos, ~9,700 líneas)
**Objetivo:** entender el sistema completo y detectar qué mejorar para dar mejores
resultados a los clientes que nos piden sus invitaciones.

---

## Resumen ejecutivo

Invifty Studio está **mucho mejor construido que la mayoría de sistemas internos de
su tamaño**. El código compila limpio, TypeScript pasa sin errores, la arquitectura
de seguridad está bien pensada (RLS + service_role solo en servidor + bucket privado),
y el sistema de diseño de invitaciones —10 plantillas reales con ornamentos propios,
24 paletas, 10 parejas tipográficas— es un activo serio. No es un prototipo.

Dicho eso, la auditoría encontró **una fuga de credenciales que hay que resolver hoy**
y un patrón que se repite en varios puntos: **el sistema recoge más de lo que aplica**.
El cliente contesta preguntas cuyas respuestas nunca llegan a su invitación, elige
colores que el sistema descarta en silencio, y confirma asistencia sin que quede
registro. Cerrar esa brecha entre "lo que pedimos" y "lo que entregamos" es la mayor
palanca de calidad disponible, y casi todo es trabajo de un día por punto.

**Prioridades en orden:**

| # | Tema | Impacto | Esfuerzo |
|---|---|---|---|
| 1 | Clave secreta de Supabase filtrada en Git | 🔴 Crítico | 1 h |
| 2 | Sin vista previa al compartir por WhatsApp | 🟠 Alto | 1 día |
| 3 | Fotos sin optimizar (invitaciones de 50-90 MB) | 🟠 Alto | 1-2 días |
| 4 | Las confirmaciones (RSVP) no se guardan | 🟠 Alto | 2 días |
| 5 | Paletas y respuestas que se descartan en silencio | 🟠 Alto | 1 día |
| 6 | Sin métrica de vistas para el cliente | 🟡 Medio | 1 día |
| 7 | Deuda técnica (lint roto, sin tests, sin CI) | 🔵 Base | 1-2 días |

---

## 0. Lo que ya está muy bien

Vale la pena nombrarlo, porque conviene **no romperlo** al mejorar el resto:

- **Arquitectura de seguridad correcta.** El formulario público nunca toca Supabase
  directamente: pasa por rutas API que validan el token único. RLS activo en las
  cuatro tablas. Bucket de fotos privado con URLs firmadas. Middleware que protege
  `/panel`. Esto está bien resuelto.
- **Fechas sin bugs de zona horaria.** `src/components/invitacion/base/Marco.tsx:110-152`
  formatea a mano en lugar de usar `toLocaleDateString`, precisamente para que servidor
  y navegador coincidan. Es un detalle que casi nadie acierta a la primera.
- **Autoguardado del formulario** con reanudación en el primer paso pendiente
  (`Asistente.tsx:66-96`). El cliente puede cerrar y volver. Muy bien pensado para
  alguien llenando desde el celular por WhatsApp.
- **El sistema de diseño es real**, no plantillas recoloreadas. Cada plantilla tiene
  portada, ornamentos vectoriales y ritmo propios.
- **Dictado por voz** sin coste ni claves, con degradación limpia si el navegador no
  lo soporta.
- **Notificaciones que nunca rompen el flujo** (`notificaciones.ts:88-91`): si Resend
  falla, el cliente igual termina su formulario.
- **Documentación excelente.** El README explica el sistema mejor que muchos productos
  comerciales, e incluso **admite sus propias inconsistencias** (§5, vigencias).

---

## 1. 🔴 CRÍTICO — Clave secreta de Supabase filtrada en Git

**Esto es lo primero. Antes que cualquier mejora.**

El archivo `.env.local` está **versionado y subido a GitHub** en el commit
`550890b "Add Supabase configuration to .env.local"`, presente en la rama `main`.

Contiene:

```
NEXT_PUBLIC_SUPABASE_URL      → identifica el proyecto
NEXT_PUBLIC_SUPABASE_ANON_KEY → pública, no es problema
SUPABASE_PUBLISHABLE_KEY      → pública, no es problema
SUPABASE_SECRET_KEY           → ⚠️ CLAVE SECRETA COMPLETA
```

`SUPABASE_SECRET_KEY` es el equivalente moderno de `service_role`: **salta RLS por
completo**. Quien la tenga puede leer, modificar y borrar toda la base de datos y
todo el Storage sin autenticarse: nombres de clientes, teléfonos de WhatsApp,
direcciones de eventos, montos pagados y **todas las fotos privadas que los clientes
subieron de sus bodas y de sus hijos**.

El `.gitignore` sí incluye `.env*` (línea 34), así que el archivo se añadió
forzándolo. La protección existía y se saltó.

**Qué hacer, en este orden:**

1. **Rotar la clave hoy** — Supabase Dashboard → Project Settings → API Keys →
   revocar/regenerar la secret key. Todo lo demás es secundario mientras la clave
   vieja siga viva.
2. Actualizar la clave nueva en Vercel → Environment Variables (y en tu `.env.local`
   local, **sin** volver a versionarlo).
3. Sacar el archivo del control de versiones:
   `git rm --cached .env.local && git commit`.
4. Purgar el historial (`git filter-repo` o BFG) y forzar el push. Si el repo es
   privado y solo el equipo tuvo acceso, el riesgo real es menor — pero la rotación
   del paso 1 no es opcional en ningún escenario.
5. Revisar en Supabase → Logs si hubo accesos desde IPs desconocidas.

**Para que no se repita:** activar Secret Scanning + Push Protection en GitHub
(Settings → Code security). Es gratis y bloquea el push antes de que ocurra.

---

## 2. 🟠 La invitación no tiene vista previa al compartirla

**Este es el mayor punto de calidad percibida, y el más barato de arreglar.**

El cliente recibe su invitación y hace exactamente una cosa: **la comparte por
WhatsApp** a 150 invitados. Ese enlace compartido es la primera impresión de tu
producto para 150 personas.

Hoy `src/app/i/[slug]/page.tsx:38-42` genera solo esto:

```ts
return {
  title: `${datos.titulo} — Invitación`,
  description: datos.subtitulo || "Estás invitado. Abre tu invitación digital.",
  robots: { index: false, follow: false },
};
```

Sin `openGraph`, sin imagen. En WhatsApp, Instagram y Facebook el resultado es un
**enlace gris sin imagen** — indistinguible de un link cualquiera. Toda la
sofisticación del sobre lacrado, el monograma y los ornamentos queda invisible en el
único momento en que la invitación se propaga.

**La mejora:** añadir metadatos Open Graph y una imagen generada dinámicamente por
invitación (Next.js trae `opengraph-image` + `ImageResponse` justo para esto — ver
`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/opengraph-image.md`).
La imagen puede componerse con la paleta y tipografía reales de la invitación:
monograma, "Camila & Lucas", la fecha larga. El invitado ve una tarjeta elegante
antes siquiera de tocar el link.

Costo: un día. Impacto: lo ven todos los invitados de todos los clientes.

Nota relacionada: falta también `themeColor` (la barra del navegador móvil sale
blanca genérica sobre una invitación de fondo negro) y `apple-mobile-web-app-title`
para cuando el invitado la guarda en su pantalla de inicio.

---

## 3. 🟠 Las invitaciones pesan demasiado en datos móviles

Las fotos se sirven **crudas, tal como el cliente las subió**, con `<img>` normal:

- `src/components/invitacion/base/Piezas.tsx:315` — galería
- `src/components/invitacion/plantillas/Editorial.tsx:35` — portada a pantalla completa

Una foto de celular moderno pesa 3-6 MB. El plan Popular permite 15 fotos; Premium y
Luxury son **ilimitados** (`planes.ts:29-34`). Una galería de 15 fotos = **50-90 MB**
que el invitado descarga con sus datos móviles. En una conexión 4G promedio dominicana
eso es más de un minuto, y muchos invitados abandonan antes.

Además la **portada no tiene `loading="lazy"`** (correcto, es lo primero que se ve)
pero tampoco está redimensionada: se descarga la foto completa de 6 MB para mostrarla
al 32% de opacidad detrás del texto.

**La mejora, dos caminos combinables:**

1. **Generar derivados al subir** (`api/formulario/[token]/fotos/route.ts`): guardar
   junto al original una versión web de ~1600 px y una miniatura de ~400 px. La
   galería carga miniaturas, el visor carga la versión web, y el original queda
   intacto para el equipo de diseño. Es la mejora de mayor impacto por unidad de
   esfuerzo.
2. **Usar `next/image`** con una ruta proxy estable. Ojo con un detalle: hoy las URLs
   firmadas se regeneran en cada visita (`page.tsx:76-81`), así que la URL cambia
   siempre y el optimizador de Next nunca acertaría la caché. Hace falta una ruta con
   URL estable (ej. `/api/foto/<invitacionId>/<nombre>`) para que la optimización
   sirva de algo.

**Detalle relacionado:** las URLs firmadas duran 1 hora (`page.tsx:78`). Un invitado
que deje la invitación abierta en una pestaña y vuelva por la tarde verá las fotos
rotas hasta recargar.

---

## 4. 🟠 Las confirmaciones de asistencia se pierden

`src/components/invitacion/base/Piezas.tsx:398-417`: el invitado llena un formulario
precioso (nombre, asiste sí/no, cuántas personas, nota) y el sistema **arma un mensaje
de texto y abre WhatsApp**. Nada se guarda.

Las consecuencias para el cliente:

- Si el invitado no pulsa "enviar" en WhatsApp — se distrae, se le cierra la app,
  no tiene WhatsApp Web en la computadora — **la confirmación desaparece sin rastro**.
  Ni el invitado ni el anfitrión se enteran.
- El anfitrión termina con **150 mensajes sueltos en su chat** y tiene que contar a
  mano cuántos van, para pasarle el número al salón y al catering.
- No hay lista exportable, ni conteo en vivo, ni "quién falta por confirmar".
- El equipo Invifty no puede ayudar: no ve nada.

Y sin embargo la interfaz ya le dice "¡Gracias por confirmar!" (línea 434), lo que
transmite una certeza que el sistema no respalda.

**Esta es la función que más piden los novios y la que más diferencia una invitación
digital de un PDF bonito.** Ahora mismo Invifty entrega el PDF bonito.

**La mejora:** una tabla `confirmaciones` (invitacion_id, nombre, asiste, cantidad,
nota, creado_en), un POST desde el formulario, y una sección en el panel con el
conteo, la lista y exportación a Excel. Seguir abriendo WhatsApp después de guardar
—como confirmación adicional, no como único canal— para no perder el gesto que ya
funciona. Es lo que convierte la confirmación en un dato que el cliente puede usar.

---

## 5. 🟠 El sistema descarta decisiones del cliente en silencio

Aquí hay varios hallazgos concretos que comparten la misma raíz.

### 5.1 Paletas que no existen

El formulario ofrece al cliente la paleta **"Vino & Nude"**
(`config/formularios.ts:99`) para bodas, cumpleaños y otros eventos. Esa paleta
**no existe** en `PALETAS` (`config/diseno.ts:33-154`). Cuando el cliente la elige,
`paletaValida()` (`lib/invitacion.ts:24-26`) la descarta sin avisar y aplica la paleta
por defecto de la plantilla.

El cliente eligió vino y nude. Recibe oro y negro. Nadie se entera hasta que reclama.

Lo mismo pasa con **"Los colores de nuestra marca"** en eventos empresariales
(`formularios.ts:617`): no es un id de paleta, así que se descarta igual — y encima
el cliente subió su logo esperando que se usara.

### 5.2 Las muestras de color mienten

Las muestras que ve el cliente están escritas a mano en el formulario y **no coinciden
con los colores reales** de la paleta:

| Paleta | El cliente ve | Lo que realmente recibe |
|---|---|---|
| Rose Gold & Crema | `#E8B4B8` `#D4AF37` `#FFF7F0` | `#C08A87` `#E4BBB4` `#FFF8F4` |
| Terracota & Beige | `#C1683C` `#E8D5C4` `#7A4A2B` | `#BE6B42` `#DDA07C` `#F7EFE6` |

Son diferencias visibles, no matices. **Arreglo trivial:** derivar las muestras
directamente de `PALETAS` en lugar de duplicarlas a mano. Así nunca vuelven a
divergir, y de paso desaparece el problema 5.1.

### 5.3 Se construyeron 24 paletas y el cliente ve 6

`PALETAS_COMUNES` (`formularios.ts:93-100`) ofrece seis opciones. El sistema tiene
veinticuatro paletas terminadas y probadas — Esmeralda & Oro, Azul Rey & Oro,
Celestial, Malva & Perla, Bosque & Crema… Trabajo ya hecho y pagado que el cliente
nunca llega a ver. Mostrar las paletas apropiadas según el tipo de evento (no las 24
de golpe, que abruma) es puro valor sin código nuevo.

### 5.4 Preguntas cuyas respuestas no llegan a la invitación

Comparando `config/formularios.ts` con `derivarDatosInvitacion()`
(`lib/invitacion.ts:107-235`), estas respuestas se recogen y **nunca se aplican**:

| Pregunta | Qué pasa hoy |
|---|---|
| `ambiente_musical` | Se pregunta el ambiente musical en 3 variantes por evento. No se usa **para nada** — ni siquiera queda anotado para el equipo. |
| `mensaje_recordatorio` | No aparece en la invitación. |
| `preferencias_diseno` | Los deseos de diseño en texto libre del cliente. Solo visibles en el brief. |
| `video_fondo` | Se sube el video y no hay soporte para mostrarlo. |
| `logo_empresa` | Se sube y no se usa en la invitación corporativa. |
| `datos_registro` | Qué datos pedir en el registro. No se aplica al RSVP. |
| `tipo_evento_corp` | Conferencia/gala/lanzamiento no influye en nada. |

Varias sí llegan al brief PDF, así que el diseñador humano puede aplicarlas a mano —
pero entonces la promesa de "generar la invitación automáticamente" es parcial, y el
tiempo de operación es mayor de lo que parece.

El caso de la **música** es el más llamativo: hay un reproductor flotante completo y
bien hecho (`Efectos.tsx:234-283`), se le pregunta al cliente qué ambiente musical
quiere, y `efectos.musica` se genera siempre en `false` con `musicaUrl` vacío
(`invitacion.ts:141,147`). La función existe, el cliente la pidió, y solo se activa
si alguien del equipo se acuerda de subir un audio a mano.

### 5.5 Secciones que nunca se llenan porque no se preguntan

- **Padrinos / corte de honor / damas.** `BloquePadrinos` está implementado
  (`Secciones.tsx:247-276`), pero **solo se llena para eventos empresariales** (desde
  `lista_ponentes`, `invitacion.ts:196-198`). Para bodas y quinceaños —donde padrinos
  y corte de honor son de las secciones más queridas en RD— no existe la pregunta,
  así que la sección está siempre vacía salvo que el equipo la escriba a mano.
- **Hashtag** (`#CamilaYLucas2026`): el campo existe, se renderiza en el pie, y
  siempre se genera vacío. No hay pregunta.
- **Monograma** personalizado: se deriva del título; no se pregunta.

Añadir estas tres preguntas al formulario es media hora de trabajo y llena tres
secciones que ya están construidas.

---

## 6. 🟡 Producto y operación

### 6.1 Nadie sabe cuántas veces se abrió la invitación

No hay registro de visitas. El equipo no puede decirle al cliente *"tu invitación se
abrió 340 veces, la vieron 180 personas distintas"* — que es a la vez un argumento de
venta, una prueba de valor entregado y el mejor gancho para renovar la vigencia.
Una tabla de eventos ligera (o Vercel Analytics) resuelve esto en un día.

### 6.2 La política de vigencias es contradictoria

El propio README lo admite (§5): el sistema aplica **3/3/3/12 meses**
(`planes.ts:21-26`) mientras la página pública anuncia **3/6/9/12**. Un cliente
Premium que pagó esperando 9 meses **se queda sin invitación al tercer mes**. Es un
reclamo garantizado en cuanto pase el tiempo suficiente. Hay que decidir la política y
alinear ambos lados; es un cambio de una línea una vez decidido.

### 6.3 El vencimiento llega sin aviso

Existe la vista `/panel/vencimientos`, pero es pasiva: alguien tiene que entrar a
mirarla. No hay recordatorio automático al equipo ni al cliente. Un aviso a los 15
días es a la vez buen servicio y la oportunidad natural de renovación.

### 6.4 Se vende un extra que el sistema no sabe entregar

`EXTRAS` incluye **"Dominio Web Propio" (RD$ 1,500)** (`planes.ts:38`) y el formulario
pregunta `dominio_deseado`. No hay ningún soporte de dominios personalizados en el
código: las invitaciones viven todas en `/i/<slug>`. Se cobra un extra que hoy solo
puede cumplirse configurando cosas a mano en Vercel, si es que se cumple.

### 6.5 Los enlaces son adivinables y exponen datos sensibles

El slug se deriva del título (`invitacion.ts:29-40`): "Camila & Lucas" →
`camila-y-lucas`. Cualquiera que adivine el slug ve la dirección del evento, la fecha,
las fotos privadas de la pareja y **el número de WhatsApp del anfitrión**. La página
está marcada `noindex`, así que Google no la lista — pero adivinar `boda-maria-y-jose`
no es difícil.

Sugerencia: añadir un sufijo corto aleatorio (`camila-y-lucas-k3f9`). Sigue siendo
bonito de compartir y deja de ser enumerable. Conviene consultarlo con el cliente
antes de cambiarlo en invitaciones ya publicadas.

### 6.6 Detalles del flujo de fotos

- Se pueden **seguir subiendo fotos después de enviar el formulario**: la ruta de
  fotos no comprueba el estado, a diferencia del PATCH de respuestas que sí lo hace
  (`route.ts:68`). El diseñador puede estar trabajando con un set que cambia.
- El comentario dice "los videos cuentan aparte, máx. 1"
  (`fotos/route.ts:46`) pero **ese límite no se aplica en el código**. Se pueden subir
  N videos de 50 MB.
- Premium y Luxury son ilimitados sin tope global: nada impide 200 fotos × 6 MB en un
  solo pedido.
- Las subidas son secuenciales (`Campos.tsx:330`): 15 fotos se suben una tras otra en
  lugar de en paralelo. Desde un celular con 4G, la diferencia es de minutos.

### 6.7 Rendimiento de la página pública

`/i/[slug]` es `force-dynamic` (`page.tsx:9`): cada visita ejecuta una consulta a
Supabase, un `list` del Storage y **una firma de URL por cada foto**. Con 200
invitados abriendo la invitación el mismo día y 15 fotos cada uno, son miles de
llamadas a Supabase para contenido que no cambió. Se puede cachear por unos minutos
sin perder frescura real, y firmar las URLs por más tiempo.

---

## 7. 🔵 Deuda técnica

### 7.1 El lint está roto: 5 errores

`npm run lint` falla. Como consecuencia, nadie puede usar el linter como red de
seguridad — el ruido tapa cualquier error nuevo.

| Archivo | Problema |
|---|---|
| `Campos.tsx:345,402` | Se reasigna la prop `fotos` dentro de `subir()` para acumular resultados. Funciona por accidente; es exactamente el patrón que React 19 prohíbe. Se arregla con una actualización funcional del estado. |
| `Dictado.tsx:114` · `Efectos.tsx:153` · `Piezas.tsx:44` | `setState` síncrono dentro de un efecto. Provoca renders en cascada. |

Ninguno rompe el build (compila y despliega bien), pero los tres del contador y el
observador de scroll se ejecutan **en cada invitación publicada**, en móviles modestos.

### 7.2 Fuentes que bloquean el renderizado

Las fuentes se cargan con `<link>` crudo en `layout.tsx:18-23` y otra vez en el cuerpo
de `/i/[slug]` (`page.tsx:88-90`). El propio linter lo advierte
(`@next/next/no-page-custom-font`). Una invitación con la pareja "Clásica Real" carga
**tres familias de Google Fonts** por CSS externo antes de pintar nada — sobre una
página cuyo primer impacto visual lo es todo. `next/font` las autoaloja y elimina el
salto.

### 7.3 HTML sin escapar en el email de notificación

`notificaciones.ts:59-62` interpola el nombre y el teléfono del cliente directamente
en el HTML del correo. Es un email interno con datos que escribe el propio equipo, así
que el riesgo es bajo — pero un cliente llamado `Joyería Pérez & Hijos` rompe el
formato del correo. Escapar es una función de tres líneas.

### 7.4 Sin tests ni CI

Cero tests y ningún workflow de GitHub Actions. Para un sistema que ya factura y
maneja datos de clientes, unas pocas pruebas sobre `derivarDatosInvitacion()`,
`slugificar()` y los formateadores de fecha atraparían justo el tipo de regresión
silenciosa que describe la sección 5. Un workflow que corra `lint` + `tsc` + `build`
en cada push cuesta veinte minutos de configuración.

### 7.5 Menores

- `schema.sql` contiene la tabla `invitaciones` duplicada al final, sin encabezado de
  sección y sin las líneas de RLS agrupadas — se ve como un pegado apurado. Funciona,
  pero conviene ordenarlo.
- El bucle de colisión de slugs hace hasta 48 consultas secuenciales
  (`acciones-invitacion.ts:46-54`).
- `variante` sin usar en `Secciones.tsx:69` y `_plan` sin usar en `invitacion.ts:112`.

---

## 8. Plan sugerido

**Hoy** — Rotar la clave de Supabase y sacar `.env.local` del historial (§1).

**Semana 1 — Lo que ven los invitados**
1. Open Graph + imagen generada por invitación (§2)
2. Derivados de imagen al subir + `next/image` (§3)
3. Arreglar los 5 errores de lint (§7.1) y `next/font` (§7.2)

**Semana 2 — Lo que el cliente pidió y no recibe**
4. Paletas: derivar muestras de `PALETAS`, eliminar `vino_nude`, ampliar el catálogo
   ofrecido (§5.1-5.3)
5. Preguntas de padrinos, hashtag y monograma (§5.5)
6. Conectar la música: subir audio desde el editor y activar el efecto (§5.4)

**Semana 3 — La función que más piden**
7. RSVP persistente: tabla, guardado, panel con conteo y exportación (§4)
8. Contador de vistas de la invitación (§6.1)

**Semana 4 — Base**
9. Decidir y alinear la política de vigencias (§6.2)
10. Avisos de vencimiento (§6.3)
11. Tests de las funciones de derivación + CI con lint/build (§7.4)

---

## Apéndice — Estado de verificación

Comprobado en este entorno sobre la rama `claude/project-audit-stdqbw`:

| Comprobación | Resultado |
|---|---|
| `npx tsc --noEmit` | ✅ Sin errores |
| `npm run build` | ✅ Compila; 17 rutas |
| `npm run lint` | ❌ 5 errores, 3 avisos |
| `.env.local` en el historial de Git | ❌ Confirmado en `550890b`, rama `main` |
| `vino_nude` presente en `PALETAS` | ❌ No existe |
| Tests | ❌ No hay |
| CI (GitHub Actions) | ❌ No hay |

Los hallazgos de código se verificaron leyendo los archivos citados. Las
recomendaciones de rendimiento (peso de las galerías, latencia en 4G) son estimaciones
basadas en los tamaños típicos de foto de celular y no se midieron contra un despliegue
real — conviene confirmarlas con Lighthouse sobre una invitación publicada antes de
dimensionar el trabajo.
