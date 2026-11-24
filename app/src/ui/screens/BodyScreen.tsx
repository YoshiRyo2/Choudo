import { useId, useMemo, useState, type FormEvent } from 'react';
import {
  estimateBody,
  validateBodyInput,
  type BodyInput,
  type BodyModel,
  type BodyType,
} from '@choudo/core/domain/body';
import { cmToIn, round } from '@choudo/core/domain/units';
import { AboutSheet } from '../components/AboutSheet';
import { Mannequin } from '../components/Mannequin/Mannequin';
import { FieldError, NumberInput } from '../components/NumberInput';
import { SegmentedControl } from '../components/SegmentedControl';
import { Wordmark } from '../components/Wordmark';
import type { UnitSystem } from '@choudo/core/ui-logic/state/stored';
import {
  braSizeProblemText,
  EMPTY_FORM,
  formToInput,
  inputToForm,
  OVERRIDE_FIELDS,
  switchUnits,
  type BodyForm,
  type OverrideField,
} from '@choudo/core/ui-logic/screens/bodyForm';
import { ALL_FIELDS, fieldErrors, forgetIfFixed, reveal, shownErrors, type FormField } from '@choudo/core/ui-logic/screens/bodyFieldErrors';
import { previewBody } from '@choudo/core/ui-logic/screens/bodyPreview';
import './BodyScreen.css';

interface BodyScreenProps {
  initial: BodyInput | null;
  units: UnitSystem;
  onDone: (input: BodyInput, units: UnitSystem) => void;
  /** Present when there's a saved body to go back to. */
  onCancel?: () => void;
  /** Edit body only: the tee or style other tops are judged against. */
  fitReference?: FitReferenceProps;
  /** Edit body only: the hidden switch for the 10-person fit test. */
  testMode?: { on: boolean; onChange: (on: boolean) => void };
}

interface FitReferenceProps {
  line: string;
  isSet: boolean;
  /** Leave for the fit-reference step, passing the form's body if it's valid. */
  onChange: (input: BodyInput | null, units: UnitSystem) => void;
  onRemove: () => void;
}

const OVERRIDE_LABEL: Record<OverrideField, string> = {
  chest: 'Chest',
  waist: 'Waist',
  hips: 'Hips',
  inseam: 'Inseam',
};

const OVERRIDE_HINT: Record<OverrideField, string> = {
  chest: 'Fullest part, under the arms',
  waist: 'Where your trousers sit',
  hips: 'Fullest part of the seat',
  inseam: 'Crotch to floor, no shoes',
};

/** A women's body measures the full bust where a men's measures the chest. */
const overrideLabel = (field: OverrideField, bodyType: BodyType) =>
  field === 'chest' && bodyType === 'womens' ? 'Full bust' : OVERRIDE_LABEL[field];
const overrideHint = (field: OverrideField, bodyType: BodyType) =>
  field === 'chest' && bodyType === 'womens' ? 'Fullest part, tape level all round' : OVERRIDE_HINT[field];

