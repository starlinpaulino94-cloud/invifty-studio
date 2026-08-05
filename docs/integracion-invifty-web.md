# Integración Invifty Web ↔ Studio

Studio es la fuente de verdad; la web consume. Tres endpoints públicos, sin
clave (una clave dentro del JavaScript público dejaría de ser secreta en el
primer F12; las defensas reales son CORS, validación, honeypot y freno).

**CORS:** solo `https://invifty.com`, `https://www.invifty.com`, el propio
Studio y `localhost` en desarrollo. Otro origen no recibe cabeceras y el
navegador bloquea solo. Para añadir un dominio: `src/lib/cors-publico.ts`.

---

## 1. Catálogo — `GET /api/public/catalog`

Planes, precios y capacidades **reales**. La web deja de llevar precios
copiados: se editan en `src/lib/planes.ts` (CATALOGO) y al desplegar los ve
todo el mundo.

```jsonc
{
  "actualizado": "2026-08-05",
  "moneda": "DOP",
  "planes": [
    {
      "id": "popular",
      "nombre": "Popular",
      "descripcion": "La invitación completa, con confirmaciones y fotos.",
      "precioDOP": 2500,
      "vigenciaMeses": 6,
      "limiteFotos": 15,            // null = sin límite
      "capacidades": [ { "id": "rsvp", "nombre": "Confirmación de asistencia en línea" } ],
      "disponible": true
    }
  ],
  "extras": [ { "id": "dominio_propio", "nombre": "Dominio Web Propio", "precioDOP": 1500 } ]
}
```

Reglas que la web puede dar por hechas (probadas en `pruebas/publico.prueba.ts`):

- **Solo sale lo que existe.** Lo vendido-pero-no-implementado (hoy: QR
  individual, recordatorios, galería post-evento) NO viene. Si la web lo
  anuncia por su cuenta, esa brecha es suya.
- `revisiones` solo aparece cuando la decisión comercial esté tomada.
- Caché de 5 min + `ETag` (manda `If-None-Match` y recibe 304).

## 2. Demos — `GET /api/public/demos`

Las invitaciones que el equipo marcó en `/panel/demos`. Solo publicadas y
activas.

```jsonc
{
  "demos": [
    {
      "titulo": "Camila & Lucas",
      "slug": "camila-lucas-x7",
      "url": "https://studio.invifty.com/i/camila-lucas-x7",
      "tipoEvento": "boda",
      "estilo": "Editorial Luxe",
      "planMinimo": "popular",
      "orden": 1,
      "destacada": true,
      "idioma": "es",
      "portada": "https://studio.invifty.com/api/public/demos/camila-lucas-x7/portada"
    }
  ]
}
```

`portada` es una URL **estable** que redirige a la miniatura firmada del
momento (las fotos viven en un bucket privado y sus firmas caducan): úsala
directa en `<img src>`. Solo funciona para demos activas — no sirve para
sacar fotos de otras invitaciones.

## 3. Leads — `POST /api/public/leads`

El formulario de contacto de la web. `Content-Type: application/json`:

```jsonc
{
  "nombre": "María Pérez",            // obligatorio, 2–100
  "telefono": "809-269-3214",         // obligatorio; se normaliza (será 18092693214)
  "tipo_evento": "boda",              // obligatorio
  "fecha_evento": "2026-12-12",       // opcional, YYYY-MM-DD
  "plan_id": "popular",               // opcional; debe existir en el catálogo
  "demo_slug": "camila-lucas-x7",     // opcional: desde qué demo llegó
  "mensaje": "Queremos algo elegante",// opcional, ≤1000
  "idioma": "es",                     // "es" | "en"
  "fuente": "web",                    // texto libre corto
  "utm": { "source": "instagram", "campaign": "bodas26" }, // solo las 5 llaves estándar
  "consentimiento": true,             // obligatorio true — sin él, 400
  "clave_idempotencia": "<uuid>",     // obligatorio, 16–64 [A-Za-z0-9_-]
  "web": ""                           // HONEYPOT: campo oculto, SIEMPRE vacío
}
```

Lo que la web debe implementar:

- **`clave_idempotencia`**: genera `crypto.randomUUID()` UNA vez al montar
  el formulario (no por clic). El doble clic reenvía la misma clave y
  Studio lo hace un solo lead — respuesta `{ok:true}` igual.
- **`web`** (honeypot): un input invisible (`display:none`, sin autocomplete).
  Los humanos no lo ven; el bot que lo rellene recibe `{ok:true}` y su
  envío va a la basura.
- **`consentimiento`**: casilla real junto al aviso de contacto, no marcada
  por defecto.

Respuestas: `201 {ok:true}` · `200 {ok:true}` (duplicado/honeypot) ·
`400 {error}` con mensaje mostrable · `429` con `Retry-After` (freno:
10 envíos / 10 min por IP).

## Después del envío

El lead aparece en `/panel/leads` con su embudo (nuevo → contactado →
calificado → convertido/perdido). "Convertir en cliente" crea o reutiliza
el cliente por teléfono y deja el rastro; el pedido se crea aparte, con
decisión del equipo — ningún pedido nace solo.

## Para probar en local

```bash
curl -s http://localhost:3000/api/public/catalog | head -c 400

curl -s -X POST http://localhost:3000/api/public/leads \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Prueba Web","telefono":"8092693214","tipo_evento":"boda",
       "consentimiento":true,"clave_idempotencia":"'"$(uuidgen | tr -d -)"'"}'
```
