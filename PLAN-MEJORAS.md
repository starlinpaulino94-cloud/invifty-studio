# Plan de mejoras — control, código propio y variedad

Tres ideas planteadas por el equipo, desglosadas en partes implementables.
Se marcan aquí a medida que se cierran.

---

## Idea 1 — Control total desde la vista previa

> *"Quiero poder editar desde la vista previa todo en la invitación, por si
> quiero cambiar algo o mover una imagen de lugar o intercambiarla por otra."*

| | Qué | Estado |
|---|---|---|
| **1A** | Elegir portada, reordenar y ocultar fotos | ✅ Hecho |
| **1B** | Vista previa en vivo dentro del editor, sin guardar ni recargar | ✅ Hecho |
| **1C** | Clic en la vista previa → salta al campo que lo controla | ✅ Hecho |
| **1D** | Edición literal encima del diseño | 🤔 Decidir ahora, ya con 1B y 1C funcionando |

**Sobre 1D.** La edición inline real hay que cablearla en cada una de las diez
plantillas, y en cada plantilla nueva que se haga: es coste permanente, no una
vez. 1B + 1C dan casi todo ese control a una fracción del coste — se ve el
cambio al instante y se llega al campo con un clic. Conviene decidir 1D con
1B/1C ya funcionando, no antes.

### ✅ 1A — Portada, orden y fotos ocultas

**El problema era peor de lo que parecía.** Las diez plantillas usan `fotos[0]`
como portada, y las fotos llegaban del Storage ordenadas por nombre de archivo
— que es un UUID aleatorio. **La portada de cada invitación salía al azar** y
nadie podía cambiarla.

- `ordenFotos` y `fotosOcultas` en los datos de la invitación.
- Panel **"Fotos, portada y orden"** en el editor: marcar portada, mover con
  flechas, ocultar y recuperar.
- Botones en vez de arrastrar: funciona igual en el celular, es accesible con
  teclado y no añade dependencias.
- Una foto que el cliente suba después **no descoloca** lo ya ordenado: va al
  final.
- Ocultar la portada asciende a la siguiente; una invitación nunca se queda sin
  portada.
- 9 pruebas, incluidas las de orden con fotos ya borradas y ocultarlas todas.

### ✅ 1B — Vista previa en vivo

El editor pasa a dos columnas en pantallas anchas: el formulario a la izquierda
y la invitación real a la derecha, fija al hacer scroll y actualizándose
mientras escribes. Se acabó el guardar → abrir pestaña → mirar → volver.

Tres cosas hubo que resolver para que la vista previa sea **fiel** y no una
aproximación:

- **Los elementos con `position: fixed`** —el sobre lacrado, la textura de
  papel, la viñeta, el botón de música— habrían tapado todo el panel. El
  `transform: scale` del marco los obliga a posicionarse contra el marco, que
  es justo lo que hace falta.
- **La portada mide `100dvh`** en las diez plantillas, o sea el alto de la
  pantalla: dentro de un marco pequeño se salía. Unas reglas acotadas a
  `.vista-previa` la miden contra el alto del marco.
- **Las fuentes reales** se cargan según la pareja tipográfica elegida. Sin
  eso se estaría eligiendo la tipografía sin verla.

Además: marco de celular y de computadora, botón para volver a ver la apertura
del sobre, y el orden de las fotos se aplica en vivo — cambiar la portada en el
panel de 1A se ve al instante.

**Las confirmaciones enviadas desde la vista previa no se guardan**: el marco la
declara borrador, igual que la vista previa pública.

Verificado con capturas reales del navegador: sobre cerrado, invitación abierta,
desplazamiento dentro del marco y vista de escritorio. Nada se escapa al panel y
la portada encaja exacta.

### ✅ 1C — Señalar en la vista previa

Un botón de puntero enciende el **modo señalar**: al pasar por encima se marca
el bloque, y al tocarlo el editor se desplaza a la tarjeta que lo controla y la
resalta un par de segundos.

Mientras está encendido, el clic **no activa lo que hay debajo** — no se abre el
sobre, ni un mapa, ni se envía una confirmación. Por eso es un modo y no el
comportamiento normal: la vista previa sigue siendo usable como invitación real
cuando el modo está apagado.

**Cómo cubre las diez plantillas con un solo archivo.** Los bloques del cuerpo se
marcan en `Secciones.tsx`, que todas las plantillas comparten. Lo que no está
marcado es la portada, que es justo la parte que cada plantilla compone a su
manera: cualquier clic fuera de un bloque marcado lleva a la tarjeta "Portada".
Así una plantilla nueva funciona sin tocar nada.

Verificado con el navegador: se marcan los once bloques (portada, historia,
lugares, código de vestimenta, programa, personas especiales, galería, regalos,
avisos, confirmación y cierre), y señalar la historia desplaza el editor y
resalta su tarjeta.

---

## Idea 2 — Invitaciones con código propio (IA)

> *"Hay invitaciones que puede ser que las haga con IA, quiero un módulo donde
> subir los códigos de esa invitación y visualizarla dentro del sistema."*

| | Qué | Estado |
|---|---|---|
| **2A** | Plantilla tipo "código": pegar el HTML y guardarlo | ✅ Hecho |
| **2B** | Servirla en `/i/<slug>` dentro de un iframe aislado | ✅ Hecho |
| **2C** | Mantener vista previa al compartir, contador de visitas y borrador/publicada | ✅ Hecho |
| **2D** | Puente para que el RSVP del sistema funcione dentro de ese HTML | ⏳ |

