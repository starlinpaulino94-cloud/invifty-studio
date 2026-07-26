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
| **1B** | Vista previa en vivo dentro del editor, sin guardar ni recargar | ⏳ |
| **1C** | Clic en la vista previa → salta al campo que lo controla | ⏳ |
| **1D** | Edición literal encima del diseño | 🤔 Decidir después de 1B/1C |

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

---

## Idea 2 — Invitaciones con código propio (IA)

> *"Hay invitaciones que puede ser que las haga con IA, quiero un módulo donde
> subir los códigos de esa invitación y visualizarla dentro del sistema."*

| | Qué | Estado |
|---|---|---|
| **2A** | Plantilla tipo "código": pegar el HTML y guardarlo | ⏳ |
| **2B** | Servirla en `/i/<slug>` dentro de un iframe aislado | ⏳ |
| **2C** | Mantener vista previa al compartir, contador de visitas y borrador/publicada | ⏳ |
| **2D** | Puente para que el RSVP del sistema funcione dentro de ese HTML | ⏳ |

**El aislamiento de 2B no es opcional.** Código pegado corriendo en el mismo
origen que `/panel` podría leer la sesión del equipo. En un iframe con
`sandbox` sin `allow-same-origin` no puede tocar cookies ni la página padre.
Por eso 2D es un paso aparte: el RSVP tendrá que comunicarse por `postMessage`
en vez de llamar a la API directamente.

---

## Idea 3 — Variedad y nivel de ornamentación

> *"Las invitaciones actuales están muy lindas y limpias y me gustan, pero
> también quiero invitaciones extravagantes, con arreglos florales… y que en el
> formulario el cliente pueda decidir."*

| | Qué | Estado |
|---|---|---|
| **3A** | Eje de ornamentación: sobrio / equilibrado / extravagante | ⏳ |
| **3B** | Familia nueva de ornamentos: florales, guirnaldas, marcos botánicos | ⏳ |
| **3C** | 2-3 plantillas nuevas realmente recargadas | ⏳ |
| **3D** | Pregunta en el formulario para que el cliente elija cuánto adorno | ⏳ |

**Lo que ya existe no cambia.** El nivel por defecto será exactamente el look
actual, porque es el que gusta. La ornamentación se suma encima, no sustituye.

---

## Orden de trabajo

**1A → 1B+1C → 2 → 3.** Cada paso hace el siguiente más fácil: con la vista
previa en vivo, iterar las plantillas extravagantes (3C) es mucho más rápido
que a ciegas.
