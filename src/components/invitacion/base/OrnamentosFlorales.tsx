/**
 * ORNAMENTOS FLORALES
 * ====================
 * La familia recargada: ramos, guirnaldas y marcos botánicos para las
 * invitaciones que piden mucho adorno.
 *
 * Como el resto de ornamentos, son SVG dibujados a mano, sin dependencias,
 * y heredan el color del acento por `currentColor`. Van con opacidad baja
 * y detrás del contenido: adornan sin competir con el texto.
 */

interface Props {
  className?: string;
}

/* ============================================================
   PIEZAS BASE — se combinan para formar los ornamentos grandes
   ============================================================ */

/** Una flor de cinco pétalos con corazón. */
function Flor({ x, y, r, giro = 0 }: { x: number; y: number; r: number; giro?: number }) {
  const petalos = [0, 72, 144, 216, 288];
  return (
    <g transform={`translate(${x} ${y}) rotate(${giro})`}>
      {petalos.map((a) => (
        <ellipse
          key={a}
          cx={0}
          cy={-r * 0.62}
          rx={r * 0.34}
          ry={r * 0.62}
          transform={`rotate(${a})`}
          fill="currentColor"
          fillOpacity="0.16"
          stroke="currentColor"
          strokeWidth={r * 0.06}
        />
      ))}
      <circle r={r * 0.2} fill="currentColor" fillOpacity="0.5" />
    </g>
  );
}

/** Una hoja lanceolada con su nervio. */
function Hoja({ x, y, largo, giro }: { x: number; y: number; largo: number; giro: number }) {
  const ancho = largo * 0.38;
  return (
    <g transform={`translate(${x} ${y}) rotate(${giro})`}>
      <path
        d={`M0 0 C ${ancho} ${-largo * 0.3}, ${ancho} ${-largo * 0.75}, 0 ${-largo}
            C ${-ancho} ${-largo * 0.75}, ${-ancho} ${-largo * 0.3}, 0 0 Z`}
        fill="currentColor"
        fillOpacity="0.12"
        stroke="currentColor"
        strokeWidth={largo * 0.035}
      />
      <path d={`M0 0 L0 ${-largo}`} stroke="currentColor" strokeWidth={largo * 0.03} opacity="0.55" />
    </g>
  );
}

