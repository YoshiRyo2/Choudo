import { useContext, useId, useMemo, useState } from 'react';
import { View as RNView, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Ellipse, G, Line, Path, Rect, Circle } from 'react-native-svg';
import type { BodyMeasurements } from '@choudo/core/domain/body';
import type { FitTone, GarmentFit, ZoneFit } from '@choudo/core/domain/fit';
import { pantsLandmarks, templateOf, topLandmarks, type Garment } from '@choudo/core/domain/garments';
import { bodyGeometry, type Marker } from '@choudo/core/ui-logic/components/Mannequin/geometry';
import { headAnchor, type HeadKind } from '@choudo/core/ui-logic/components/Mannequin/heads';
import { warpPantsPieces, warpPieces, type WarpRegion } from '@choudo/core/ui-logic/components/Mannequin/photoWarp';
import { dressShape } from '@choudo/core/ui-logic/components/Mannequin/templates/dress';
import { jacketShape } from '@choudo/core/ui-logic/components/Mannequin/templates/jacket';
import { leggingsShape } from '@choudo/core/ui-logic/components/Mannequin/templates/leggings';
import { pantsShape } from '@choudo/core/ui-logic/components/Mannequin/templates/pants';
import { skirtShape } from '@choudo/core/ui-logic/components/Mannequin/templates/skirt';
import { topShape } from '@choudo/core/ui-logic/components/Mannequin/topShape';
import { viewPhoto, type View } from '@choudo/core/ui-logic/components/Mannequin/view';

import { photoSource } from './garment-photos';
import { MascotHeadContext } from './head-context';
import { HeightTape } from './height-tape';
import { MascotHead } from './mascot-head';
import { paint, px } from './paint';
import { PhotoDef, PhotoTexture } from './photo-texture';

export interface WornGarment {
  garment: Garment;
  sizeLabel: string;
  fit?: GarmentFit;
}

export interface MannequinProps {
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
   * Kept for the web's interface (its 'all' is for the dev landmark picker). The phone
   * only ever warps photos whose licence allows it (canWarp), whichever is passed.
   */
  photos?: 'licensed' | 'all';
  /**
   * How the view is framed; the body is drawn the same either way.
   * - canvas (default): a fixed canvas, so a taller body is drawn taller (the Body screen).
   * - body: the view ends just under the feet, so the figure fills its box (the fitting room).
   */
  frame?: 'canvas' | 'body';
  /** Which side to show (default front). Garments lose their front-only details and use their back photo, if any. */
  view?: View;
  /** Draw the height tape up the left edge (default true). */
  showHeightTape?: boolean;
  /** The mascot head (default: the stored choice, from MascotHeadContext). A skin: the body is the same under every head. */
  head?: HeadKind;
  /** The face's fit tone (default unknown: a neutral face). No face from the back. */
  face?: FitTone;
  style?: StyleProp<ViewStyle>;
}

/** A dress's zones on its skirt: pinned on the left, as a bottom's are. */
const DRESS_LOWER_ZONES: readonly string[] = ['waist', 'hips', 'length', 'walkingRoom'];

/** Fixed canvas so taller bodies are drawn taller. Units are cm. */
const VIEW = { left: -62, right: 62, top: -6 };
const VIEW_WIDTH = VIEW.right - VIEW.left;

/**
 * A 2D dress-form mannequin scaled to the body, optionally wearing a top and a
 * bottom (or a dress), and a jacket over them: the web Mannequin.tsx, painted with
 * react-native-svg. Every shape comes from @choudo/core; this only paints them. Swap
 * this component out to move to a 3D renderer later.
 */
