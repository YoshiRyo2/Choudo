import { affineToSvg, type WarpPiece } from '@choudo/core/ui-logic/components/Mannequin/photoWarp';
import { ClipPath, Defs, G, Image, Path, Polygon } from 'react-native-svg';

import type { PhotoSource } from './garment-photos';
import { paint } from './paint';

/**
 * The photo drawn once per warp triangle, each copy clipped to its triangle, the
 * lot clipped to the garment outline, with the outline's edge redrawn on top (the web
 * PhotoTexture).
 */
export function PhotoTexture({ id, outline, pieces, photo }: { id: string; outline: string; pieces: WarpPiece[]; photo: PhotoSource }) {
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
            <Image
              href={photo.module}
              width={photo.width}
              height={photo.height}
              preserveAspectRatio="none"
              transform={affineToSvg(p.transform)}
            />
          </G>
        ))}
      </G>
      <Path {...paint.garmentEdge} d={outline} />
    </G>
  );
}
