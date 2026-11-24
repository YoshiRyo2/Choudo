import { useContext, useId, useMemo } from 'react';
import type { BodyMeasurements } from '@choudo/core/domain/body';
import type { FitTone, GarmentFit, ZoneFit } from '@choudo/core/domain/fit';
import { pantsLandmarks, templateOf, topLandmarks, type Garment } from '@choudo/core/domain/garments';
import { bodyGeometry, type Marker } from '@choudo/core/ui-logic/components/Mannequin/geometry';
import { headAnchor, type HeadKind } from '@choudo/core/ui-logic/components/Mannequin/heads';
import { MascotHead, MascotHeadContext } from './MascotHead';
import { affineToSvg, warpPantsPieces, warpPieces, type WarpPiece, type WarpRegion } from '@choudo/core/ui-logic/components/Mannequin/photoWarp';
import { dressShape } from '@choudo/core/ui-logic/components/Mannequin/templates/dress';
import { jacketShape } from '@choudo/core/ui-logic/components/Mannequin/templates/jacket';
import { pantsShape } from '@choudo/core/ui-logic/components/Mannequin/templates/pants';
import { leggingsShape } from '@choudo/core/ui-logic/components/Mannequin/templates/leggings';
import { skirtShape } from '@choudo/core/ui-logic/components/Mannequin/templates/skirt';
import { topShape } from '@choudo/core/ui-logic/components/Mannequin/topShape';
import { usePhotoSize, type PhotoSize } from './usePhotoSize';
import { viewPhoto, type View } from '@choudo/core/ui-logic/components/Mannequin/view';
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
  /** A dress, in place of the top and the bottom (pass neither with it). */
  onepiece?: WornGarment;
  /** A jacket or coat, drawn over the top or the dress (hanging off it when there is one). */
  outer?: WornGarment;
  /** Show coloured fit pins on each zone. */
  showFit?: boolean;
  /**
   * Which photos to warp: only those whose licence allows it (the app), or any
   * (the dev landmark picker's preview, which needs to see every photo it places).
   */
  photos?: 'licensed' | 'all';
  /**
   * How the view is framed; the body is drawn the same either way.
   * - canvas (default): a fixed canvas, so a taller body is drawn taller (the body
   *   screen, where the height is being entered).
   * - body: the view ends just under the feet, so the figure fills its box with no
   *   empty floor below it (the fitting room's stage).
   */
  frame?: 'canvas' | 'body';
  /**
   * Which side to show (default front). The body and every pin are the same either
   * way; garments lose their front-only details and use their back photo, if any.
   */
  view?: View;
  /** Draw the height tape up the left edge (default true). Off where the screen shows no numbers. */
  showHeightTape?: boolean;
  /** The mascot head (default: the stored choice, from MascotHeadContext). A skin: the body is the same under every head. */
  head?: HeadKind;
  /** The face's fit tone (default unknown: a neutral face). No face from the back. */
  face?: FitTone;
  className?: string;
}

/** A dress's zones on its skirt: pinned on the left, as a bottom's are. */
const DRESS_LOWER_ZONES: readonly string[] = ['waist', 'hips', 'length', 'walkingRoom'];

/** Fixed canvas so taller bodies are drawn taller. Units are cm. */
const VIEW = { left: -62, right: 62, top: -6 };

/**
 * A 2D dress-form mannequin scaled to the body, optionally wearing a top and a
 * bottom (or a dress), and a jacket over them. Swap this component out to move
 * to a 3D renderer later.
 */
