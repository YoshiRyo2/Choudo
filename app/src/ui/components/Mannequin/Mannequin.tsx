import { useId, useMemo } from 'react';
import type { BodyMeasurements } from '../../../domain/body';
import type { GarmentFit, ZoneFit } from '../../../domain/fit';
import { canWarp, pantsLandmarks, topLandmarks, type Garment, type GarmentImage } from '../../../domain/garments';
import { bodyGeometry, type Marker } from './geometry';
import { affineToSvg, warpPantsPieces, warpPieces, type WarpPiece, type WarpRegion } from './photoWarp';
import { pantsShape } from './templates/pants';
import { topShape } from './topShape';
import { usePhotoSize, type PhotoSize } from './usePhotoSize';
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
  /**
   * Which photos to warp: only those whose licence allows it (the app), or any
   * (the dev landmark picker's preview, which needs to see every photo it places).
   */
  photos?: 'licensed' | 'all';
  className?: string;
}

/** Fixed canvas so taller bodies are drawn taller. Units are cm. */
const VIEW = { left: -62, right: 62, top: -6 };

/**
 * A 2D dress-form mannequin scaled to the body, optionally wearing a top and a
 * bottom. Swap this component out to move to a 3D renderer later.
 */
export function Mannequin({ body, top, bottom, showFit = true, photos = 'licensed', className }: MannequinProps) {
  const g = useMemo(() => bodyGeometry(body), [body]);

  const topSize = top?.garment.sizes.find((s) => s.label === top.sizeLabel);
  const bottomSize = bottom?.garment.sizes.find((s) => s.label === bottom.sizeLabel);
  const topDraw = top && topSize ? topShape(g, top.garment, topSize.measurements, body.chestCm, body) : null;
  const bottomDraw = bottom && bottomSize ? pantsShape(g, body, bottom.garment, bottomSize.measurements) : null;

  // A product photo, when the garment has one, its licence allows warping and the
  // file is present, is warped onto this size's outline over the flat colour.
  const warpable = (image: GarmentImage | undefined) => (photos === 'all' || canWarp(image) ? image : undefined);
  const photo = warpable(top?.garment.image);
  const photoSrc = photo ? `${import.meta.env.BASE_URL}${photo.file}` : null;
  const photoSize = usePhotoSize(photoSrc);
  const topPhoto = photo ? topLandmarks(photo) : null;
  const pieces = topDraw && topPhoto && photoSize ? warpPieces(topPhoto, topDraw.landmarks, topDraw.sleeveEdges) : null;
  const bottomPhoto = warpable(bottom?.garment.image);
  const bottomSrc = bottomPhoto ? `${import.meta.env.BASE_URL}${bottomPhoto.file}` : null;
  const bottomPhotoSize = usePhotoSize(bottomSrc);
  const pantsPhoto = bottomPhoto ? pantsLandmarks(bottomPhoto) : null;
  const bottomPieces =
    bottomDraw && pantsPhoto && bottomPhotoSize ? warpPantsPieces(pantsPhoto, bottomDraw.landmarks, bottomDraw.limbEdges) : null;
  const clipId = `mq${useId().replace(/[^\w-]/g, '')}`;
  const texture = (region: WarpRegion, outline: string) =>
    pieces && photoSrc && photoSize ? (
      <PhotoTexture
        id={`${clipId}-${region}`}
        outline={outline}
        pieces={pieces.filter((p) => p.region === region)}
        src={photoSrc}
        size={photoSize}
      />
    ) : null;
  const bottomTexture = (region: WarpRegion, outline: string) =>
    bottomPieces && bottomSrc && bottomPhotoSize ? (
      <PhotoTexture
        id={`${clipId}-bottom-${region}`}
        outline={outline}
        pieces={bottomPieces.filter((p) => p.region === region)}
        src={bottomSrc}
        size={bottomPhotoSize}
      />
    ) : null;

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

      {/* A hood lying down sits behind the neck: drawn first, so the neck and head hide its middle. */}
      {topDraw?.hood && top && (
        <g className={garmentClass(topDraw.approximate, top.garment)} style={{ fill: top.garment.color }}>
          <path d={topDraw.hood.back} />
        </g>
      )}

      {/* Body: arms behind the torso so the torso hides where they join. */}
      <g className="mannequin__form">
        <path className="mannequin__arm" d={g.paths.arms[0]} />
        <path className="mannequin__arm" d={g.paths.arms[1]} />
        <path d={g.paths.torso} />
        {g.paths.feet.map((foot, i) => (
          <ellipse key={i} {...foot} />
        ))}
        <rect x={-g.half.neck * 0.8} y={g.y.chin - 2} width={g.half.neck * 1.6} height={6} rx={2} />
        <ellipse cx={g.head.cx} cy={g.head.cy} rx={g.head.rx} ry={g.head.ry} />
      </g>
      <line className="mannequin__seam" x1={0} x2={0} y1={g.y.neckBase + 4} y2={g.y.crotch - 4} />

      {bottomDraw && bottom && (
        <g>
          <path
            className={garmentClass(bottomDraw.approximate, bottom.garment)}
            d={bottomDraw.body}
            style={{ fill: bottom.garment.color }}
          />
          {/* The top (band to crotch) clipped to the whole outline, each leg to its own. */}
          {bottomTexture('body', bottomDraw.body)}
          {bottomTexture('legRight', bottomDraw.legs.right)}
          {bottomTexture('legLeft', bottomDraw.legs.left)}
        </g>
      )}
      {topDraw && top && (
        <g>
          <g className={garmentClass(topDraw.approximate, top.garment)} style={{ fill: top.garment.color }}>
            <path d={topDraw.body} />
          </g>
          {texture('body', topDraw.body)}
          <g className="mannequin__creases" aria-hidden="true">
            {topDraw.folds.map((d, i) => (
              <path key={`fold-${i}`} className="mannequin__fold" d={d} />
            ))}
            {topDraw.strain.map((d, i) => (
              <path key={`strain-${i}`} className="mannequin__strain" d={d} />
            ))}
          </g>
          {/* Relaxed arms hang in front of the shirt's sides; the sleeves then cover their tops. */}
          <g className="mannequin__form">
            <path className="mannequin__arm" d={topDraw.arms[0]} />
            <path className="mannequin__arm" d={topDraw.arms[1]} />
          </g>
          <g className={garmentClass(topDraw.approximate, top.garment)} style={{ fill: top.garment.color }}>
            <path d={topDraw.sleeves[0]} />
            <path d={topDraw.sleeves[1]} />
          </g>
          {texture('sleeveRight', topDraw.sleeves[0])}
          {texture('sleeveLeft', topDraw.sleeves[1])}
          {/* Knits: rib hem band and cuffs over the body and sleeves, then the hood's edge and drawcords. */}
          {topDraw.rib && (
            <g className="mannequin__knit" aria-hidden="true">
              <g className="mannequin__rib" style={{ fill: top.garment.color }}>
                <path d={topDraw.rib.hem} />
                {topDraw.rib.cuffs.map((d, i) => (
                  <path key={`cuff-${i}`} d={d} />
                ))}
              </g>
              {topDraw.rib.lines.map((d, i) => (
                <path key={`rib-${i}`} className="mannequin__rib-line" d={d} />
              ))}
              {topDraw.hood?.edges.map((d, i) => (
                <path key={`hood-${i}`} className="mannequin__hood-edge" d={d} />
              ))}
              {topDraw.hood?.cords.map((d, i) => (
                <path key={`cord-${i}`} className="mannequin__cord" d={d} />
              ))}
            </g>
          )}
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

/**
 * The photo drawn once per warp triangle, each copy clipped to its triangle, the
 * lot clipped to the garment outline, with the outline's edge redrawn on top.
 */
function PhotoTexture({
  id,
  outline,
  pieces,
  src,
  size,
}: {
  id: string;
  outline: string;
  pieces: WarpPiece[];
  src: string;
  size: PhotoSize;
}) {
  return (
    <g aria-hidden="true">
      <defs>
        <clipPath id={id}>
          <path d={outline} />
        </clipPath>
        {pieces.map((p, i) => (
          <clipPath key={i} id={`${id}-${i}`}>
            <polygon points={p.clip.map((q) => `${q.x},${q.y}`).join(' ')} />
          </clipPath>
        ))}
      </defs>
      <g clipPath={`url(#${id})`}>
        {pieces.map((p, i) => (
          <g key={i} clipPath={`url(#${id}-${i})`}>
            <image
              href={src}
              width={size.width}
              height={size.height}
              preserveAspectRatio="none"
              transform={affineToSvg(p.transform)}
            />
          </g>
        ))}
      </g>
      <path className="mannequin__garment-edge" d={outline} />
    </g>
  );
}

/**
 * is-approximate: the width is our guess (girth method unknown) — a clear dash.
 * is-estimated: drawn from numbers that include our estimates — a subtler dash.
 */
const garmentClass = (approximate: boolean, garment: Pick<Garment, 'grade'>) =>
  [
    'mannequin__garment',
    approximate ? 'is-approximate' : garment.grade === 'estimated' ? 'is-estimated' : null,
  ]
    .filter(Boolean)
    .join(' ');

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
