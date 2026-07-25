/**
 * Ornamentos vectoriales dibujados a mano (SVG puro, sin dependencias).
 * Todos heredan el color del acento vía `currentColor`.
 */

type Props = { className?: string };

/* ---------- Divisores ---------- */

/** Filigrana clásica: rombo central con volutas. */
export function DivisorFiligrana({ className = "" }: Props) {
  return (
    <svg viewBox="0 0 240 24" fill="none" className={`w-52 h-6 ${className}`} aria-hidden>
      <path d="M8 12h74" stroke="currentColor" strokeWidth="1" opacity=".55" />
      <path d="M158 12h74" stroke="currentColor" strokeWidth="1" opacity=".55" />
      <path
        d="M92 12c6-5 12-8 16-8s6 3 6 6-3 6-7 6-9-3-15-4zm56 0c-6 5-12 8-16 8s-6-3-6-6 3-6 7-6 9 3 15 4z"
        stroke="currentColor" strokeWidth="1" opacity=".85"
      />
      <path d="M120 6.5l4.5 5.5-4.5 5.5-4.5-5.5z" fill="currentColor" />
    </svg>
  );
}

/** Rama botánica simétrica: dos tallos con hojas y baya central. */
export function DivisorBotanico({ className = "" }: Props) {
  const hojas = [0, 1, 2, 3, 4];
  return (
    <svg viewBox="0 0 260 44" fill="none" className={`w-56 h-11 ${className}`} aria-hidden>
      {/* Tallos curvos */}
      <path d="M124 22C104 22 78 20 46 14" stroke="currentColor" strokeWidth="1.1" />
      <path d="M136 22c20 0 46-2 78-8" stroke="currentColor" strokeWidth="1.1" />

      {hojas.map((i) => {
        const t = i / (hojas.length - 1);
        const xIzq = 112 - t * 66;
        const xDer = 148 + t * 66;
        const y = 21 - t * 6;
        const rx = 13 - i * 1.6;
        const ry = 4.6 - i * 0.45;
        const arriba = i % 2 === 0;
        const giro = arriba ? -32 : 26;
        return (
          <g key={i} opacity={0.92 - i * 0.07}>
            <ellipse cx={xIzq} cy={arriba ? y - 6 : y + 6} rx={rx} ry={ry}
              transform={`rotate(${giro} ${xIzq} ${arriba ? y - 6 : y + 6})`}
              stroke="currentColor" strokeWidth=".9" />
            <ellipse cx={xDer} cy={arriba ? y - 6 : y + 6} rx={rx} ry={ry}
              transform={`rotate(${-giro} ${xDer} ${arriba ? y - 6 : y + 6})`}
              stroke="currentColor" strokeWidth=".9" />
          </g>
        );
      })}

      {/* Baya central */}
      <circle cx="130" cy="22" r="3.2" fill="currentColor" />
      <circle cx="130" cy="22" r="6.4" stroke="currentColor" strokeWidth=".8" opacity=".55" />
    </svg>
  );
}

/** Línea mínima con punto. */
export function DivisorMinimo({ className = "" }: Props) {
  return (
    <svg viewBox="0 0 200 8" fill="none" className={`w-40 h-2 ${className}`} aria-hidden>
      <path d="M0 4h88M112 4h88" stroke="currentColor" strokeWidth="1" opacity=".5" />
      <circle cx="100" cy="4" r="2.5" fill="currentColor" />
    </svg>
  );
}