/** Un capullo pequeño, para rellenar huecos del ramo. */
function Capullo({ x, y, r, giro = 0 }: { x: number; y: number; r: number; giro?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${giro})`}>
      <path
        d={`M0 0 C ${r} ${-r * 0.5}, ${r * 0.8} ${-r * 1.8}, 0 ${-r * 2}
            C ${-r * 0.8} ${-r * 1.8}, ${-r} ${-r * 0.5}, 0 0 Z`}
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeWidth={r * 0.12}
      />
    </g>
  );
}

/* ============================================================
   ORNAMENTOS COMPUESTOS
   ============================================================ */

/**
 * Ramo de esquina. Se coloca en las cuatro esquinas de la portada, girado,
 * para enmarcar el nombre sin taparlo.
 */
export function RamoEsquina({ className = "" }: Props) {
  return (
    <svg viewBox="0 0 200 200" className={className} fill="none" aria-hidden>
      {/* Tallos que abren en abanico desde la esquina */}
      <path d="M6 6 C 60 30, 96 62, 118 108" stroke="currentColor" strokeWidth="1.4" opacity="0.7" />
      <path d="M6 6 C 34 62, 52 104, 60 152" stroke="currentColor" strokeWidth="1.4" opacity="0.7" />
      <path d="M6 6 C 66 18, 118 30, 158 44" stroke="currentColor" strokeWidth="1.2" opacity="0.55" />

      <Hoja x={44} y={40} largo={30} giro={38} />
      <Hoja x={70} y={64} largo={26} giro={62} />
      <Hoja x={30} y={72} largo={28} giro={-14} />
      <Hoja x={46} y={116} largo={24} giro={8} />
      <Hoja x={104} y={36} largo={22} giro={78} />

      <Flor x={116} y={104} r={26} giro={12} />
      <Flor x={58} y={148} r={20} giro={-24} />
      <Flor x={154} y={44} r={17} giro={40} />
      <Capullo x={88} y={82} r={7} giro={30} />
      <Capullo x={30} y={110} r={6} giro={-40} />
    </svg>
  );
}

/**
 * Guirnalda horizontal. Corona los títulos de sección y separa bloques con
 * más presencia que un divisor de línea.
 */
export function Guirnalda({ className = "" }: Props) {
  return (
    <svg viewBox="0 0 300 60" className={className} fill="none" aria-hidden>
      {/* Arco de la guirnalda */}
      <path d="M14 20 C 80 54, 220 54, 286 20" stroke="currentColor" strokeWidth="1.3" opacity="0.75" />

      {[42, 76, 110, 190, 224, 258].map((x, i) => (
        <Hoja key={x} x={x} largo={17 + (i % 2) * 5} y={i < 3 ? 36 + i * 3 : 45 - (i - 3) * 3} giro={i < 3 ? -34 + i * 8 : 34 - (i - 3) * 8} />
      ))}

      <Flor x={150} y={44} r={17} />
      <Flor x={112} y={40} r={11} giro={20} />
      <Flor x={188} y={40} r={11} giro={-20} />
      <Capullo x={72} y={34} r={5} giro={-30} />
      <Capullo x={228} y={34} r={5} giro={30} />
    </svg>
  );
}

/** Separador floral: sustituye al divisor de línea cuando hay mucho adorno. */
export function SeparadorFloral({ className = "" }: Props) {
  return (
    <svg viewBox="0 0 200 40" className={className} fill="none" aria-hidden>
      <path d="M8 22 C 40 22, 60 16, 82 20" stroke="currentColor" strokeWidth="1.1" opacity="0.7" />
      <path d="M192 22 C 160 22, 140 16, 118 20" stroke="currentColor" strokeWidth="1.1" opacity="0.7" />
      <Hoja x={54} y={26} largo={13} giro={-52} />
      <Hoja x={146} y={26} largo={13} giro={52} />
      <Flor x={100} y={22} r={13} />
      <Capullo x={76} y={18} r={4} giro={-46} />
      <Capullo x={124} y={18} r={4} giro={46} />
    </svg>
  );
}

/**
 * Rama larga para los laterales de la portada. Muy tenue: da profundidad
 * sin robarle protagonismo al nombre.
 */
export function RamaLateral({ className = "" }: Props) {
  return (
    <svg viewBox="0 0 120 420" className={className} fill="none" aria-hidden>
      <path d="M18 6 C 46 90, 30 190, 56 280 C 74 342, 62 386, 44 414"
        stroke="currentColor" strokeWidth="1.3" opacity="0.6" />
      {[
        [40, 60, 26, 48], [30, 116, 22, -42], [44, 168, 24, 54],
        [36, 226, 20, -38], [56, 286, 24, 50], [50, 344, 19, -34],
      ].map(([x, y, l, g], i) => (
        <Hoja key={i} x={x} y={y} largo={l} giro={g} />
      ))}
      <Flor x={34} y={140} r={15} giro={16} />
      <Flor x={58} y={252} r={12} giro={-22} />
      <Capullo x={46} y={200} r={5} giro={20} />
    </svg>
  );
}

/**
 * Follaje de fondo, casi invisible. Le quita el vacío a las zonas amplias
 * sin que el ojo lo registre como un elemento más.
 */
export function FollajeFondo({ className = "" }: Props) {
  return (
    <svg viewBox="0 0 400 400" className={className} fill="none" aria-hidden>
      <g opacity="0.5">
        <path d="M-10 320 C 80 300, 140 240, 170 150" stroke="currentColor" strokeWidth="1" />
        <path d="M410 80 C 320 100, 260 160, 230 250" stroke="currentColor" strokeWidth="1" />
        {[
          [40, 300, 34, 40], [96, 268, 30, 30], [148, 214, 28, 22],
          [352, 110, 32, -40], [300, 150, 28, -30], [252, 206, 26, -22],
        ].map(([x, y, l, g], i) => (
          <Hoja key={i} x={x} y={y} largo={l} giro={g} />
        ))}
      </g>
    </svg>
  );
}
