/**
 * Moving focus from a script without a ring a tap wouldn't have drawn.
 *
 * Some controls are re-created when they're used (the Show chip lives in the
 * carousel, which remounts when the scope changes), so focus is put back on the
 * new one for keyboard and screen-reader users. Browsers may draw a focus ring for
 * focus a script moves, even after a tap (iOS Safari does); a tapped button has
 * none, so after a pointer tap the element is marked and styles.css hides the ring
 * until it's blurred or a key is pressed on it.
 */

/** True when a click came from a pointer, false for Enter / Space (detail 0). */
export function clickedByPointer(event: { detail: number }): boolean {
  return event.detail > 0;
}

/** Focus `el`; after a pointer tap, without a ring until a key is pressed. */
export function refocus(el: HTMLElement, afterPointer: boolean): void {
  if (afterPointer) {
    el.dataset.pointerFocus = '';
    const clear = () => {
      delete el.dataset.pointerFocus;
      el.removeEventListener('blur', clear);
      el.removeEventListener('keydown', clear);
    };
    el.addEventListener('blur', clear);
    el.addEventListener('keydown', clear);
  }
  el.focus();
}
