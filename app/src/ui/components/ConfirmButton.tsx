import { useState } from 'react';

interface ConfirmButtonProps {
  label: string;
  confirmLabel: string;
  onConfirm: () => void;
  className?: string;
}

/** A button that needs a second tap: "Delete" becomes "Tap again to delete". */
export function ConfirmButton({ label, confirmLabel, onConfirm, className = 'button button--quiet button--small' }: ConfirmButtonProps) {
  const [armed, setArmed] = useState(false);
  return (
    <button
      type="button"
      className={`${className}${armed ? ' is-armed' : ''}`}
      onClick={() => (armed ? onConfirm() : setArmed(true))}
      onBlur={() => setArmed(false)}
    >
      {armed ? confirmLabel : label}
    </button>
  );
}
