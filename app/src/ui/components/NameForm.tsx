import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { MAX_NAME_LENGTH } from '@choudo/core/ui-logic/state/closet';
import './NameForm.css';

interface NameFormProps {
  label: string;
  submitLabel: string;
  initial?: string;
  placeholder?: string;
  /** Allow saving with an empty box (the caller fills in a default name). */
  allowBlank?: boolean;
  onSubmit: (name: string) => void;
  onCancel?: () => void;
  autoFocus?: boolean;
}

/** One text box and a button, for naming folders and outfits. */
export function NameForm({ label, submitLabel, initial = '', placeholder, allowBlank, onSubmit, onCancel, autoFocus }: NameFormProps) {
  const id = useId();
  const [name, setName] = useState(initial);
  const input = useRef<HTMLInputElement>(null);

  // Outside a Sheet nothing else moves focus, so take it here (a Sheet re-focuses it after opening).
  useEffect(() => {
    if (autoFocus) input.current?.focus();
  }, [autoFocus]);
  const blank = name.trim() === '';

  function submit(e: FormEvent) {
    e.preventDefault();
    if (blank && !allowBlank) return;
    onSubmit(name);
    setName('');
  }

  return (
    <form className="name-form" onSubmit={submit}>
      <label htmlFor={id} className="name-form__label">
        {label}
      </label>
      <div className="name-form__row">
        <input
          ref={input}
          id={id}
          className="name-form__input"
          value={name}
          maxLength={MAX_NAME_LENGTH}
          placeholder={placeholder}
          // Sheet focuses this after opening; React's autoFocus would be overridden by showModal.
          data-autofocus={autoFocus || undefined}
          autoComplete="off"
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit" className="button button--primary button--small" disabled={blank && !allowBlank}>
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="button button--quiet button--small" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