export function Mannequin({
  body,
  top: shirt,
  bottom,
  onepiece,
  outer,
  showFit = true,
  photos = 'licensed',
  frame = 'canvas',
  view = 'front',
  showHeightTape = true,
  head: headProp,
  face = 'unknown',
  className,
}: MannequinProps) {
  const g = useMemo(() => bodyGeometry(body), [body]);
  const storedHead = useContext(MascotHeadContext);
  const head = headProp ?? storedHead;

  // A dress is drawn as its bodice (in the top's place) and a skirt from the seam (templates/dress.ts).
  const dressSize = onepiece?.garment.sizes.find((s) => s.label === onepiece.sizeLabel);
  const dressDraw = onepiece && dressSize ? dressShape(g, body, onepiece.garment, dressSize.measurements, view) : null;
  const top = shirt ?? (dressDraw ? onepiece : undefined);
  const topSize = shirt?.garment.sizes.find((s) => s.label === shirt.sizeLabel);
  const bottomSize = bottom?.garment.sizes.find((s) => s.label === bottom.sizeLabel);
  const topDraw = shirt && topSize ? topShape(g, shirt.garment, topSize.measurements, body.chestCm, body, { view }) : (dressDraw?.bodice ?? null);
  // Skirts have their own template; pants and shorts share the pants one; leggings draw skin-tight on its outline.
  const bottomTemplate = bottom ? templateOf(bottom.garment) : null;
  const isSkirt = bottomTemplate === 'skirt';
  const skirtDraw = bottom && bottomSize && isSkirt ? skirtShape(g, body, bottom.garment, bottomSize.measurements) : null;
  const legShape = bottomTemplate === 'leggings' ? leggingsShape : pantsShape;
  const bottomDraw = bottom && bottomSize && !isSkirt ? legShape(g, body, bottom.garment, bottomSize.measurements) : null;
  // A dress is dashed as a whole when any of its widths is a fallback.
  const topApproximate = dressDraw?.approximate ?? topDraw?.approximate ?? false;
  // A jacket hangs off the top drawn under it (templates/jacket.ts), with the room the fit gives that top.
  const outerSize = outer?.garment.sizes.find((s) => s.label === outer.sizeLabel);
  const underTop =
    topDraw && top ? { shape: dressDraw?.asUnder ?? topDraw, layer: { garment: top.garment, sizeLabel: top.sizeLabel } } : null;
  const outerDraw = outer && outerSize ? jacketShape(g, body, outer.garment, outerSize.measurements, underTop, view) : null;

  // A product photo of the side shown, when the garment has one, its licence allows
  // warping and the file is present, is warped onto this size's outline over the flat colour.
  const photo = top ? viewPhoto(top.garment, view, photos) : undefined;
  const photoSrc = photo ? `${import.meta.env.BASE_URL}${photo.file}` : null;
  const photoSize = usePhotoSize(photoSrc);
  const topPhoto = photo ? topLandmarks(photo, view) : null;
  const pieces = topDraw && topPhoto && photoSize ? warpPieces(topPhoto, topDraw.landmarks, topDraw.sleeveEdges) : null;
  const bottomPhoto = bottom ? viewPhoto(bottom.garment, view, photos) : undefined;
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

  // From VIEW.top to 4 cm under the floor; the canvas is tall enough for a 204 cm body.
  const viewHeight = frame === 'body' ? body.heightCm + 10 : Math.max(214, body.heightCm + 10);
  // Top pins go on the figure's right edge, bottom pins on the left, so a pants
  // waist pin never looks like it belongs to the shirt covering it.
  const pins: { key: string; at: Marker; side: 1 | -1; zone: ZoneFit }[] = [];
  if (showFit) {
    // Under a jacket the top's pins would sit inside it: the jacket's take the right edge instead.
    const torso = outerDraw && outer ? { key: 'outer', draw: outerDraw, fit: outer.fit } : { key: 'top', draw: topDraw, fit: shirt?.fit };
    for (const z of torso.fit?.zones ?? []) {
      const at = torso.draw?.markers[z.zone as keyof NonNullable<typeof torso.draw>['markers']];
      if (at) pins.push({ key: `${torso.key}-${z.zone}`, at, side: 1, zone: z });
    }
    // A dress: its top half's pins on the right (unless a jacket's are there), its skirt's on the left.
    if (dressDraw && onepiece) {
      for (const z of onepiece.fit?.zones ?? []) {
        const lower = DRESS_LOWER_ZONES.includes(z.zone);
        const at = dressDraw.markers[z.zone as keyof typeof dressDraw.markers];
        if (at && (lower || !outerDraw)) pins.push({ key: `dress-${z.zone}`, at, side: lower ? -1 : 1, zone: z });
      }
    }
    for (const z of bottom?.fit?.zones ?? []) {
      const at = skirtDraw
        ? skirtDraw.markers[z.zone as keyof typeof skirtDraw.markers]
        : bottomDraw?.markers[z.zone as keyof typeof bottomDraw.markers];
      if (at) pins.push({ key: `bottom-${z.zone}`, at, side: -1, zone: z });
    }
  }

  const label = [
    `Mannequin, ${Math.round(body.heightCm)} cm tall${view === 'back' ? ', seen from the back,' : ''}`,
    top ? `wearing ${top.garment.brand} ${top.garment.name} in ${top.sizeLabel}` : null,
    bottom ? `and ${bottom.garment.brand} ${bottom.garment.name} in ${bottom.sizeLabel}` : null,
    outer ? `with ${outer.garment.brand} ${outer.garment.name} in ${outer.sizeLabel} over ${top ? 'it' : 'the body'}` : null,
  ]
    .filter(Boolean)
    .join(' ');

  // From the back a hoodie's hood lies on its upper back, over the top and over a
  // jacket worn on it (a hood comes out over a jacket's collar).
  const hoodOnBack =
    topDraw?.hoodOnBack && top ? (
      <path className={garmentClass(topApproximate, top.garment)} d={topDraw.hoodOnBack} style={{ fill: top.garment.color }} />
    ) : null;

  return (
    <svg
      className={['mannequin', className].filter(Boolean).join(' ')}
      viewBox={`${VIEW.left} ${VIEW.top} ${VIEW.right - VIEW.left} ${viewHeight}`}
      role="img"
      aria-label={label}
    >
      {showHeightTape && <HeightTape heightCm={body.heightCm} x={VIEW.left + 3} />}

      {/* A rounded stand under the feet: drawing only, below the floor the body stands on. */}
      <rect className="mannequin__stand" x={-16} y={g.y.floor + 0.4} width={32} height={2.6} rx={1.3} />

      {/* A hood lying down sits behind the neck: drawn first, so the neck and head hide its middle. */}
      {topDraw?.hood && top && (
        <g className={garmentClass(topApproximate, top.garment)} style={{ fill: top.garment.color }}>
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
      </g>
      {/* The mascot head over the neck, where the head ellipse was: laid out from g.head, never feeding back into the body. */}
      <MascotHead kind={head} face={view === 'back' ? null : face} at={headAnchor(g.head)} className="mannequin__head" />
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
      {skirtDraw && bottom && (
        <path className={garmentClass(skirtDraw.approximate, bottom.garment)} d={skirtDraw.body} style={{ fill: bottom.garment.color }} />
      )}
      {topDraw && top && (
        <g>
          <g className={garmentClass(topApproximate, top.garment)} style={{ fill: top.garment.color }}>
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
          {/* A dress's skirt over the bodice's lower edge, which reads as the waist seam; the arms hang over both. */}
          {dressDraw && <path className={garmentClass(dressDraw.approximate, top.garment)} d={dressDraw.skirt} style={{ fill: top.garment.color }} />}
          {/* Relaxed arms hang in front of the shirt's sides; the sleeves then cover their tops.
              Under a jacket only the outermost layer draws the arms. */}
          {!outerDraw && (
            <g className="mannequin__form">
              <path className="mannequin__arm" d={topDraw.arms[0]} />
              <path className="mannequin__arm" d={topDraw.arms[1]} />
            </g>
          )}
          <g className={garmentClass(topApproximate, top.garment)} style={{ fill: top.garment.color }}>
            <path d={topDraw.sleeves[0]} />
            <path d={topDraw.sleeves[1]} />
          </g>
          {texture('sleeveRight', topDraw.sleeves[0])}
          {texture('sleeveLeft', topDraw.sleeves[1])}
          {/* A warped back photo already shows its hood. */}
          {!outerDraw && !pieces && hoodOnBack}
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

      {outerDraw && outer && (
        <g>
          <g className={garmentClass(outerDraw.approximate, outer.garment)} style={{ fill: outer.garment.color }}>
            <path d={outerDraw.body} />
          </g>
          <g className="mannequin__creases" aria-hidden="true">
            {outerDraw.folds.map((d, i) => (
              <path key={`ofold-${i}`} className="mannequin__fold" d={d} />
            ))}
            {outerDraw.strain.map((d, i) => (
              <path key={`ostrain-${i}`} className="mannequin__strain" d={d} />
            ))}
          </g>
          <g className="mannequin__form">
            <path className="mannequin__arm" d={outerDraw.arms[0]} />
            <path className="mannequin__arm" d={outerDraw.arms[1]} />
          </g>
          <g className={garmentClass(outerDraw.approximate, outer.garment)} style={{ fill: outer.garment.color }}>
            <path d={outerDraw.sleeves[0]} />
            <path d={outerDraw.sleeves[1]} />
            <path d={outerDraw.collar} />
          </g>
          {outerDraw.placket && <path className="mannequin__placket" d={outerDraw.placket} aria-hidden="true" />}
          {hoodOnBack}
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
