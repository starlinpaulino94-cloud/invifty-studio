# El pipeline creativo con IA

## La arquitectura en una frase

**La IA nunca genera HTML: elige dentro del sistema de diseño.** Propone
tres conceptos —plantilla, paleta, tipografía, densidad y textos cortos del
catálogo real— y el renderizador determinista de siempre los dibuja. Un
concepto malo es feo; nunca roto, nunca inseguro.

```text
Datos reales (pedido + invitación)
→ Brief derivado (ia/brief.ts — determinista, sin datos de contacto)
→ Proveedor propone 3 conceptos (mock o Claude, según IA_PROVEEDOR)
→ Aduana (ia/esquema.ts — catálogo real, datos factuales vetados)
→ Huella visual (ia/huella.ts — avisa si dos conceptos son casi iguales)
→ Registro en `generaciones` (válido o fallido, con tokens y costo)
→ El equipo APLICA en el editor (ia/aplicar.ts — estado local, vista previa)
→ Guardar cambios (el botón de siempre, con permisos y auditoría)
```

## Las dos promesas (probadas en `pruebas/ia.prueba.ts`)

1. **Solo catálogo real.** Una plantilla, paleta o tipografía alucinada se
   rechaza con registro — nunca se corrige a escondidas, porque eso
   disfrazaría a un proveedor que alucina. Añadir una paleta nueva a
   `config/diseno.ts` la hace elegible sola: la validación y los enums del
   prompt se construyen del catálogo en cada llamada.
2. **Datos factuales intocables.** Fecha, hora, lugares, teléfono, fecha
   límite, regalos: no viajan en el brief, un concepto que los mencione se
   rechaza entero, y `aplicarConcepto` es una lista blanca que no puede
   escribirlos. La historia del cliente tampoco se genera: es suya.

## Los proveedores

| `IA_PROVEEDOR` | Quién propone | Coste |
|---|---|---|
| *(vacío)* o `mock` | Generador local determinista (`ia/mock.ts`): tres arquetipos por tipo de evento (seguro / distintivo / editorial) con combos reales del catálogo. Regenerar rota combinaciones. | 0 |
| `anthropic` | Claude (`claude-opus-5`) con **salida estructurada** (`output_config.format` + enums del catálogo), timeout de 120 s, reintentos del SDK y manejo del `stop_reason: refusal`. Exige `IA_API_KEY`; sin ella cae a mock con nota en el log. | ~$5/M entrada · $25/M salida (estimación por generación en el registro) |
| `off` | Nadie: el botón lo dice en vez de fingir. | 0 |

**Para activar el proveedor real:** crear una clave en console.anthropic.com,
ponerla en Vercel como `IA_API_KEY` + `IA_PROVEEDOR=anthropic`, y redeploy.
Nada más cambia: el resto del pipeline ya está rodado en mock.

## El registro (`generaciones`)

Cada generación —válida o fallida— deja fila: proveedor, modelo, versión de
prompt (`PROMPT_VERSION` en `ia/anthropic.ts`; cámbiala al editar el
prompt), hash del brief, intento, resultado, tokens, costo estimado,
latencia y quién pidió. Responde a "¿cuánto llevamos gastado?", "¿qué
prompt produjo esto?" y "¿el proveedor está alucinando?". No se guardan
cadenas de razonamiento ni claves.

## Cómo se usa (equipo)

En el editor de la invitación, tarjeta **"Conceptos con IA"** (no aparece
en invitaciones de código propio): *Proponer 3 conceptos* → cada tarjeta
enseña la paleta, la idea y el riesgo honesto → **Aplicar** (todo), **Estilo**
(solo plantilla/paleta/tipografía) o **Textos** (solo subtítulo/frase/
despedida). Todo cambia el **estado local**: la vista previa en vivo es el
antes-y-después, y nada llega a la base hasta *Guardar cambios*. Deshacer
es no guardar. *Proponer otros tres* sube el intento y trae combinaciones
nuevas.

## Qué queda pendiente (honesto)

- **Auditoría visual automatizada** (capturas multi-viewport, detección de
  overflow/contraste): requiere navegador headless en infraestructura que
  Vercel serverless no da gratis. Hoy la vista previa en vivo + el checklist
  de publicación cumplen ese papel a mano.
- **Generación de historia/copy largo con IA real**: el copy se limita a
  subtítulo, frase y despedida. La historia de la pareja solo debe
  generarse desde las respuestas del formulario del cliente, con revisión —
  entra cuando el proveedor real esté activo y probado.
- **Comparación contra invitaciones recientes y demos** (huella global):
  la huella hoy compara dentro de la tanda; compararla contra lo ya
  publicado necesita histórico de huellas.
