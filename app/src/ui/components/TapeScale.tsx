import type { FitBand } from '@choudo/core/domain/fit';
import { CM_PER_INCH } from '@choudo/core/domain/units';
import type { UnitSystem } from '../state/stored';

interface TapeScaleProps {
  diffCm: number;
  bands: FitBand[];
  units: UnitSystem;
  kind: 'girth' | 'length';
}

const W = 320;
const PAD = 10;
const BAND_Y = 0;
const BAND_H = 4;
const TAPE_Y = 8;
const TAPE_H = 22;

/**
 * A strip of tape measure centred on "your body" (0). The coloured rail above it
 * shows which differences read as tight / fitted / loose; the needle is this size.
 */
export function TapeScale({ diffCm, bands, units, kind }: TapeScaleProps) {
  const metric = units === 'metric';
  // Range in cm. Girths get more room on the loose side.
  const [min, max] = kind === 'girth' ? [-12, 18] : [-12, 12];
  const x = (cm: number) => PAD + ((cm - min) / (max - min)) * (W - 2 * PAD);
  const clamped = Math.min(max, Math.max(min, diffCm));
  const offScale = diffCm < min ? 'left' : diffCm > max ? 'right' : null;

  // Ticks every 1 cm (labels every 5) or every half inch (labels every 2 in).
  const stepCm = metric ? 1 : CM_PER_INCH / 2;
  const ticks: { cm: number; major: boolean; label: string | null }[] = [];
  for (let i = Math.ceil(min / stepCm); i * stepCm <= max; i++) {
    const cm = i * stepCm;
    const unitsValue = metric ? i : i / 2;
    const labelled = metric ? i % 5 === 0 : unitsValue % 2 === 0;
    const major = metric ? i % 5 === 0 : Number.isInteger(unitsValue);
    ticks.push({ cm, major, label: labelled ? String(unitsValue).replace('-', '−') : null });
  }

  return (
    <svg className="tape-scale" viewBox={`0 0 ${W} 40`} aria-hidden="true">
      {bands.map((b, i) => {
        const from = x(Math.max(min, b.from));
        const to = x(Math.min(max, b.to));
        if (to <= from) return null;
        return <rect key={i} className={`tape-scale__band tone-${b.tone}`} x={from} y={BAND_Y} width={to - from} height={BAND_H} />;
      })}
      <rect className="tape-scale__tape" x={PAD - 4} y={TAPE_Y} width={W - 2 * PAD + 8} height={TAPE_H} rx={1.5} />
      {ticks.map((t) => (
        <g key={t.cm}>
          <line
            className="tape-scale__tick"
            x1={x(t.cm)}
            x2={x(t.cm)}
            y1={TAPE_Y}
            y2={TAPE_Y + (t.major ? 8 : 4.5)}
          />
          {t.label !== null && (
            <text className="tape-scale__num" x={x(t.cm)} y={TAPE_Y + 17} textAnchor="middle">
              {t.label}
            </text>
          )}
        </g>
      ))}
      <line className="tape-scale__zero" x1={x(0)} x2={x(0)} y1={TAPE_Y} y2={TAPE_Y + TAPE_H} />
      <g className="tape-scale__needle" transform={`translate(${x(clamped)} 0)`}>
        <line x1={0} x2={0} y1={TAPE_Y - 2} y2={TAPE_Y + TAPE_H + 2} />
        <path d="M-4 36 L4 36 L0 31 Z" />
        {offScale && <path d={offScale === 'left' ? 'M-6 19 L-2 15 L-2 23 Z' : 'M6 19 L2 15 L2 23 Z'} />}
      </g>
    </svg>
  );
}