**El aislamiento de 2B no es opcional.** Código pegado corriendo en el mismo
origen que `/panel` podría leer la sesión del equipo. En un iframe con
`sandbox` sin `allow-same-origin` no puede tocar cookies ni la página padre.
Por eso 2D es un paso aparte: el RSVP tendrá que comunicarse por `postMessage`
en vez de llamar a la API directamente.

### ✅ 2A, 2B y 2C — Módulo de código propio

En el editor aparece una opción **"Código propio"** junto a las diez plantillas.
Al elegirla se muestra un campo para pegar el HTML, y las tarjetas de diseño y
de contenido se ocultan porque ya no aplican. La tarjeta **Portada** se queda:
de ahí salen el título y la fecha de la vista previa al compartir, y la
dirección web.

Se administra igual que cualquier otra invitación: misma dirección, misma
tarjeta al compartir por WhatsApp, mismo contador de visitas, mismo
borrador/publicada y mismo vencimiento. La vista previa en vivo del editor
también la muestra.

**Marcadores** para no pegar a mano direcciones de fotos que además caducan:
`{{PORTADA}}`, `{{FOTO_1}}`, `{{TITULO}}`, `{{FECHA}}`. Un marcador de foto que
no existe se sustituye por vacío en vez de quedarse escrito — es preferible una
imagen que no carga a que el invitado lea `{{FOTO_7}}` en su invitación.

**Revisión antes de publicar:** el editor avisa de rutas relativas (que no
resuelven dentro del iframe), recursos por `http://` sin cifrar, y de imágenes
sin marcador por si se olvidó usar las fotos del cliente. Son avisos, no
bloqueos.

#### El aislamiento, comprobado

Se pegó una invitación con un script que **intenta** salirse, y se cargó la
página con una cookie de sesión falsa. El resultado dentro del iframe:

```
cookies: BLOQUEADO · localStorage: BLOQUEADO · origen: OPACO · panel: BLOQUEADO
```

La invitación se veía completa y con los marcadores sustituidos, pero el script
no pudo leer nada. Hay además una prueba que falla si alguien añade
`allow-same-origin` al sandbox, que es el único cambio capaz de tirar abajo esa
frontera.

**Por eso no se filtra ni se limpia el HTML:** el aislamiento es la frontera de
seguridad, y limpiarlo solo rompería código legítimo.

---

## Idea 3 — Variedad y nivel de ornamentación

> *"Las invitaciones actuales están muy lindas y limpias y me gustan, pero
> también quiero invitaciones extravagantes, con arreglos florales… y que en el
> formulario el cliente pueda decidir."*

| | Qué | Estado |
|---|---|---|
| **3A** | Eje de ornamentación: sobrio / equilibrado / extravagante | ✅ Hecho |
| **3B** | Familia nueva de ornamentos: florales, guirnaldas, marcos botánicos | ✅ Hecho |
| **3C** | 2-3 plantillas nuevas realmente recargadas | ⏳ |
| **3D** | Pregunta en el formulario para que el cliente elija cuánto adorno | ✅ Hecho |

**Lo que ya existe no cambia.** El nivel por defecto es exactamente el aspecto
actual, porque es el que gusta. La ornamentación se suma encima, no sustituye.

### ✅ 3A, 3B y 3D — El eje de ornamentación

Un eje nuevo, **aparte de la plantilla**: la misma Editorial puede salir limpia
o cargada de flores. Tres niveles:

| Nivel | Qué hace |
|---|---|
| **Sobrio** | Sin filigranas, sin textura de papel, sin iconos en círculo. Solo tipografía y aire |
| **Equilibrado** | El aspecto de siempre — **valor por defecto** |
| **Extravagante** | Ramos en las cuatro esquinas, ramas laterales, follaje de fondo, guirnaldas coronando cada título y separadores florales |

**Ninguna invitación existente cambia.** El nivel por defecto es "equilibrado",
y hay una prueba que lo fija con un mensaje explícito, porque tocar ese valor
cambiaría el aspecto de todas las invitaciones ya publicadas.

**Cómo alcanza a las diez plantillas sin tocarlas.** La capa ornamental vive en
`Marco`, que todas envuelven, y los adornos de los títulos en `TituloSeccion`,
que todas usan. Una plantilla nueva hereda los tres niveles sin escribir nada.

**Los ornamentos** (`OrnamentosFlorales.tsx`) son SVG dibujados a mano, sin
dependencias, y heredan el color del acento: funcionan con las 25 paletas. Van
detrás del contenido y con opacidad baja — eso es lo que separa una invitación
recargada de una recargada e ilegible.

**El cliente lo elige** en su formulario, con las opciones construidas desde el
mismo catálogo que aplica el sistema, así que no pueden separarse. La pregunta
no aparece en eventos corporativos: ahí el diseño lo marca la identidad de la
empresa.

Verificado con capturas de los tres niveles: el extravagante enmarca sin tapar
el texto, y el equilibrado sale **idéntico** al de siempre.

---

## Orden de trabajo

**1A → 1B+1C → 2 → 3.** Cada paso hace el siguiente más fácil: con la vista
previa en vivo, iterar las plantillas extravagantes (3C) es mucho más rápido
que a ciegas.