export function BodyScreen({ initial, units, onDone, onCancel, fitReference, testMode }: BodyScreenProps) {
  const [form, setForm] = useState<BodyForm>(() =>
    initial ? inputToForm(initial, units) : { ...EMPTY_FORM, units },
  );
  const [showTape, setShowTape] = useState(() => Boolean(initial?.overrides));
  const [submitted, setSubmitted] = useState(false);
  // Fields whose error may show: each after it loses focus, all after a submit.
  const [revealed, setRevealed] = useState<ReadonlySet<FormField>>(() => new Set());
  const [about, setAbout] = useState(false);
  const formId = useId();

  const input = useMemo(() => formToInput(form), [form]);
  const braProblem = braSizeProblemText(form);
  const errors = useMemo(() => fieldErrors(form), [form]);
  const shown = shownErrors(errors, revealed);
  const model: BodyModel | null = useMemo(
    () => (input && validateBodyInput(input).length === 0 ? estimateBody(input) : null),
    [input],
  );

  const metric = form.units === 'metric';
  const lengthUnit = metric ? 'cm' : 'in';
  const set = (patch: Partial<BodyForm>) => setForm((f) => ({ ...f, ...patch }));
  /** Typing into a field: its error hides as soon as it's right, and shows again only on blur. */
  const edit = (field: FormField, next: BodyForm) => {
    setForm(next);
    setRevealed((r) => forgetIfFixed(r, field, fieldErrors(next)));
  };
  const setOverride = (field: OverrideField, value: string) =>
    edit(field, { ...form, overrides: { ...form.overrides, [field]: value } });
  const blur = (field: FormField) => () => setRevealed((r) => reveal(r, [field]));
  const errorId = (field: FormField) => `${formId}-${field}-error`;

  const missing = !input;
  const canSubmit = model !== null && braProblem === undefined;

  function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    setRevealed((r) => reveal(r, ALL_FIELDS));
    if (input && model && !braProblem) onDone(input, form.units);
  }

  /** Our estimate for a field, in the form's units — shown as the placeholder. */
  const estimate = (field: OverrideField) => {
    if (!model) return '';
    const cm = model.measurements[`${field}Cm` as const];
    return String(round(metric ? cm : cmToIn(cm), metric ? 0 : 1));
  };

  const fieldError = (name: FormField) => shown[name];
  const preview = previewBody(model, form.bodyType);

  return (
    <main className="body-screen">
      <form className="body-screen__form" onSubmit={submit} noValidate aria-describedby={`${formId}-privacy`}>
        <header className="body-screen__intro">
          <Wordmark />
          <h1>Your measurements</h1>
          <p className="body-screen__lede">
            Height and weight are enough to start. We’ll compare them with each brand’s size chart.
          </p>
        </header>

        <div className="field-row">
          <SegmentedControl
            label="Units"
            value={form.units}
            options={[
              { value: 'metric', label: 'cm, kg' },
              { value: 'imperial', label: 'ft, lb' },
            ]}
            onChange={(u) => setForm((f) => switchUnits(f, u))}
          />
        </div>
        <div className="field-row">
          <SegmentedControl
            label="Size me in"
            value={form.bodyType}
            options={[
              { value: 'womens', label: 'Women’s clothes' },
              { value: 'mens', label: 'Men’s clothes' },
            ]}
            onChange={(bodyType) => set({ bodyType })}
          />
        </div>

        <fieldset className="measure">
          <legend>Height</legend>
          {metric ? (
            <NumberInput
              id={`${formId}-h`}
              label="Height"
              unit="cm"
              value={form.heightCm}
              onChange={(heightCm) => edit('height', { ...form, heightCm })}
              onBlur={blur('height')}
              invalid={Boolean(fieldError('height'))}
              errorId={errorId('height')}
              autoFocus={!initial}
            />
          ) : (
            <div className="measure__pair">
              <NumberInput
                id={`${formId}-ft`}
                label="Feet"
                unit="ft"
                value={form.heightFt}
                onChange={(heightFt) => edit('height', { ...form, heightFt })}
                onBlur={blur('height')}
                invalid={Boolean(fieldError('height'))}
                errorId={errorId('height')}
                autoFocus={!initial}
              />
              <NumberInput
                id={`${formId}-in`}
                label="Inches"
                unit="in"
                value={form.heightIn}
                onChange={(heightIn) => edit('height', { ...form, heightIn })}
                onBlur={blur('height')}
                invalid={Boolean(fieldError('height'))}
                errorId={errorId('height')}
              />
            </div>
          )}
          <FieldError id={errorId('height')} message={fieldError('height')} />
        </fieldset>

        <fieldset className="measure">
          <legend>Weight</legend>
          <NumberInput
            id={`${formId}-w`}
            label="Weight"
            unit={metric ? 'kg' : 'lb'}
            value={form.weight}
            onChange={(weight) => edit('weight', { ...form, weight })}
            onBlur={blur('weight')}
            invalid={Boolean(fieldError('weight'))}
            errorId={errorId('weight')}
          />
          <FieldError id={errorId('weight')} message={fieldError('weight')} />
        </fieldset>

        <section className="tape-section">
          <button
            type="button"
            className="tape-section__toggle"
            aria-expanded={showTape}
            aria-controls={`${formId}-tape`}
            onClick={() => setShowTape((s) => !s)}
          >
            <span>Have a tape measure? Add your own numbers</span>
            <span className="tape-section__chevron" aria-hidden="true" />
          </button>
          <div id={`${formId}-tape`} className="tape-section__body" hidden={!showTape}>
            <p className="tape-section__note">
              Leave any blank to use our estimate (shown in grey). Measure over light clothing,
              tape snug but not tight.
            </p>
            <div className="tape-grid">
              {OVERRIDE_FIELDS.map((field) => (
                <div key={field} className="tape-grid__item">
                  <NumberInput
                    id={`${formId}-${field}`}
                    label={overrideLabel(field, form.bodyType)}
                    hint={overrideHint(field, form.bodyType)}
                    unit={lengthUnit}
                    value={form.overrides[field]}
                    placeholder={estimate(field)}
                    onChange={(v) => setOverride(field, v)}
                    onBlur={blur(field)}
                    invalid={Boolean(fieldError(field))}
                    errorId={errorId(field)}
                    showLabel
                  />
                  <FieldError id={errorId(field)} message={fieldError(field)} />
                </div>
              ))}
            </div>
            {form.bodyType === 'womens' && (
              <div className="bra-size">
                <div className="number-input">
                  <label htmlFor={`${formId}-bra`} className="number-input__label">
                    Bra size
                    <span className="number-input__hint">Optional. Used for your bust if Full bust is blank</span>
                  </label>
                  <div className={`number-input__box${fieldError('braSize') ? ' is-invalid' : ''}`}>
                    <input
                      id={`${formId}-bra`}
                      className="num"
                      autoComplete="off"
                      autoCapitalize="characters"
                      placeholder="34C"
                      value={form.braSize}
                      onChange={(e) => edit('braSize', { ...form, braSize: e.target.value })}
                      onBlur={blur('braSize')}
                      aria-invalid={fieldError('braSize') ? true : undefined}
                      aria-describedby={fieldError('braSize') ? errorId('braSize') : undefined}
                    />
                  </div>
                </div>
                <SegmentedControl
                  label="Cup letters"
                  value={form.braSystem}
                  options={[
                    { value: 'us', label: 'US' },
                    { value: 'uk', label: 'UK' },
                  ]}
                  onChange={(braSystem) => edit('braSize', { ...form, braSystem })}
                />
                <FieldError id={errorId('braSize')} message={fieldError('braSize')} />
              </div>
            )}
          </div>
        </section>

        {fitReference && (
          <section className="fit-ref" aria-labelledby={`${formId}-fit`}>
            <h2 id={`${formId}-fit`} className="fit-ref__title">
              Your fit reference
            </h2>
            <p className="fit-ref__line">{fitReference.line}</p>
            <div className="fit-ref__actions">
              <button
                type="button"
                className="button button--outline button--small"
                onClick={() => fitReference.onChange(model ? input : null, form.units)}
              >
                {fitReference.isSet ? 'Change' : 'Add a tee you like'}
              </button>
              {fitReference.isSet && (
                <button type="button" className="button button--quiet button--small" onClick={fitReference.onRemove}>
                  Remove
                </button>
              )}
            </div>
          </section>
        )}

        <div className="body-screen__actions">
          <button type="submit" className="button button--primary" aria-disabled={!canSubmit}>
            {initial ? 'Save and go to fitting room' : 'Go to fitting room'}
          </button>
          {onCancel && (
            <button type="button" className="button button--quiet" onClick={onCancel}>
              Cancel
            </button>
          )}
          {submitted && missing && (
            <p className="field-error" role="alert">
              Enter your height and weight to continue.
            </p>
          )}
        </div>

        <p id={`${formId}-privacy`} className="body-screen__privacy">
          Saved on this device only. No account, no photos, nothing sent anywhere.{' '}
          <button type="button" className="body-screen__about" onClick={() => setAbout(true)}>
            About Choudo
          </button>
        </p>
        {about && <AboutSheet onClose={() => setAbout(false)} />}

        {/* Dev only: the build drops this switch (see ui/devTools.ts). */}
        {import.meta.env.DEV && testMode && (
          <details className="testers" open={testMode.on}>
            <summary>For fit testers</summary>
            <label className="testers__switch">
              <input type="checkbox" checked={testMode.on} onChange={(e) => testMode.onChange(e.target.checked)} />
              Test mode: record how clothes really fit, and download the results
            </label>
          </details>
        )}
      </form>

      <aside className="body-screen__preview" aria-live="polite">
        <figure
          className="body-screen__figure"
          aria-label={preview.isDefault ? 'Mannequin preview, a typical body until you enter yours' : 'Mannequin preview of your body'}
        >
          <Mannequin body={preview.body} showFit={false} />
        </figure>
        {model ? (
          <EstimateList model={model} units={form.units} />
        ) : (
          <p className="body-screen__caption">Enter your height and weight to size it to you.</p>
        )}
      </aside>
    </main>
  );
}

// ---------- small pieces ----------

function EstimateList({ model, units }: { model: BodyModel; units: UnitSystem }) {
  const metric = units === 'metric';
  const fmt = (cm: number) => (metric ? `${Math.round(cm)} cm` : `${round(cmToIn(cm), 1)} in`);
  const rows = [
    [model.measurements.bodyType === 'womens' ? 'Bust' : 'Chest', 'chestCm'],
    ['Waist', 'waistCm'],
    ['Hips', 'hipsCm'],
    ['Inseam', 'inseamCm'],
  ] as const;
  const sourceText = (key: (typeof rows)[number][1]) => {
    if (model.sources[key] === 'entered') return 'yours';
    if (key === 'chestCm' && model.bra?.setsBust) return 'from bra size';
    return 'estimate';
  };
  return (
    <dl className="estimates">
      {rows.map(([label, key]) => (
        <div key={key} className="estimates__row">
          <dt>{label}</dt>
          <dd>
            <span className="num">{fmt(model.measurements[key])}</span>
            <span className="estimates__source">{sourceText(key)}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}
