import { useLayoutEffect, useRef, useState } from 'react';
import { claimStampDrop } from '../../state/stampSeen';

/**
 * Whether the stamp for `key` (null: no stamp) should play its drop now: true from the
 * render it first shows in this session until the key changes. Claimed in a layout
 * effect, before paint, so the stamp never flashes in still and then drops.
 */
export function useStampDrop(key: string | null, claim: (key: string) => boolean = claimStampDrop): boolean {
  const [dropping, setDropping] = useState<string | null>(null);
  // The key last looked at: Strict Mode's second effect run must not claim (and lose) it again.
  const seen = useRef<string | null | undefined>(undefined);
  useLayoutEffect(() => {
    if (seen.current === key) return;
    seen.current = key;
    setDropping(key !== null && claim(key) ? key : null);
  }, [key, claim]);
  return key !== null && dropping === key;
}
