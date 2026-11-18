import { useMemo } from 'react';
import type { BodyMeasurements } from '../../../domain/body';
import type { GarmentFit, ZoneFit } from '../../../domain/fit';
import type { Garment } from '../../../domain/garments';
import { bodyGeometry, bottomShape, topShape, type Marker } from './geometry';
import './Mannequin.css';

export interface WornGarment {
  garment: Garment;
  sizeLabel: string;
  fit?: GarmentFit;
}

interface MannequinProps {
  body: BodyMeasurements;
  top?: WornGarment;
  bottom?: WornGarment;
  /** Show coloured fit pins on each zone. */
  showFit?: boolean;
  className?: string;
}

/** Fixed canvas so taller bodies are drawn taller. Units are cm. */
const VIEW = { left: -62, right: 62, top: -6 };

/**
 * A 2D dress-form mannequin scaled to the body, optionally wearing a top and a
 * bottom. Swap this component out to move to a 3D renderer later.
 */
export function Mannequin({ body, top, bottom, showFit = true, className }: MannequinProps) {
  const g = useMemo(() => bodyGeometry(body), [body]);

  const topSize = top?.garment.sizes.find((s) => s.label === top.sizeLabel);
  const bottomSize = bottom?.garment.sizes.find((s) => s.label === bottom.sizeLabel);
  const topDraw = top && topSize ? topShape(g, top.garment, topSize.measurements, body.chestCm) : null;
  const bottomDraw = bottom && bottomSize ? bottomShape(g, bottom.garment, bottomSize.measurements) : null;

  const viewHeight = Math.max(214, body.heightCm + 10);
  // Top pins go on the figure's right edge, bottom pins on the left, so a pants
  // waist pin never looks like it belongs to the shirt covering it.
  const pins: { key: string; at: Marker; side: 1 | -1; zone: ZoneFit }[] = [];
  if (showFit) {
    for (const z of top?.fit?.zones ?? []) {
      const at = topDraw?.markers[z.zone as keyof typeof topDraw.markers];
      if (at) pins.push({ key: `top-${z.zone}`, at, side: 1, zone: z });
    }
    for (const z of bottom?.fit?.zones ?? []) {
      const at = bottomDraw?.markers[z.zone as keyof typeof bottomDraw.markers];
      if (at) pins.push({ key: `bottom-${z.zone}`, at, side: -1, zone: z });
    }
  }

  const label = [
    `Mannequin, ${Math.round(body.heightCm)} cm tall`,
    top ? `wearing ${top.garment.brand} ${top.garment.name} in ${top.sizeLabel}` : null,
    bottom ? `and ${bottom.garment.brand} ${bottom.garment.name} in ${bottom.sizeLabel}` : null,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <svg
      className={['mannequin', className].filter(Boolean).join(' ')}
      viewBox={`${VIEW.left} ${VIEW.top} ${VIEW.right - VIEW.left} ${viewHeight}`}
      role="img"
      aria-label={label}
    >
      <HeightTape heightCm={body.heightCm} x={VIEW.left + 3} />

      <line className="mannequin__floor" x1={-40} x2={40} y1={g.y.floor + 0.5} y2={g.y.floor + 0.5} />

      {/* Body: arms behind the torso so the torso hides where they join. */}
      <g className="mannequin__form">
        <path d={g.paths.arms[0]} />
        <path d={g.paths.arms[1]} />
        <path d={g.paths.torso} />
        {g.paths.feet.map((foot, i) => (
          <ellipse key={i} {...foot} />
        ))}
        <rect x={-g.half.neck * 0.8} y={g.y.chin - 2} width={g.half.neck * 1.6} height={6} rx={2} />
        <ellipse cx={g.head.cx} cy={g.head.cy} rx={g.head.rx} ry={g.head.ry} />
      </g>
      <line className="mannequin__seam" x1={0} x2={0} y1={g.y.neckBase + 4} y2={g.y.crotch - 4} />

      {bottomDraw && bottom && (
        <path
          className={garmentClass(bottomDraw.approximate)}
          d={bottomDraw.body}
          style={{ fill: bottom.garment.color }}
        />
      )}
      {topDraw && top && (
        <g className={garmentClass(topDraw.approximate)} style={{ fill: top.garment.color }}>
          <path d={topDraw.sleeves[0]} />
          <path d={topDraw.sleeves[1]} />
          <path d={topDraw.body} />
        </g>
      )}

      {pins.map(({ key, at, side, zone }) => (
        <g
          key={key}
          className={`mannequin__pin tone-${zone.tone}`}
          transform={`translate(${side * (at.x + 2.4)} ${at.y})`}
          data-zone={zone.zone}
        >
          <line x1={-side * 2.4} x2={0} y1={0} y2={0} />
          <circle r={1.9} />
        </g>
      ))}
    </svg>
  );
}

const garmentClass = (approximate: boolean) =>
  ['mannequin__garment', approximate ? 'is-approximate' : null].filter(Boolean).join(' ');

/** A strip of tape measure up the left edge, marked every 10 cm, topped at the body's height. */
function HeightTape({ heightCm, x }: { heightCm: number; x: number }) {
  const floor = heightCm; // the body stands on y = height
  const ticks = [];
  for (let cm = 0; cm <= 210; cm += 2) {
    const y = floor - cm;
    if (y < -4) break;
    const major = cm % 10 === 0;
    ticks.push(
      <g key={cm}>
        <line className="tape__tick" x1={x} x2={x + (major ? 3.2 : 1.6)} y1={y} y2={y} />
        {major && cm > 0 && cm % 20 === 0 && (
          <text className="tape__num" x={x + 3.8} y={y + 1.2}>
            {cm}
          </text>
        )}
      </g>,
    );
  }
  return (
    <g className="tape" aria-hidden="true">
      <rect className="tape__strip" x={x} y={-4} width={8.5} height={floor + 4} />
      {ticks}
      <line className="tape__mark" x1={x - 1} x2={x + 24} y1={0} y2={0} />
      <text className="tape__reading" x={x + 10} y={-1.2}>
        {Math.round(heightCm)} cm
      </text>
    </g>
  );
}
