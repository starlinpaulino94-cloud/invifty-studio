# Créditos de las fotos de muestra

Las 25 fotos de `public/muestra/` son las que enseñan las plantillas del
catálogo interno (`/muestra/<plantilla>`, requiere sesión del equipo).
Las subió el propietario y aquí queda de dónde vino cada una, porque una
foto sin procedencia es un problema legal esperando fecha.

**Dónde se usan**: solo en las muestras internas del panel. Las demos
públicas y las invitaciones reales usan SIEMPRE las fotos que sube cada
cliente.

## Con licencia verificada — Pixabay (uso comercial libre, sin atribución)

El nombre original sigue el patrón `autor-tema-id_1920.jpg` de Pixabay
([licencia de contenido de Pixabay](https://pixabay.com/service/license-summary/)).

| Archivo | Original |
|---|---|
| `boda-1-novios.webp` | `8090666-wedding-4226892_1920.jpg` |
| `boda-2-preboda.webp` | `artawkrn-couple-5974974_1920.jpg` |
| `boda-3-anillos.webp` | `betsisman-wedding-ring-1236640_1920.jpg` |
| `boda-4-brindis.webp` | `bairyna-glasses-3689645_1920.jpg` |
| `boda-5-ramo.webp` | `ngdphotoworks-wedding-634526_1920.jpg` |
| `boda-6-sesion.webp` | `rojurnalist-gaba-1874654_1920.jpg` |
| `boda-7-ceremonia.webp` | `afrimedialive-bride-5427659_1920.jpg` |
| `quince-6-celebracion.webp` | `omarmedinafilms-party-1146996_1920.jpg` |
| `baby-3-recien-nacido.webp` | `bongbabyhousevn-newborn-6569397_1920.jpg` |

## Origen no verificado — revisar o reemplazar cuando se pueda

Estas las subió el propietario sin nota de procedencia (nombres tipo
Pinterest). Mientras vivan solo en el catálogo interno el riesgo es
bajo, pero **no deben usarse en la web pública ni en material de
marketing** sin confirmar su licencia. Lo ideal: irlas sustituyendo por
fotos de eventos reales de Invifty (con permiso del cliente) o por
equivalentes de Pixabay/Pexels.

| Archivo | Original |
|---|---|
| `quince-1-quinceanera.webp` | `11962755257614486.jpg` |
| `quince-2-vestido.webp` | `Red glitter tulle quinceanera dress… RQ2215.jpg` |
| `quince-3-corona.webp` | `Quinceanera hairstyle.jpg` |
| `quince-4-espejo.webp` | `7318418142309374.jpg` |
| `quince-5-jardin.webp` | `Customized Lavender Lilac Quinceanera Dress….jpg` |
| `empresa-1-gala.webp` | `6966574420855880.jpg` |
| `empresa-2-conferencia.webp` | `Eventos MICE Barcelona - Corporate Meetings.jpg` |
| `empresa-3-networking.webp` | `Como Organizar uma Festa de Confraternização….jpg` |
| `empresa-4-vistas.webp` | `TwistedTree Limited.jpg` |
| `empresa-5-mesa.webp` | `Decoración y coordinación de boda elegante….jpg` |
| `empresa-6-escenario.webp` | `Corporate Event Ideas.jpg` |
| `baby-1-ositos.webp` | `Teddy Bear Baby Shower Theme.jpg` |
| `baby-2-mama.webp` | `141159769567426060.jpg` |
| `baby-4-mesa-dulce.webp` | `422281212967277.jpg` |
| `baby-5-globos.webp` | `8725793026051969.jpg` |
| `baby-6-fiesta.webp` | `161918549097335741.jpg` |

## Cómo se procesaron

Recorte a 3:4 (900×1200, recorte automático por zona de interés) y
conversión a WebP calidad 80 — 2.4 MB los 25 archivos, contra 27 MB de
los originales. Los originales sin usar se retiraron de `public/` (nada
que no se enseñe debe viajar en cada deploy); siguen recuperables en el
historial de git si hacen falta.

## Cómo cambiar una foto

1. Pon la nueva en `public/muestra/` con el MISMO nombre (`.webp`,
   idealmente 900×1200) — o con nombre nuevo y ajusta la lista en
   `src/config/muestra.ts` (`FOTOS_POR_EVENTO`).
2. Anótala en este archivo con su procedencia.
