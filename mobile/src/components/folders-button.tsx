import { Button } from './button';

/** "Add to folder" on a tile, or how many folders it's in (the web FoldersButton). */
export function FoldersButton({ count, onPress }: { count: number; onPress: () => void }) {
  return <Button variant="quiet" size="sm" title={count > 0 ? `In ${count} folder${count === 1 ? '' : 's'}` : 'Add to folder'} onPress={onPress} />;
}