/** Zigurat Art Déco escalonado con líneas laterales. */
export function DivisorDeco({ className = "" }: Props) {
  return (
    <svg viewBox="0 0 260 34" fill="none" className={`w-56 h-9 ${className}`} aria-hidden>
      {/* Líneas laterales dobles */}
      <path d="M6 26h92M162 26h92" stroke="currentColor" strokeWidth="1.1" />
      <path d="M22 30h76M162 30h76" stroke="currentColor" strokeWidth=".7" opacity=".5" />

      {/* Escalones */}
      <path
        d="M104 26v-5h10v-5h10v-5h12v5h10v5h10v5"
        stroke="currentColor" strokeWidth="1.3" strokeLinejoin="miter"
      />
      {/* Remate superior */}
      <path d="M126 11V4" stroke="currentColor" strokeWidth="1.3" />
      <path d="M130 11V4" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="128" cy="3" r="2.4" fill="currentColor" />
      {/* Base */}
      <path d="M100 26h56" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

/** Dos frondas de palma enfrentadas con sol central. */
export function DivisorPalma({ className = "" }: Props) {
  const ribs = [0, 1, 2, 3, 4, 5];
  return (
    <svg viewBox="0 0 260 46" fill="none" className={`w-60 h-12 ${className}`} aria-hidden>
      {/* Nervaduras principales */}
      <path d="M118 30C96 30 70 24 40 10" stroke="currentColor" strokeWidth="1.2" />
      <path d="M142 30c22 0 48-6 78-20" stroke="currentColor" strokeWidth="1.2" />

      {ribs.map((i) => {
        const t = i / (ribs.length - 1);
        const xI = 112 - t * 72;
        const xD = 148 + t * 72;
        const y = 29 - t * 13;
        const largo = 15 - i * 1.4;
        return (
          <g key={i} opacity={0.9 - i * 0.08}>
            <path d={`M${xI} ${y}c-2 -${largo * 0.5} -6 -${largo * 0.8} -${largo} -${largo}`} stroke="currentColor" strokeWidth=".95" />
            <path d={`M${xI} ${y}c2 ${largo * 0.4} 5 ${largo * 0.6} ${largo * 0.8} ${largo * 0.7}`} stroke="currentColor" strokeWidth=".95" />
            <path d={`M${xD} ${y}c2 -${largo * 0.5} 6 -${largo * 0.8} ${largo} -${largo}`} stroke="currentColor" strokeWidth=".95" />
            <path d={`M${xD} ${y}c-2 ${largo * 0.4} -5 ${largo * 0.6} -${largo * 0.8} ${largo * 0.7}`} stroke="currentColor" strokeWidth=".95" />
          </g>
        );
      })}

      {/* Sol central */}
      <circle cx="130" cy="30" r="5" stroke="currentColor" strokeWidth="1.1" />
      <circle cx="130" cy="30" r="1.8" fill="currentColor" />
      {[0, 45, 90, 135].map((a) => (
        <path key={a} d="M130 22v-4M130 38v4" stroke="currentColor" strokeWidth=".9" opacity=".7"
          transform={`rotate(${a} 130 30)`} />
      ))}
    </svg>
  );
}

/** Devuelve el divisor que corresponde a cada plantilla. */
export function Divisor({ variante, className }: { variante: string; className?: string }) {
  switch (variante) {
    case "botanica":
      return <DivisorBotanico className={className} />;
    case "moderna":
      return <DivisorMinimo className={className} />;
    case "deco":
      return <DivisorDeco className={className} />;
    case "tropical":
      return <DivisorPalma className={className} />;
    default:
      return <DivisorFiligrana className={className} />;
  }
}

/* ---------- Marcos y esquinas ---------- */

/** Esquina ornamental (se rota para las 4 esquinas). */
export function EsquinaOrnamental({ className = "" }: Props) {
  return (
    <svg viewBox="0 0 80 80" fill="none" className={`w-16 h-16 ${className}`} aria-hidden>
      <path d="M2 2h30M2 2v30" stroke="currentColor" strokeWidth="1" opacity=".8" />
      <path d="M8 8h14M8 8v14" stroke="currentColor" strokeWidth=".8" opacity=".5" />
      <path d="M2 40c14 0 24-10 24-24" stroke="currentColor" strokeWidth=".8" opacity=".45" />
      <circle cx="30" cy="30" r="2" fill="currentColor" opacity=".7" />
    </svg>
  );
}

/** Marco Art Déco escalonado. */
export function MarcoDeco({ className = "" }: Props) {
  return (
    <svg viewBox="0 0 300 420" fill="none" preserveAspectRatio="none" className={`w-full h-full ${className}`} aria-hidden>
      <path d="M20 8h260M20 412h260M8 20v380M292 20v380" stroke="currentColor" strokeWidth="1.2" opacity=".8" />
      <path d="M8 20L20 8M280 8l12 12M8 400l12 12M280 412l12-12" stroke="currentColor" strokeWidth="1.2" opacity=".8" />
      <path d="M28 18h244M28 402h244M18 30v360M282 30v360" stroke="currentColor" strokeWidth=".6" opacity=".4" />
      <path d="M150 8v14M150 398v14" stroke="currentColor" strokeWidth="1.5" opacity=".9" />
      <path d="M143 22l7-9 7 9z" fill="currentColor" opacity=".9" />
      <path d="M143 398l7 9 7-9z" fill="currentColor" opacity=".9" />
    </svg>
  );
}

/* ---------- Monograma ---------- */

/** Círculo con las iniciales, dibujado con el acento. */
export function Monograma({
  iniciales,
  className = "",
}: {
  iniciales: string;
  className?: string;
}) {
  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      <svg viewBox="0 0 120 120" fill="none" className="w-full h-full" aria-hidden>
        <circle cx="60" cy="60" r="55" stroke="currentColor" strokeWidth=".8" opacity=".45" />
        <circle cx="60" cy="60" r="49" stroke="currentColor" strokeWidth="1.4" opacity=".85" />
        <path d="M60 5v10M60 105v10M5 60h10M105 60h10" stroke="currentColor" strokeWidth="1" opacity=".6" />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center tracking-[0.12em]"
        style={{ fontFamily: "var(--inv-display)", fontSize: "1.65rem" }}
      >
        {iniciales}
      </span>
    </div>
  );
}

/** Extrae iniciales legibles de un título: "Camila & Lucas" → "C & L" */
export function inicialesDe(titulo: string): string {
  const partes = titulo
    .split(/\s*(?:&|y|\+)\s*/i)
    .map((p) => p.trim())
    .filter(Boolean);

  if (partes.length >= 2) {
    return partes
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join(" & ");
  }
  return (titulo.trim()[0] ?? "I").toUpperCase();
}
