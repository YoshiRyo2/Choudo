import { useState } from 'react';
import { Image, StyleSheet } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';
import type { Garment } from '@choudo/core/domain/garments';
import { thumbPhotoSrc } from '@choudo/core/ui-logic/components/garmentThumb';

import { colors, radius } from '@/theme';

import { photoSource } from './mannequin/garment-photos';

/**
 * The garment's picture on browse cards (the web GarmentIcon): its front photo, shown as
 * it is, when the licence allows (thumbPhotoSrc) and the photo ships in the app; otherwise,
 * or if the photo fails to load, a little flat drawing in its colour. Decorative: the card
 * already names the garment.
 */
export function GarmentIcon({ garment }: { garment: Garment }) {
  const [failed, setFailed] = useState(false);
  const photo = thumbPhotoSrc(garment, '') !== null && garment.image ? photoSource(garment.image.file) : null;
  if (photo && !failed) {
    return (
      <Image
        testID="garment-photo"
        source={photo.module}
        resizeMode="contain"
        style={styles.photo}
        accessible={false}
        onError={() => setFailed(true)}
      />
    );
  }
  return <GarmentDrawing garment={garment} />;
}

/** The web's flat drawing, path for path. */
function GarmentDrawing({ garment }: { garment: Garment }) {
  const stroke = { stroke: colors.ink, strokeOpacity: 0.55 };
  let d: string;
  if (garment.type === 'skirt') {
    d = 'M18 6 H42 L44 16 L54 56 H6 L16 16 Z';
  } else if (garment.type === 'shorts') {
    d = 'M12 6 H48 L54 36 H34 L30 22 L26 36 H6 Z';
  } else if (garment.type === 'leggings') {
    // Narrow legs tapering to the ankle.
    d = 'M16 6 H44 L41 58 H34 L30 24 L26 58 H19 Z';
  } else if (garment.category === 'bottom') {
    const wide = garment.type === 'trousers' ? 4 : garment.type === 'joggers' ? -2 : 0;
    d = `M14 6 H46 L${50 + wide} 58 H${34} L30 24 L26 58 H${10 - wide} Z`;
  } else if (garment.category === 'onepiece') {
    // A dress: short sleeves, a fitted waist and a skirt to the knee.
    d = 'M22 4 Q30 10 38 4 L50 8 L56 20 L47 23 L43 18 L41 30 L52 60 H8 L19 30 L17 18 L13 23 L4 20 L10 8 Z';
  } else if (garment.category === 'outer') {
    // A jacket: long sleeves, a stand collar, and a little longer than a top.
    d = 'M21 4 L30 9 L39 4 L51 9 L59 52 L51 54 L45 24 L45 60 H15 L15 24 L9 54 L1 52 L9 9 Z';
  } else if (garment.sleeve === 'long') {
    d = 'M22 6 Q30 12 38 6 L50 10 L58 50 L50 52 L44 22 L44 58 H16 L16 22 L10 52 L2 50 L10 10 Z';
  } else {
    d = 'M22 6 Q30 12 38 6 L52 12 L58 26 L48 30 L44 24 L44 58 H16 L16 24 L12 30 L2 26 L8 12 Z';
  }
  return (
    <Svg viewBox="0 0 60 64" width={56} height={60} accessible={false}>
      <Path d={d} fill={garment.color} {...stroke} strokeWidth={1.2} strokeLinejoin="round" />
      {garment.type === 'button-up' && <Line x1={30} y1={11} x2={30} y2={58} {...stroke} strokeWidth={1} />}
      {garment.category === 'outer' && <Line x1={30} y1={9} x2={30} y2={60} {...stroke} strokeWidth={1} />}
      {garment.type === 'polo' && <Path d="M26 9 L30 18 L34 9" fill="none" {...stroke} strokeWidth={1} />}
    </Svg>
  );
}

const styles = StyleSheet.create({
  // The whole photo, unaltered, in the drawing's 56 × 60 box; the padding keeps sleeve
  // tips clear of the rounded corners (GarmentIcon.css).
  photo: { width: 56, height: 60, padding: 2, backgroundColor: colors.bg, borderRadius: radius.s },
});
