/**
 * The size picker's single scrolling row. Pure.
 */

/**
 * The row's scrollLeft that puts a chip in its middle, kept within the row's
 * scroll range. `offsetLeft` is the chip's left edge from the row's content start.
 */
export function centredScrollLeft(
  row: { clientWidth: number; scrollWidth: number },
  chip: { offsetLeft: number; width: number },
): number {
  const max = Math.max(0, row.scrollWidth - row.clientWidth);
  const centred = chip.offsetLeft + chip.width / 2 - row.clientWidth / 2;
  return Math.min(max, Math.max(0, centred));
}
