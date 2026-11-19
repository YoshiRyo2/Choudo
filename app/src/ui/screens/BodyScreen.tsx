import { useId, useMemo, useState, type FormEvent } from 'react';
import {
  estimateBody,
  INPUT_LIMITS,
  validateBodyInput,
  type BodyInput,
  type BodyModel,
} from '../../domain/body';
import { cmToIn, kgToLb, round } from '../../domain/units';
import { Mannequin } from '../components/Mannequin/Mannequin';
import { FieldError, NumberInput } from '../components/NumberInput';
import { SegmentedControl } from '../components/SegmentedControl';
import type { UnitSystem } from '../state/stored';
import {
  EMPTY_FORM,
  formToInput,
  inputToForm,
  OVERRIDE_FIELDS,
  switchUnits,
  type BodyForm,
  type OverrideField,
} from './bodyForm';
import './BodyScreen.css';

interface BodyScreenProps {
  initial: BodyInput | null;
  units: UnitSystem;
  onDone: (input: BodyInput, units: UnitSystem) => void;
  /** Present when there's a saved body to go back to. */
  onCancel?: () => void;
  /** Edit body only: the tee or style other tops are judged against. */
  fitReference?: FitReferenceProps;
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

type FieldKey = keyof typeof INPUT_LIMITS;

/** Domain field -> where the message shows on the form. */
const FIELD_OF: Record<FieldKey, 'height' | 'weight' | OverrideField> = {
  heightCm: 'height',
  weightKg: 'weight',
  chestCm: 'chest',
  waistCm: 'waist',
  hipsCm: 'hips',
  inseamCm: 'inseam',
};

const FIELD_NAME: Record<FieldKey, string> = {
  heightCm: 'Height',
  weightKg: 'Weight',
  chestCm: 'Chest',
  waistCm: 'Waist',
  hipsCm: 'Hips',
  inseamCm: 'Inseam',
};

/** Range messages in the units the user is typing in. */
function errorMessages(input: BodyInput | null, units: UnitSystem): Partial<Record<string, string>> {
  if (!input) return {};
  const out: Partial<Record<string, string>> = {};
  for (const err of validateBodyInput(input)) {
    const { min, max } = INPUT_LIMITS[err.field];
    let range: string;
    if (units === 'metric') {
      range = `${min}–${max} ${err.field === 'weightKg' ? 'kg' : 'cm'}`;
    } else if (err.field === 'weightKg') {
      range = `${Math.round(kgToLb(min))}–${Math.round(kgToLb(max))} lb`;
    } else if (err.field === 'heightCm') {
      range = `${Math.round(cmToIn(min))}–${Math.round(cmToIn(max))} in total`;
    } else {
      range = `${Math.round(cmToIn(min))}–${Math.round(cmToIn(max))} in`;
    }
    out[FIELD_OF[err.field]] = `${FIELD_NAME[err.field]} should be ${range}.`;
  }
  return out;
}

export function BodyScreen({ initial, units, onDone, onCancel, fitReference }: BodyScreenProps) {
  const [form, setForm] = useState<BodyForm>(() =>
    initial ? inputToForm(initial, units) : { ...EMPTY_FORM, units },
  );
  const [showTape, setShowTape] = useState(() => Boolean(initial?.overrides));
  const [submitted, setSubmitted] = useState(false);
  const formId = useId();

  const input = useMemo(() => formToInput(form), [form]);
  const errors = useMemo(() => errorMessages(input, form.units), [input, form.units]);
  const model: BodyModel | null = useMemo(
    () => (input && validateBodyInput(input).length === 0 ? estimateBody(input) : null),
    [input],
  );

  const metric = form.units === 'metric';
  const lengthUnit = metric ? 'cm' : 'in';
  const set = (patch: Partial<BodyForm>) => setForm((f) => ({ ...f, ...patch }));
  const setOverride = (field: OverrideField, value: string) =>
    setForm((f) => ({ ...f, overrides: { ...f.overrides, [field]: value } }));

  const missing = !input;
  const canSubmit = model !== null;

  function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (input && model) onDone(input, form.units);
  }

  /** Our estimate for a field, in the form's units — shown as the placeholder. */
  const estimate = (field: OverrideField) => {
    if (!model) return '';
    const cm = model.measurements[`${field}Cm` as const];
    return String(round(metric ? cm : cmToIn(cm), metric ? 0 : 1));
  };

  const fieldError = (name: string) => errors[name];

  return (
    <main className="body-screen">
      <form className="body-screen__form" onSubmit={submit} noValidate aria-describedby={`${formId}-privacy`}>
        <header className="body-screen__intro">
          <p className="wordmark">Nimbus</p>
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
          <SegmentedControl
            label="Size charts"
            value={form.sizing}
            options={[
              { value: 'mens', label: 'Men’s' },
              { value: 'womens', label: 'Women’s' },
            ]}
            onChange={(sizing) => set({ sizing })}
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
              onChange={(heightCm) => set({ heightCm })}
              invalid={Boolean(fieldError('height'))}
              autoFocus={!initial}
            />
          ) : (
            <div className="measure__pair">
              <NumberInput
                id={`${formId}-ft`}
                label="Feet"
                unit="ft"
                value={form.heightFt}
                onChange={(heightFt) => set({ heightFt })}
                invalid={Boolean(fieldError('height'))}
                autoFocus={!initial}
              />
              <NumberInput
                id={`${formId}-in`}
                label="Inches"
                unit="in"
                value={form.heightIn}
                onChange={(heightIn) => set({ heightIn })}
                invalid={Boolean(fieldError('height'))}
              />
            </div>
          )}
          <FieldError message={fieldError('height')} />
        </fieldset>

        <fieldset className="measure">
          <legend>Weight</legend>
          <NumberInput
            id={`${formId}-w`}
            label="Weight"
            unit={metric ? 'kg' : 'lb'}
            value={form.weight}
            onChange={(weight) => set({ weight })}
            invalid={Boolean(fieldError('weight'))}
          />
          <FieldError message={fieldError('weight')} />
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
                    label={OVERRIDE_LABEL[field]}
                    hint={OVERRIDE_HINT[field]}
                    unit={lengthUnit}
                    value={form.overrides[field]}
                    placeholder={estimate(field)}
                    onChange={(v) => setOverride(field, v)}
                    invalid={Boolean(fieldError(field))}
                    showLabel
                  />
                  <FieldError message={fieldError(field)} />
                </div>
              ))}
            </div>
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
          Saved on this device only. No account, no photos, nothing sent anywhere.
        </p>
      </form>

      <aside className="body-screen__preview" aria-live="polite">
        {model ? (
          <>
            <div className="body-screen__figure">
              <Mannequin body={model.measurements} showFit={false} />
            </div>
            <EstimateList model={model} units={form.units} />
          </>
        ) : (
          <p className="body-screen__empty">
            {input
              ? 'Fix the number marked in red to see your mannequin.'
              : 'Your mannequin appears here once you’ve entered height and weight.'}
          </p>
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
    ['Chest', 'chestCm'],
    ['Waist', 'waistCm'],
    ['Hips', 'hipsCm'],
    ['Inseam', 'inseamCm'],
  ] as const;
  return (
    <dl className="estimates">
      {rows.map(([label, key]) => (
        <div key={key} className="estimates__row">
          <dt>{label}</dt>
          <dd>
            <span className="num">{fmt(model.measurements[key])}</span>
            <span className="estimates__source">{model.sources[key] === 'entered' ? 'yours' : 'estimate'}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}