export function Mannequin({
  body,
  top: shirt,
  bottom,
  onepiece,
  outer,
  showFit = true,
  frame = 'canvas',
  view = 'front',
  showHeightTape = true,
  head: headProp,
  face = 'unknown',
  style,
}: MannequinProps) {
  const g = useMemo(() => bodyGeometry(body), [body]);
  const storedHead = useContext(MascotHeadContext);
  const head = headProp ?? storedHead;
  const [box, setBox] = useState({ width: 0, height: 0 });

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
  // warping and the file is bundled, is warped onto this size's outline over the flat colour.
  const photo = top ? viewPhoto(top.garment, view, 'licensed') : undefined;
  const photoSrc = photo ? photoSource(photo.file) : null;
  const topPhoto = photo ? topLandmarks(photo, view) : null;
  const pieces = topDraw && topPhoto && photoSrc ? warpPieces(topPhoto, topDraw.landmarks, topDraw.sleeveEdges) : null;
  const bottomPhoto = bottom ? viewPhoto(bottom.garment, view, 'licensed') : undefined;
  const bottomSrc = bottomPhoto ? photoSource(bottomPhoto.file) : null;
  const pantsPhoto = bottomPhoto ? pantsLandmarks(bottomPhoto) : null;
  const bottomPieces =
    bottomDraw && pantsPhoto && bottomSrc ? warpPantsPieces(pantsPhoto, bottomDraw.landmarks, bottomDraw.limbEdges) : null;
  const clipId = `mq${useId().replace(/[^\w-]/g, '')}`;
  const texture = (region: WarpRegion, outline: string) =>
    pieces && photoSrc ? (
      <PhotoTexture
        id={`${clipId}-${region}`}
        outline={outline}
        pieces={pieces.filter((p) => p.region === region)}
        photoId={`${clipId}-photo`}
      />
    ) : null;
  const bottomTexture = (region: WarpRegion, outline: string) =>
    bottomPieces && bottomSrc ? (
      <PhotoTexture
        id={`${clipId}-bottom-${region}`}
        outline={outline}
        pieces={bottomPieces.filter((p) => p.region === region)}
        photoId={`${clipId}-bottom-photo`}
      />
    ) : null;

  // From VIEW.top to 4 cm under the floor; the canvas is tall enough for a 204 cm body.
  const viewHeight = frame === 'body' ? body.heightCm + 10 : Math.max(214, body.heightCm + 10);
  // Screen-point line widths: the drawing is fitted into the box (xMidYMid meet), so its
  // drawn width is the box's width, or less when the box is wider than the figure.
  const drawnWidth = box.width > 0 && box.height > 0 ? Math.min(box.width, (box.height * VIEW_WIDTH) / viewHeight) : box.width;
  const unit = px(1, drawnWidth);

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
    topDraw?.hoodOnBack && top ? <Path {...garmentPaint(topApproximate, top.garment)} fill={top.garment.color} d={topDraw.hoodOnBack} /> : null;

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setBox((b) => (b.width === width && b.height === height ? b : { width, height }));
  };

  return (
    <RNView style={[FILL, style]} onLayout={onLayout} accessible accessibilityRole="image" accessibilityLabel={label}>
      {/* Mannequin.css: overflow visible, so a fit pin past the view box (a big jacket on a short body) still shows. */}
      <Svg width="100%" height="100%" viewBox={`${VIEW.left} ${VIEW.top} ${VIEW_WIDTH} ${viewHeight}`} style={SPILL}>
        {showHeightTape && <HeightTape heightCm={body.heightCm} x={VIEW.left + 3} />}

        {/* A rounded stand under the feet: drawing only, below the floor the body stands on. */}
        <Rect {...paint.stand} x={-16} y={g.y.floor + 0.4} width={32} height={2.6} rx={1.3} />

        {/* A hood lying down sits behind the neck: drawn first, so the neck and head hide its middle. */}
        {topDraw?.hood && top && <Path {...garmentPaint(topApproximate, top.garment)} fill={top.garment.color} d={topDraw.hood.back} />}

        {/* Body: arms behind the torso so the torso hides where they join. */}
        <G>
          <Path {...paint.arm(unit)} d={g.paths.arms[0]} />
          <Path {...paint.arm(unit)} d={g.paths.arms[1]} />
          <Path {...paint.form(unit)} d={g.paths.torso} />
          {g.paths.feet.map((foot, i) => (
            <Ellipse key={i} {...paint.form(unit)} {...foot} />
          ))}
          <Rect {...paint.form(unit)} x={-g.half.neck * 0.8} y={g.y.chin - 2} width={g.half.neck * 1.6} height={6} rx={2} />
        </G>
        {/* The mascot head over the neck: laid out from g.head, never feeding back into the body. */}
        <MascotHead kind={head} face={view === 'back' ? null : face} at={headAnchor(g.head)} unit={unit} />
        <Line {...paint.seam(unit)} x1={0} x2={0} y1={g.y.neckBase + 4} y2={g.y.crotch - 4} />

        {bottomDraw && bottom && (
          <G>
            <Path {...garmentPaint(bottomDraw.approximate, bottom.garment)} fill={bottom.garment.color} d={bottomDraw.body} />
            {bottomPieces && bottomSrc && <PhotoDef id={`${clipId}-bottom-photo`} photo={bottomSrc} />}
            {/* The top (band to crotch) clipped to the whole outline, each leg to its own. */}
            {bottomTexture('body', bottomDraw.body)}
            {bottomTexture('legRight', bottomDraw.legs.right)}
            {bottomTexture('legLeft', bottomDraw.legs.left)}
          </G>
        )}
        {skirtDraw && bottom && (
          <Path {...garmentPaint(skirtDraw.approximate, bottom.garment)} fill={bottom.garment.color} d={skirtDraw.body} />
        )}
        {topDraw && top && (
          <G>
            <Path {...garmentPaint(topApproximate, top.garment)} fill={top.garment.color} d={topDraw.body} />
            {pieces && photoSrc && <PhotoDef id={`${clipId}-photo`} photo={photoSrc} />}
            {texture('body', topDraw.body)}
            <G>
              {topDraw.folds.map((d, i) => (
                <Path key={`fold-${i}`} {...paint.fold} d={d} />
              ))}
              {topDraw.strain.map((d, i) => (
                <Path key={`strain-${i}`} {...paint.strain} d={d} />
              ))}
            </G>
            {/* A dress's skirt over the bodice's lower edge, which reads as the waist seam; the arms hang over both. */}
            {dressDraw && <Path {...garmentPaint(dressDraw.approximate, top.garment)} fill={top.garment.color} d={dressDraw.skirt} />}
            {/* Relaxed arms hang in front of the shirt's sides; the sleeves then cover their tops.
                Under a jacket only the outermost layer draws the arms. */}
            {!outerDraw && (
              <G>
                <Path {...paint.arm(unit)} d={topDraw.arms[0]} />
                <Path {...paint.arm(unit)} d={topDraw.arms[1]} />
              </G>
            )}
            <G>
              <Path {...garmentPaint(topApproximate, top.garment)} fill={top.garment.color} d={topDraw.sleeves[0]} />
              <Path {...garmentPaint(topApproximate, top.garment)} fill={top.garment.color} d={topDraw.sleeves[1]} />
            </G>
            {texture('sleeveRight', topDraw.sleeves[0])}
            {texture('sleeveLeft', topDraw.sleeves[1])}
            {/* A warped back photo already shows its hood. */}
            {!outerDraw && !pieces && hoodOnBack}
            {/* Knits: rib hem band and cuffs over the body and sleeves, then the hood's edge and drawcords. */}
            {topDraw.rib && (
              <G>
                <G>
                  <Path {...paint.rib(top.garment.color)} d={topDraw.rib.hem} />
                  {topDraw.rib.cuffs.map((d, i) => (
                    <Path key={`cuff-${i}`} {...paint.rib(top.garment.color)} d={d} />
                  ))}
                </G>
                {topDraw.rib.lines.map((d, i) => (
                  <Path key={`rib-${i}`} {...paint.ribLine} d={d} />
                ))}
                {topDraw.hood?.edges.map((d, i) => (
                  <Path key={`hood-${i}`} {...paint.hoodEdge} d={d} />
                ))}
                {topDraw.hood?.cords.map((d, i) => (
                  <Path key={`cord-${i}`} {...paint.cord} d={d} />
                ))}
              </G>
            )}
          </G>
        )}

        {outerDraw && outer && (
          <G>
            <Path {...garmentPaint(outerDraw.approximate, outer.garment)} fill={outer.garment.color} d={outerDraw.body} />
            <G>
              {outerDraw.folds.map((d, i) => (
                <Path key={`ofold-${i}`} {...paint.fold} d={d} />
              ))}
              {outerDraw.strain.map((d, i) => (
                <Path key={`ostrain-${i}`} {...paint.strain} d={d} />
              ))}
            </G>
            <G>
              <Path {...paint.arm(unit)} d={outerDraw.arms[0]} />
              <Path {...paint.arm(unit)} d={outerDraw.arms[1]} />
            </G>
            <G>
              <Path {...garmentPaint(outerDraw.approximate, outer.garment)} fill={outer.garment.color} d={outerDraw.sleeves[0]} />
              <Path {...garmentPaint(outerDraw.approximate, outer.garment)} fill={outer.garment.color} d={outerDraw.sleeves[1]} />
              <Path {...garmentPaint(outerDraw.approximate, outer.garment)} fill={outer.garment.color} d={outerDraw.collar} />
            </G>
            {outerDraw.placket && <Path {...paint.placket} d={outerDraw.placket} />}
            {hoodOnBack}
          </G>
        )}

        {pins.map(({ key, at, side, zone }) => (
          <G key={key} testID={`pin-${key}`} transform={`translate(${side * (at.x + 2.4)} ${at.y})`}>
            <Line {...paint.pin[zone.tone].line} x1={-side * 2.4} x2={0} y1={0} y2={0} />
            <Circle {...paint.pin[zone.tone].circle} r={1.9} />
          </G>
        ))}
      </Svg>
    </RNView>
  );
}

/**
 * Approximate: the width is our guess (girth method unknown) — a clear dash.
 * Estimated: drawn from numbers that include our estimates — a subtler dash.
 */
/** The figure fills its box, and may spill past it (Mannequin.css overflow: visible). */
const FILL: ViewStyle = { width: '100%', height: '100%', overflow: 'visible' };
const SPILL: ViewStyle = { overflow: 'visible' };

const garmentPaint = (approximate: boolean, garment: Pick<Garment, 'grade'>) =>
  approximate ? paint.garmentApproximate : garment.grade === 'estimated' ? paint.garmentEstimated : paint.garment;
