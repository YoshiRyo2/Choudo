import { useEffect, useState } from 'react';

export interface PhotoSize {
  width: number;
  height: number;
}

/**
 * Loads a garment photo and reports its pixel size once it's ready, or null while
 * loading or when the file isn't there (photos aren't committed, so a fresh
 * checkout won't have them). Callers draw the flat colour until this is non-null.
 */
export function usePhotoSize(src: string | null): PhotoSize | null {
  const [loaded, setLoaded] = useState<{ src: string; size: PhotoSize } | null>(null);

  useEffect(() => {
    if (!src) return;
    let live = true;
    const img = new Image();
    img.onload = () => {
      if (live) setLoaded({ src, size: { width: img.naturalWidth, height: img.naturalHeight } });
    };
    img.src = src;
    return () => {
      live = false;
    };
  }, [src]);

  return loaded && loaded.src === src ? loaded.size : null;
}
