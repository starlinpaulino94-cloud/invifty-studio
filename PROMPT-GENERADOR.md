# Prompt para generar invitaciones de código propio

El sistema acepta invitaciones hechas fuera de él —normalmente con IA— pegando
su HTML en el editor (plantilla "Código propio"). Este archivo es **el prompt
que se le da a esa IA** para que lo que devuelva funcione a la primera:
con las fotos del cliente, con el RSVP conectado al panel, accesible y ligero.

Sin este prompt, la IA devuelve una página bonita que hay que arreglar a mano:
fotos pegadas con URLs que caducan, un formulario de confirmación que no
guarda nada, música que arranca sola. Cada punto de abajo existe porque
ahorra una de esas correcciones.

**Cómo se usa:** copia todo el bloque de abajo, pégalo en la IA, y al final
añade los datos del evento (tipo, título, fecha, hora, lugar, historia,
textos, cuántas fotos hay). El HTML que devuelva se pega en el editor tal
cual. Los avisos automáticos del editor (`revisarCodigo`) detectan los
descuidos más comunes; si sale alguno, vuelve a la IA con el aviso.

---

```text
Actúa como un equipo formado por: director creativo de eventos, diseñador
editorial, especialista en tipografía, desarrollador frontend y especialista
en accesibilidad.

OBJETIVO
Diseñar una invitación digital de evento como UN SOLO archivo HTML
autocontenido (CSS y JavaScript dentro del propio archivo). Se publicará
dentro de una plataforma que la sirve en un iframe aislado.

PROCESO
1. Valida los datos que te doy. Si falta algo esencial (fecha, hora, lugar),
   NO lo inventes: escribe [CONFIRMAR] en su sitio y dímelo al final.
2. Propón TRES conceptos visuales distintos en pocas líneas cada uno
   (nombre, paleta, tipografía, composición, por qué encaja con el evento).
   Uno clásico y fácil de aprobar, uno más arriesgado, uno editorial.
3. Espera a que yo elija. Después entrega el HTML completo del elegido.

CONTRATO CON LA PLATAFORMA (obligatorio)

Fotos — no pegues URLs de imágenes del evento. Usa estos marcadores, que la
plataforma sustituye por las fotos reales del cliente:
  {{PORTADA}}   la foto principal
  {{FOTO_1}}, {{FOTO_2}}, …   las demás, en orden
  {{TITULO}}    el título del evento
  {{FECHA}}     la fecha en palabras
Ejemplo: <img src="{{PORTADA}}" alt="" width="1200" height="1500">

Confirmación de asistencia — NO hagas tu propio envío (ni fetch, ni
mailto, ni WhatsApp). Pon un formulario así, y la plataforma guarda las
respuestas y se las enseña al anfitrión:

  <form data-invifty-rsvp>
    <input name="nombre" required>            (nombre del invitado)
    …campo o botones que fijen name="asiste" a "si" o "no"…
    <input name="cantidad" type="number">     (personas en total)
    <textarea name="nota"></textarea>         (opcional)
    <button type="submit">Confirmar</button>
    <p data-invifty-mensaje aria-live="polite"></p>  (aquí escribe la
       plataforma el "gracias" o el error; no lo rellenes tú)
  </form>

El RSVP tiene que ser fácil de encontrar: enlázalo desde un botón visible
cerca del inicio.

Recursos externos — solo por https:// y solo si hacen falta (tipografías de
Google Fonts, por ejemplo). Nada de rutas relativas (/foto.jpg, ./estilo.css):
el archivo se sirve aislado y no resuelven. Máximo dos familias tipográficas,
solo los pesos que uses.

RESTRICCIONES DE DISEÑO Y CÓDIGO
- Móvil primero, desde 320 px de ancho. La mayoría lo abrirá desde WhatsApp
  en un teléfono.
- Lo esencial se entiende en segundos y sin leer letra pequeña: qué evento
  es, quién invita, cuándo, dónde, y qué debe hacer el invitado (confirmar).
- HTML semántico (main, section, h1…), texto esencial nunca menor de 16 px,
  áreas táctiles de al menos 44×44 px, contraste AA, foco visible al navegar
  con teclado, alt en las imágenes.
- Declara width y height en las imágenes para que la página no salte al
  cargar. La portada carga primero (fetchpriority="high"); lo de más abajo,
  con loading="lazy".
- Toda animación debe respetar prefers-reduced-motion: con movimiento
  reducido, sustituye parallax, zooms y bucles por contenido quieto. La
  información nunca puede depender de una animación.
- Si hay música, NUNCA arranca sola: botón visible con play/pausa,
  aria-pressed y aria-label. El navegador la bloquearía igualmente.
- Nada de innerHTML con textos del evento; escríbelos directamente en el
  HTML como contenido.
- No añadas referencias religiosas, padrinos, patrocinadores ni frases
  hechas que no estén en los datos que te doy.
- No incluyas contadores regresivos que dependan de un servidor: calcula en
  el navegador con la fecha del evento.
- Peso: el archivo HTML solo (sin las fotos) por debajo de 120 KB. Sin
  librerías externas de JavaScript; lo que necesites, escríbelo.

AL ENTREGAR EL HTML, añade una lista breve de:
- los [CONFIRMAR] pendientes;
- qué marcadores de foto usaste y cuántas fotos hacen falta;
- qué habría que probar a mano (RSVP, botones, teléfono real).
```

---

## Lo que la plataforma pone sola (no hay que pedírselo a la IA)

| Cosa | Quién la pone |
|---|---|
| `noindex`, vista al compartir, título de pestaña | La página que envuelve el iframe |
| Contador de visitas | `RegistroVisita`, fuera del iframe |
| Guardado de confirmaciones y panel del anfitrión | El puente RSVP (`lib/codigo.ts`) |
| Sustitución de marcadores por fotos firmadas | `aplicarMarcadores` al servir |
| Aislamiento de seguridad del código | El `sandbox` del iframe |

## Por qué el prompt insiste en cada cosa

- **Marcadores y no URLs**: las direcciones de las fotos van firmadas y
  caducan. Una URL pegada a mano funciona hoy y aparece rota en dos semanas.
- **El formulario `data-invifty-rsvp`**: es la única manera de que las
  confirmaciones lleguen al panel y al anfitrión. Un RSVP "bonito" que manda
  un WhatsApp se pierde en cuanto el invitado no pulsa enviar.
- **Sin rutas relativas**: el iframe tiene origen opaco; `/foto.jpg` no
  apunta a ningún sitio. El editor avisa de esto al pegar.
- **Accesibilidad y movimiento reducido**: los mismos requisitos que cumplen
  las plantillas de la casa. Que la invitación sea de fuera no se nota en eso.
