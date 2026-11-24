import { affineToSvg, type WarpPiece } from '@choudo/core/ui-logic/components/Mannequin/photoWarp';
import { ClipPath, Defs, G, Image, Path, Polygon, Use } from 'react-native-svg';

import type { PhotoSource } from './garment-photos';
import { paint } from './paint';

/**
 * A garment photo, declared once (not drawn): every warp triangle of every region draws
 * it with a <Use>, so the phone loads and decodes it once, not once per triangle.
 */
export function PhotoDef({ id, photo }: { id: string; photo: PhotoSource }) {
  return (
    <Defs>
      <Image id={id} href={photo.module} width={photo.width} height={photo.height} preserveAspectRatio="none" />
    </Defs>
  );
}

/**
 * The photo (a PhotoDef) drawn once per warp triangle, each copy clipped to its triangle,
 * the lot clipped to the garment outline, with the outline's edge redrawn on top (the web
 * PhotoTexture).
 */
export function PhotoTexture({ id, outline, pieces, photoId }: { id: string; outline: string; pieces: WarpPiece[]; photoId: string }) {
  return (
    <G>
      <Defs>
        <ClipPath id={id}>
          <Path d={outline} />
        </ClipPath>
        {pieces.map((p, i) => (
          <ClipPath key={i} id={`${id}-${i}`}>
            <Polygon points={p.clip.map((q) => `${q.x},${q.y}`).join(' ')} />
          </ClipPath>
        ))}
      </Defs>
      <G clipPath={`url(#${id})`}>
        {pieces.map((p, i) => (
          <G key={i} clipPath={`url(#${id}-${i})`}>
            <Use href={`#${photoId}`} transform={affineToSvg(p.transform)} />
          </G>
        ))}
      </G>
      <Path {...paint.garmentEdge} d={outline} />
    </G>
  );
}
