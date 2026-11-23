import { useEffect, useId, useRef, type ReactNode } from 'react';
import './Sheet.css';

interface SheetProps {
  title: string;
  /** Small line above the title, e.g. the brand. */
  kicker?: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * A panel over the current screen (from the bottom on phones). Built on
 * <dialog> so focus stays inside and Escape closes it.
 */
export function Sheet({ title, kicker, onClose, children }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  // Unmounting removes it from the top layer, so no close() on cleanup (which
  // would fire onClose and, under StrictMode's double effects, shut it at once).
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    // showModal focuses the first button (Close); move to a field that asks for it.
    dialog?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
  }, []);

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        // A tap on the dimmed backdrop (the dialog box itself, outside the panel) closes it.
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="sheet__panel">
        <header className="sheet__head">
          <div>
            {kicker && <p className="sheet__brand">{kicker}</p>}
            <h2 id={titleId} className="sheet__name">
              {title}
            </h2>
          </div>
          <button type="button" className="sheet__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
