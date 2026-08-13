/**
 * LAS ESCENAS DE MUESTRA — arte por tipo de evento
 * =================================================
 * Las plantillas del catálogo se enseñan con "fotos" acordes a su
 * evento: los novios y la preboda en una boda, la corona y el vestido en
 * unos quince, el skyline en un evento de empresa, el cochecito en un
 * baby shower. Son ILUSTRACIONES vectoriales dibujadas aquí — no fotos
 * de archivo — por tres razones:
 *
 *  1. Sin licencias ni fotos de personas reales en el repositorio.
 *  2. Sin red: data-URIs que cargan siempre, también en local.
 *  3. Cada set toma el TONO de su plantilla, así la muestra se ve de
 *     una pieza en las doce.
 *
 * El estilo es silueta editorial con acentos dorados: suficientemente
 * abstracto para no competir con las fotos reales del cliente, y
 * suficientemente evocador para que la plantilla cuente su historia.
 */

export type EscenaEvento = "boda" | "quince" | "empresarial" | "baby";

const TINTA = "#2e2a24";
const ORO = "#d9bd7f";
const CREMA = "#f6efdf";

/** Envuelve un motivo en el lienzo 900×1200: fondo, viñeta y marco fino. */
function lienzo(tono: string, motivo: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200" viewBox="0 0 900 1200">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0.6" y2="1">
      <stop offset="0%" stop-color="${CREMA}"/>
      <stop offset="60%" stop-color="${tono}" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="${tono}"/>
    </linearGradient>
    <filter id="b"><feGaussianBlur stdDeviation="30"/></filter>
  </defs>
  <rect width="900" height="1200" fill="url(#g)"/>
  <g filter="url(#b)" opacity="0.4">
    <circle cx="230" cy="300" r="170" fill="#ffffff" opacity="0.5"/>
    <circle cx="700" cy="900" r="220" fill="${TINTA}" opacity="0.25"/>
  </g>
  <rect x="46" y="46" width="808" height="1108" fill="none" stroke="${CREMA}" stroke-width="2" opacity="0.7"/>
  <rect x="60" y="60" width="780" height="1080" fill="none" stroke="${ORO}" stroke-width="1.5" opacity="0.8"/>
  ${motivo}
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/* ---------- Piezas compartidas ---------- */

/** Destellos dorados alrededor del motivo. */
const destellos = `
  <g fill="${ORO}">
    <path d="M250 260 l7 22 22 7 -22 7 -7 22 -7-22 -22-7 22-7z"/>
    <path d="M660 320 l5 16 16 5 -16 5 -5 16 -5-16 -16-5 16-5z" opacity="0.8"/>
    <path d="M620 850 l6 18 18 6 -18 6 -6 18 -6-18 -18-6 18-6z" opacity="0.7"/>
  </g>`;

/* ============================================================
   BODA — los novios y su historia
   ============================================================ */

const novios = `
  <g>
    <!-- Él -->
    <circle cx="375" cy="430" r="52" fill="${TINTA}"/>
    <path d="M310 640 q10 -130 65 -130 q55 0 65 130 l-8 340 h-40 l-12 -250 -12 250 h-40 z" fill="${TINTA}"/>
    <!-- Ella: velo, cabeza y vestido -->
    <path d="M525 400 q-65 30 -55 160 l110 0 q10 -130 -55 -160z" fill="${CREMA}" opacity="0.85"/>
    <circle cx="525" cy="430" r="48" fill="${TINTA}"/>
    <path d="M525 500 q45 5 55 110 q45 180 30 370 h-170 q-15 -190 30 -370 q10 -105 55 -110z" fill="${TINTA}"/>
    <!-- Manos unidas y ramo -->
    <path d="M436 700 q14 -12 28 0" stroke="${TINTA}" stroke-width="16" fill="none" stroke-linecap="round"/>
    <circle cx="450" cy="712" r="26" fill="${ORO}"/>
    <circle cx="432" cy="700" r="12" fill="${CREMA}"/>
    <circle cx="468" cy="700" r="12" fill="${CREMA}"/>
    <circle cx="450" cy="690" r="12" fill="${CREMA}"/>
  </g>
  ${destellos}`;

const propuesta = `
  <g>
    <!-- Él, con una rodilla en tierra: torso, muslo horizontal y pierna de apoyo -->
    <circle cx="358" cy="540" r="44" fill="${TINTA}"/>
    <path d="M322 596 q36 -16 72 0 l0 130 -72 0z" fill="${TINTA}"/>
    <rect x="322" y="726" width="36" height="124" fill="${TINTA}"/>
    <rect x="358" y="712" width="100" height="36" fill="${TINTA}"/>
    <rect x="424" y="748" width="34" height="102" fill="${TINTA}"/>
    <!-- El brazo extendido y el ANILLO, protagonista -->
    <path d="M394 620 q70 -8 108 26" stroke="${TINTA}" stroke-width="18" fill="none" stroke-linecap="round"/>
    <circle cx="530" cy="656" r="24" fill="none" stroke="${ORO}" stroke-width="11"/>
    <path d="M530 622 l13 -20 -13 -13 -13 13z" fill="${CREMA}" stroke="${TINTA}" stroke-width="5"/>
    <!-- Ella, de pie -->
    <circle cx="620" cy="452" r="42" fill="${TINTA}"/>
    <path d="M620 508 q38 5 46 92 q38 152 24 250 h-140 q-14 -98 24 -250 q8 -87 46 -92z" fill="${TINTA}"/>
    <line x1="290" y1="850" x2="700" y2="850" stroke="${TINTA}" stroke-width="8" opacity="0.5"/>
    <!-- Corazones -->
    <path d="M460 330 c0 -26 36 -26 36 0 c0 16 -18 23 -18 36 c0 -13 -18 -20 -18 -36z" fill="${ORO}"/>
    <path d="M545 280 c0 -18 25 -18 25 0 c0 11 -12.5 16 -12.5 25 c0 -9 -12.5 -14 -12.5 -25z" fill="${ORO}" opacity="0.8"/>
  </g>`;

const anillos = `
  <g stroke="${ORO}" stroke-width="26" fill="none">
    <circle cx="380" cy="620" r="130"/>
    <circle cx="530" cy="620" r="130" stroke="${TINTA}"/>
  </g>
  <path d="M380 452 l34 -50 -34 -34 -34 34z" fill="${CREMA}" stroke="${TINTA}" stroke-width="8"/>
  ${destellos}`;

const brindis = `
  <g>
    <g transform="rotate(-14 380 640)">
      <path d="M338 480 h84 q0 110 -42 124 q-42 -14 -42 -124z" fill="${TINTA}"/>
      <rect x="373" y="604" width="14" height="150" fill="${TINTA}"/>
      <path d="M330 754 h100 q8 0 8 14 l0 8 -116 0 0 -8 q0 -14 8 -14z" fill="${TINTA}"/>
    </g>
    <g transform="rotate(14 520 640)">
      <path d="M478 480 h84 q0 110 -42 124 q-42 -14 -42 -124z" fill="${TINTA}"/>
      <rect x="513" y="604" width="14" height="150" fill="${TINTA}"/>
      <path d="M470 754 h100 q8 0 8 14 l0 8 -116 0 0 -8 q0 -14 8 -14z" fill="${TINTA}"/>
    </g>
    <g fill="${ORO}">
      <circle cx="430" cy="420" r="9"/><circle cx="470" cy="380" r="7"/>
      <circle cx="450" cy="330" r="10"/><circle cx="500" cy="430" r="6"/>
      <circle cx="410" cy="360" r="5"/>
    </g>
  </g>`;

const ramo = `
  <g>
    <g fill="${TINTA}">
      <circle cx="450" cy="480" r="58"/><circle cx="360" cy="520" r="48"/>
      <circle cx="540" cy="520" r="48"/><circle cx="400" cy="430" r="42"/>
      <circle cx="500" cy="430" r="42"/><circle cx="450" cy="560" r="46"/>
    </g>
    <g fill="${ORO}">
      <circle cx="450" cy="480" r="16"/><circle cx="360" cy="520" r="13"/>
      <circle cx="540" cy="520" r="13"/><circle cx="400" cy="430" r="11"/>
      <circle cx="500" cy="430" r="11"/><circle cx="450" cy="560" r="12"/>
    </g>
    <path d="M420 610 l-30 190 M450 615 l0 190 M480 610 l30 190" stroke="${TINTA}" stroke-width="14" stroke-linecap="round"/>
    <path d="M450 690 q-60 -18 -80 20 q40 24 80 -4 q40 28 80 4 q-20 -38 -80 -20z" fill="${ORO}"/>
  </g>`;

const baile = `
  <g>
    <!-- Él, inclinado hacia ella -->
    <circle cx="390" cy="440" r="46" fill="${TINTA}"/>
    <path d="M350 500 q45 -12 85 20 l70 60 -20 26 -70 -50 -15 130 30 220 h-46 l-30 -200 -24 200 h-46 l30 -406z" fill="${TINTA}"/>
    <!-- Ella, girando: vestido en vuelo -->
    <circle cx="565" cy="470" r="42" fill="${TINTA}"/>
    <path d="M565 525 q38 4 44 82 q120 120 90 240 q-120 60 -230 -10 q-10 -160 52 -230 q6 -78 44 -82z" fill="${TINTA}"/>
    <path d="M470 830 q110 66 225 12" stroke="${ORO}" stroke-width="8" fill="none" opacity="0.9"/>
    <g fill="${ORO}"><circle cx="330" cy="330" r="7"/><circle cx="600" cy="300" r="9"/><circle cx="680" cy="640" r="6"/></g>
  </g>`;

const arcoBoda = `
  <g>
    <path d="M290 900 l0 -280 q0 -230 160 -230 q160 0 160 230 l0 280" fill="none" stroke="${TINTA}" stroke-width="34"/>
    <g fill="${ORO}">
      <circle cx="290" cy="720" r="28"/><circle cx="610" cy="720" r="28"/>
      <circle cx="302" cy="580" r="24"/><circle cx="598" cy="580" r="24"/>
      <circle cx="360" cy="452" r="24"/><circle cx="540" cy="452" r="24"/>
      <circle cx="450" cy="404" r="28"/>
    </g>
    <g fill="${CREMA}">
      <circle cx="290" cy="720" r="9"/><circle cx="610" cy="720" r="9"/>
      <circle cx="302" cy="580" r="8"/><circle cx="598" cy="580" r="8"/>
      <circle cx="360" cy="452" r="8"/><circle cx="540" cy="452" r="8"/>
      <circle cx="450" cy="404" r="9"/>
    </g>
    <path d="M450 610 c0 -50 66 -50 66 0 c0 32 -33 44 -33 68 c0 -24 -33 -36 -33 -68z" fill="${TINTA}" transform="translate(-33 0)"/>
  </g>`;

/* ============================================================
   QUINCE — la celebración de ella
   ============================================================ */

const corona = `
  <g>
    <path d="M270 700 l0 -190 90 110 90 -180 90 180 90 -110 0 190z" fill="${ORO}" stroke="${TINTA}" stroke-width="10"/>
    <rect x="270" y="700" width="360" height="46" fill="${TINTA}"/>
    <g fill="${CREMA}" stroke="${TINTA}" stroke-width="6">
      <circle cx="270" cy="505" r="17"/><circle cx="360" cy="435" r="17"/>
      <circle cx="450" cy="515" r="17"/><circle cx="540" cy="435" r="17"/>
      <circle cx="630" cy="505" r="17"/>
    </g>
    <circle cx="450" cy="723" r="14" fill="${ORO}"/>
  </g>
  ${destellos}`;

const vestidoQuince = `
  <g>
    <!-- Tirantes caídos, corpiño entallado y falda de campana ANCHA -->
    <path d="M426 400 q-56 26 -64 90 M474 400 q56 26 64 90" stroke="${TINTA}" stroke-width="11" fill="none" stroke-linecap="round"/>
    <path d="M424 396 q26 -14 52 0 l10 88 q-8 34 -36 34 q-28 0 -36 -34z" fill="${TINTA}"/>
    <path d="M416 512 h68 q160 130 140 330 q-174 70 -348 0 q-20 -200 140 -330z" fill="${TINTA}"/>
    <path d="M330 690 q120 50 240 0 M300 780 q150 58 300 0" stroke="${ORO}" stroke-width="8" fill="none" opacity="0.9"/>
    <circle cx="450" cy="512" r="13" fill="${ORO}"/>
  </g>
  ${destellos}`;

const zapatilla = `
  <g>
    <!-- Zapatilla de tacón, de perfil: empeine, tacón fino y suela -->
    <path d="M280 760
             C280 706 320 668 382 652
             C452 634 502 588 522 546
             C532 524 564 518 576 540
             C588 562 576 594 554 626
             C532 658 518 690 514 760 Z" fill="${TINTA}"/>
    <rect x="526" y="646" width="22" height="128" rx="7" fill="${TINTA}"/>
    <path d="M272 760 h286 v16 q0 8 -8 8 h-270 q-8 0 -8 -8z" fill="${ORO}"/>
    <circle cx="316" cy="690" r="16" fill="${ORO}"/>
    <circle cx="316" cy="690" r="6" fill="${CREMA}"/>
  </g>
  ${destellos}`;

const pastelQuince = `
  <g>
    <rect x="360" y="450" width="180" height="110" rx="12" fill="${TINTA}"/>
    <rect x="320" y="580" width="260" height="130" rx="12" fill="${TINTA}"/>
    <rect x="280" y="730" width="340" height="140" rx="12" fill="${TINTA}"/>
    <path d="M320 580 q65 40 130 0 q65 40 130 0" stroke="${ORO}" stroke-width="8" fill="none"/>
    <path d="M280 730 q85 44 170 0 q85 44 170 0" stroke="${ORO}" stroke-width="8" fill="none"/>
    <text x="450" y="668" text-anchor="middle" font-family="Georgia, serif" font-size="72" fill="${ORO}">XV</text>
    <path d="M450 400 q-12 22 0 40 q12 -18 0 -40z" fill="${ORO}"/>
    <rect x="444" y="428" width="12" height="24" fill="${CREMA}"/>
  </g>`;

const abanico = `
  <g>
    ${[-56, -28, 0, 28, 56]
      .map(
        (a, i) => `<g transform="rotate(${a} 450 800)">
      <path d="M416 470 q34 -26 68 0 l-24 330 -20 0z" fill="${i % 2 === 0 ? TINTA : ORO}" opacity="0.95"/>
      <circle cx="450" cy="466" r="14" fill="${i % 2 === 0 ? ORO : TINTA}"/></g>`
      )
      .join("")}
    <circle cx="450" cy="800" r="36" fill="${ORO}"/>
    <circle cx="450" cy="800" r="17" fill="${TINTA}"/>
  </g>`;

const baileQuince = `
  <g>
    <circle cx="450" cy="400" r="44" fill="${TINTA}"/>
    <path d="M406 460 l88 0 q100 200 80 360 q-160 70 -248 0 q-20 -160 80 -360z" fill="${TINTA}"/>
    <path d="M350 690 q100 50 200 0 M330 760 q120 56 240 0" stroke="${ORO}" stroke-width="7" fill="none"/>
    <path d="M355 470 q-60 60 -30 130 M545 470 q60 60 30 130" stroke="${TINTA}" stroke-width="18" fill="none" stroke-linecap="round"/>
    <g fill="${ORO}"><circle cx="290" cy="600" r="9"/><circle cx="610" cy="600" r="9"/><circle cx="450" cy="310" r="10"/></g>
  </g>`;

/* ============================================================
   EMPRESARIAL — la noche de la marca
   ============================================================ */

const skyline = `
  <g>
    <g fill="${TINTA}">
      <rect x="240" y="560" width="90" height="340"/>
      <rect x="345" y="460" width="110" height="440"/>
      <rect x="470" y="520" width="80" height="380"/>
      <rect x="565" y="410" width="100" height="490"/>
    </g>
    <g fill="${ORO}">
      ${[0, 1, 2, 3, 4]
        .map(
          (f) => `<rect x="362" y="${495 + f * 70}" width="18" height="26"/>
        <rect x="404" y="${495 + f * 70}" width="18" height="26"/>
        <rect x="585" y="${445 + f * 78}" width="16" height="24"/>
        <rect x="622" y="${445 + f * 78}" width="16" height="24"/>`
        )
        .join("")}
      <rect x="258" y="600" width="14" height="20"/><rect x="292" y="600" width="14" height="20"/>
      <rect x="258" y="660" width="14" height="20"/><rect x="292" y="720" width="14" height="20"/>
      <rect x="488" y="560" width="14" height="20"/><rect x="518" y="620" width="14" height="20"/>
    </g>
    <circle cx="660" cy="330" r="40" fill="${CREMA}"/>
    <rect x="220" y="900" width="470" height="10" fill="${TINTA}"/>
  </g>`;

const copasAltas = `
  <g>
    <g transform="rotate(-10 385 630)">
      <path d="M356 450 h58 q6 130 -29 152 q-35 -22 -29 -152z" fill="${TINTA}"/>
      <rect x="379" y="600" width="12" height="160" fill="${TINTA}"/>
      <path d="M348 760 h74 q7 0 7 12 l0 8 -88 0 0 -8 q0 -12 7 -12z" fill="${TINTA}"/>
    </g>
    <g transform="rotate(10 515 630)">
      <path d="M486 450 h58 q6 130 -29 152 q-35 -22 -29 -152z" fill="${TINTA}"/>
      <rect x="509" y="600" width="12" height="160" fill="${TINTA}"/>
      <path d="M478 760 h74 q7 0 7 12 l0 8 -88 0 0 -8 q0 -12 7 -12z" fill="${TINTA}"/>
    </g>
    <g fill="${ORO}">
      <circle cx="450" cy="380" r="8"/><circle cx="420" cy="330" r="6"/>
      <circle cx="480" cy="300" r="9"/><circle cx="510" cy="360" r="5"/>
    </g>
  </g>`;

const podio = `
  <g>
    <path d="M330 620 l240 0 40 260 -320 0z" fill="${TINTA}"/>
    <rect x="310" y="596" width="280" height="30" rx="8" fill="${ORO}"/>
    <path d="M450 596 l0 -90" stroke="${TINTA}" stroke-width="12"/>
    <rect x="428" y="440" width="44" height="70" rx="22" fill="${TINTA}"/>
    <path d="M414 500 q0 46 36 46 q36 0 36 -46" stroke="${TINTA}" stroke-width="10" fill="none"/>
    <path d="M250 330 l90 130 M650 330 l-90 130" stroke="${ORO}" stroke-width="6" opacity="0.8"/>
    <circle cx="250" cy="322" r="12" fill="${ORO}"/><circle cx="650" cy="322" r="12" fill="${ORO}"/>
  </g>`;

const cinta = `
  <g>
    <path d="M220 640 l190 -18 0 44 -190 18z M680 640 l-190 -18 0 44 190 18z" fill="${ORO}"/>
    <path d="M450 610 q-70 -60 -110 -10 q-16 40 50 44 q-66 4 -50 44 q40 50 110 -10 q70 60 110 10 q16 -40 -50 -44 q66 -4 50 -44 q-40 -50 -110 10z" fill="${TINTA}"/>
    <circle cx="450" cy="644" r="22" fill="${ORO}"/>
    <path d="M220 618 l0 66 M680 618 l0 66" stroke="${TINTA}" stroke-width="10"/>
  </g>
  ${destellos}`;

const laurel = `
  <g>
    <g stroke="${TINTA}" stroke-width="12" fill="none">
      <path d="M330 820 q-100 -170 20 -330"/>
      <path d="M570 820 q100 -170 -20 -330"/>
    </g>
    <g fill="${TINTA}">
      ${[
        [316, 760, -20],
        [288, 690, -5],
        [278, 616, 10],
        [292, 546, 28],
        [330, 492, 48],
      ]
        .map(
          ([x, y, a]) => `<ellipse cx="${x}" cy="${y}" rx="40" ry="17" transform="rotate(${a} ${x} ${y})"/>
        <ellipse cx="${900 - Number(x)}" cy="${y}" rx="40" ry="17" transform="rotate(${-Number(a)} ${900 - Number(x)} ${y})"/>`
        )
        .join("")}
    </g>
    <path d="M450 520 l26 74 78 2 -62 48 22 76 -64 -45 -64 45 22 -76 -62 -48 78 -2z" fill="${ORO}"/>
  </g>`;

const conexiones = `
  <g>
    <g stroke="${ORO}" stroke-width="6" opacity="0.9" fill="none">
      <path d="M300 500 L450 620 L610 480 M450 620 L360 800 M450 620 L580 780 M300 500 L360 800 M610 480 L580 780"/>
    </g>
    <g fill="${TINTA}">
      <circle cx="300" cy="500" r="34"/><circle cx="610" cy="480" r="40"/>
      <circle cx="450" cy="620" r="50"/><circle cx="360" cy="800" r="34"/>
      <circle cx="580" cy="780" r="30"/>
    </g>
    <g fill="${ORO}">
      <circle cx="450" cy="620" r="16"/><circle cx="610" cy="480" r="12"/><circle cx="300" cy="500" r="10"/>
    </g>
  </g>`;

/* ============================================================
   BABY — la dulce espera
   ============================================================ */

const cochecito = `
  <g>
    <path d="M300 560 a150 150 0 0 1 150 -150 l0 150z" fill="${ORO}"/>
    <path d="M300 560 l300 0 a150 150 0 0 1 -300 0z" transform="rotate(180 450 560) translate(0 -150)" fill="${TINTA}" opacity="0"/>
    <path d="M300 560 h300 v40 q0 90 -150 90 q-150 0 -150 -90z" fill="${TINTA}"/>
    <path d="M600 560 q60 -10 70 -80" stroke="${TINTA}" stroke-width="16" fill="none" stroke-linecap="round"/>
    <circle cx="360" cy="760" r="44" fill="none" stroke="${TINTA}" stroke-width="14"/>
    <circle cx="540" cy="760" r="44" fill="none" stroke="${TINTA}" stroke-width="14"/>
    <circle cx="360" cy="760" r="10" fill="${ORO}"/><circle cx="540" cy="760" r="10" fill="${ORO}"/>
    <path d="M430 415 q-24 -34 6 -40 q14 -2 14 14 q0 -16 14 -14 q30 6 6 40 l-20 18z" fill="${TINTA}"/>
  </g>`;

const osito = `
  <g fill="${TINTA}">
    <circle cx="370" cy="440" r="34"/><circle cx="530" cy="440" r="34"/>
    <circle cx="450" cy="500" r="95"/>
    <ellipse cx="450" cy="700" rx="115" ry="130"/>
    <circle cx="330" cy="650" r="42"/><circle cx="570" cy="650" r="42"/>
    <circle cx="370" cy="820" r="46"/><circle cx="530" cy="820" r="46"/>
  </g>
  <ellipse cx="450" cy="530" rx="34" ry="26" fill="${CREMA}"/>
  <circle cx="450" cy="520" r="10" fill="${TINTA}"/>
  <circle cx="415" cy="480" r="8" fill="${CREMA}"/><circle cx="485" cy="480" r="8" fill="${CREMA}"/>
  <ellipse cx="450" cy="700" rx="52" ry="64" fill="${ORO}" opacity="0.9"/>`;

const globosBaby = `
  <g>
    <ellipse cx="350" cy="480" rx="80" ry="95" fill="${TINTA}"/>
    <ellipse cx="530" cy="420" rx="70" ry="85" fill="${ORO}"/>
    <ellipse cx="500" cy="600" rx="60" ry="72" fill="${TINTA}" opacity="0.75"/>
    <path d="M350 575 q-20 120 40 240 M530 505 q30 130 -30 310 M500 672 q0 90 -20 148" stroke="${TINTA}" stroke-width="7" fill="none"/>
    <path d="M330 880 q30 -26 60 0 q10 -36 50 -30 q6 -30 40 -26 q30 4 28 36 q30 6 22 40 l-200 0 q-14 -10 0 -20z" fill="${CREMA}"/>
  </g>`;

const movil = `
  <g>
    <path d="M280 420 q170 -90 340 0" stroke="${TINTA}" stroke-width="16" fill="none" stroke-linecap="round"/>
    <path d="M310 432 l0 130 M450 375 l0 210 M590 432 l0 100" stroke="${TINTA}" stroke-width="6"/>
    <path d="M310 600 l16 46 48 2 -38 30 13 46 -39 -27 -39 27 13 -46 -38 -30 48 -2z" fill="${ORO}"/>
    <path d="M450 625 a58 58 0 1 0 46 92 a58 58 0 0 1 -46 -92z" fill="${TINTA}"/>
    <path d="M590 570 l14 40 42 2 -33 26 11 40 -34 -23 -34 23 11 -40 -33 -26 42 -2z" fill="${TINTA}"/>
    <circle cx="450" cy="352" r="18" fill="${ORO}"/>
  </g>`;

const patucos = `
  <g>
    <g transform="rotate(-8 370 640)">
      <path d="M300 560 q0 -60 60 -60 q60 0 60 60 l0 60 q60 0 60 60 q0 50 -60 50 l-120 0 q-30 0 -30 -50 l30 0z" fill="${TINTA}"/>
      <path d="M300 560 q60 24 120 0" stroke="${ORO}" stroke-width="8" fill="none"/>
      <circle cx="360" cy="545" r="12" fill="${ORO}"/>
    </g>
    <g transform="rotate(8 540 720) translate(160 90)">
      <path d="M300 560 q0 -60 60 -60 q60 0 60 60 l0 60 q60 0 60 60 q0 50 -60 50 l-120 0 q-30 0 -30 -50 l30 0z" fill="${TINTA}" opacity="0.85"/>
      <path d="M300 560 q60 24 120 0" stroke="${ORO}" stroke-width="8" fill="none"/>
      <circle cx="360" cy="545" r="12" fill="${ORO}"/>
    </g>
  </g>`;

const biberon = `
  <g>
    <path d="M450 380 q-26 0 -26 30 l0 20 52 0 0 -20 q0 -30 -26 -30z" fill="${ORO}"/>
    <rect x="398" y="430" width="104" height="44" rx="14" fill="${TINTA}"/>
    <path d="M390 474 h120 q10 190 -10 330 q0 26 -26 26 h-48 q-26 0 -26 -26 q-20 -140 -10 -330z" fill="${TINTA}" opacity="0.92"/>
    <g stroke="${ORO}" stroke-width="7">
      <path d="M500 560 l-36 0 M500 630 l-36 0 M500 700 l-36 0"/>
    </g>
    <path d="M330 560 c0 -20 26 -20 26 0 c0 12 -13 17 -13 26 c0 -9 -13 -14 -13 -26z" fill="${ORO}"/>
    <path d="M590 640 c0 -16 22 -16 22 0 c0 10 -11 14 -11 22 c0 -8 -11 -12 -11 -22z" fill="${ORO}" opacity="0.8"/>
  </g>`;

/* ============================================================
   Los sets, en orden: la PRIMERA escena es la portada
   ============================================================ */

const ESCENAS: Record<EscenaEvento, { nombre: string; motivo: string }[]> = {
  boda: [
    { nombre: "los-novios", motivo: novios },
    { nombre: "la-propuesta", motivo: propuesta },
    { nombre: "los-anillos", motivo: anillos },
    { nombre: "el-brindis", motivo: brindis },
    { nombre: "el-ramo", motivo: ramo },
    { nombre: "el-baile", motivo: baile },
    { nombre: "el-altar", motivo: arcoBoda },
  ],
  quince: [
    { nombre: "la-corona", motivo: corona },
    { nombre: "el-vestido", motivo: vestidoQuince },
    { nombre: "el-vals", motivo: baileQuince },
    { nombre: "el-pastel", motivo: pastelQuince },
    { nombre: "la-zapatilla", motivo: zapatilla },
    { nombre: "el-abanico", motivo: abanico },
  ],
  empresarial: [
    { nombre: "la-ciudad", motivo: skyline },
    { nombre: "el-brindis", motivo: copasAltas },
    { nombre: "el-podio", motivo: podio },
    { nombre: "la-apertura", motivo: cinta },
    { nombre: "el-reconocimiento", motivo: laurel },
    { nombre: "la-red", motivo: conexiones },
  ],
  baby: [
    { nombre: "el-cochecito", motivo: cochecito },
    { nombre: "el-osito", motivo: osito },
    { nombre: "los-globos", motivo: globosBaby },
    { nombre: "el-movil", motivo: movil },
    { nombre: "los-patucos", motivo: patucos },
    { nombre: "el-biberon", motivo: biberon },
  ],
};

/** Las escenas de un tipo de evento, tintadas con el tono de la plantilla. */
export function escenasMuestra(
  evento: EscenaEvento,
  tono: string
): { nombre: string; url: string }[] {
  return ESCENAS[evento].map((escena) => ({
    nombre: `${escena.nombre}.svg`,
    url: lienzo(tono, escena.motivo),
  }));
}
