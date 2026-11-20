import { useId, useMemo, useState, type FormEvent } from 'react';
import { canAnchor, FIT_STYLES, type Anchor, type FitStyle } from '../../domain/fit';
import { GARMENTS, type Garment } from '../../domain/garments';
import { GarmentIcon } from '../components/GarmentIcon';
import { FieldError, NumberInput } from '../components/NumberInput';
import { Wordmark } from '../components/Wordmark';
import { FIT_STYLE_TEXT } from '../fitText';
import type { UnitSystem } from '../state/stored';
import { anchorToTeeForm, teeFormToAnchor, type MeasuredTeeForm } from './anchorForm';
import './AnchorScreen.css';

interface AnchorScreenProps {
  units: UnitSystem;
  anchor: Anchor | null;
  style: FitStyle | null;
  /** Save the new reference and leave. Picking a style clears the anchor. */
  onDone: (anchor: Anchor | null, style: FitStyle | null) => void;
  /** Leave without changing anything. */
  onSkip: () => void;
  /** "Skip for now" the first time, "Cancel" from Edit body. */
  skipLabel: string;
}

type Step = 'choose' | 'catalogue' | 'measure' | 'style';

const ANCHOR_GARMENTS: Garment[] = GARMENTS.filter(canAnchor);

/** "Got a tee that fits the way you like?" — a personal fit reference, or a quick question instead. */
export function AnchorScreen({ units, anchor, style, onDone, onSkip, skipLabel }: AnchorScreenProps) {
  const [step, setStep] = useState<Step>(() =>
    anchor?.kind === 'catalogue' ? 'catalogue' : anchor?.kind === 'measured' ? 'measure' : style ? 'style' : 'choose',
  );
  const back = () => setStep('choose');

  return (
    <main className="anchor-screen">
      <header className="anchor-screen__intro">
        <Wordmark />
        {step === 'choose' && (
          <>
            <h1>Got a tee that fits the way you like?</h1>
            <p className="anchor-screen__lede">
              We’ll use it to judge every other top: roomier, snugger, or just how you like it.
            </p>
          </>
        )}
        {step === 'catalogue' && <h1>Which tee, and what size?</h1>}
        {step === 'measure' && <h1>Measure your tee</h1>}
        {step === 'style' && <h1>How do you like tees to fit?</h1>}
      </header>

      {step === 'choose' && (
        <div className="anchor-screen__choices">
          <button type="button" className="choice" onClick={() => setStep('catalogue')}>
            <span className="choice__title">Pick it from our tees</span>
            <span className="choice__hint">If you own one we list, tell us the size</span>
          </button>
          <button type="button" className="choice" onClick={() => setStep('measure')}>
            <span className="choice__title">Measure it</span>
            <span className="choice__hint">Lay it flat, two numbers, a minute with a tape</span>
          </button>
          <button type="button" className="choice choice--quiet" onClick={() => setStep('style')}>
            <span className="choice__title">No — ask me another way</span>
            <span className="choice__hint">One quick question instead</span>
          </button>
        </div>
      )}

      {step === 'catalogue' && (
        <CatalogueStep initial={anchor?.kind === 'catalogue' ? anchor : null} onSave={(a) => onDone(a, style)} onBack={back} />
      )}
      {step === 'measure' && (
        <MeasureStep units={units} initial={anchor} onSave={(a) => onDone(a, style)} onBack={back} />
      )}
      {step === 'style' && <StyleStep initial={style} onSave={(s) => onDone(null, s)} onBack={back} />}

      <div className="anchor-screen__skip">
        <button type="button" className="button button--quiet" onClick={onSkip}>
          {skipLabel}
        </button>
      </div>
      <p className="anchor-screen__privacy">Saved on this device only.</p>
    </main>
  );
}

// ---------- a) pick from the catalogue ----------

function CatalogueStep({
  initial,
  onSave,
  onBack,
}: {
  initial: Extract<Anchor, { kind: 'catalogue' }> | null;
  onSave: (anchor: Anchor) => void;
  onBack: () => void;
}) {
  const [garmentId, setGarmentId] = useState(initial?.garmentId ?? ANCHOR_GARMENTS[0]?.id ?? '');
  const garment = ANCHOR_GARMENTS.find((g) => g.id === garmentId);
  const [size, setSize] = useState<string | null>(initial?.size ?? null);
  const sizeOk = garment?.sizes.some((s) => s.label === size) ?? false;
  const name = useId();

  return (
    <form
      className="anchor-screen__form"
      onSubmit={(e) => {
        e.preventDefault();
        if (garment && size && sizeOk) onSave({ kind: 'catalogue', garmentId: garment.id, size });
      }}
    >
      <fieldset className="anchor-list">
        <legend className="visually-hidden">Tee</legend>
        {ANCHOR_GARMENTS.map((g) => (
          <label key={g.id} className={`anchor-option${g.id === garmentId ? ' is-selected' : ''}`}>
            <input
              type="radio"
              name={`${name}-g`}
              checked={g.id === garmentId}
              onChange={() => {
                setGarmentId(g.id);
                setSize(null);
              }}
            />
            <GarmentIcon garment={g} />
            <span>
              <span className="anchor-option__brand">{g.brand}</span>
              <span className="anchor-option__name">{g.name}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {garment && (
        <fieldset className="anchor-sizes">
          <legend>The size you own</legend>
          <div className="anchor-sizes__row">
            {garment.sizes.map((s) => (
              <label key={s.label} className={`size-pill num${s.label === size ? ' is-selected' : ''}`}>
                <input type="radio" name={`${name}-s`} checked={s.label === size} onChange={() => setSize(s.label)} />
                {s.label}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <p className="anchor-screen__note">Not listed? Go back and measure yours instead.</p>
      <StepActions canSave={sizeOk} onBack={onBack} />
    </form>
  );
}

// ---------- b) measure it ----------

function MeasureStep({
  units,
  initial,
  onSave,
  onBack,
}: {
  units: UnitSystem;
  initial: Anchor | null;
  onSave: (anchor: Anchor) => void;
  onBack: () => void;
}) {
  const [form, setForm] = useState<MeasuredTeeForm>(() => anchorToTeeForm(initial, units));
  const [submitted, setSubmitted] = useState(false);
  const result = useMemo(() => teeFormToAnchor(form, units), [form, units]);
  const id = useId();
  const unit = units === 'metric' ? 'cm' : 'in';

  function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (result.anchor) onSave(result.anchor);
  }

  return (
    <form className="anchor-screen__form" onSubmit={submit} noValidate>
      <div className="measure-howto">
        <TeeDiagram />
        <p className="anchor-screen__note">
          Lay the tee flat on a table, front up, and smooth it out. Measure straight, tape flat but not pulled.
        </p>
      </div>
      <div className="anchor-measure">
        <div>
          <NumberInput
            id={`${id}-chest`}
            label="Chest width"
            hint="Straight across, armpit to armpit"
            unit={unit}
            value={form.chest}
            onChange={(chest) => setForm((f) => ({ ...f, chest }))}
            invalid={Boolean(result.errors.chest)}
            showLabel
            autoFocus
          />
          <FieldError message={result.errors.chest} />
        </div>
        <div>
          <NumberInput
            id={`${id}-length`}
            label="Length"
            hint="Highest point of the shoulder, by the collar, down to the hem"
            unit={unit}
            value={form.length}
            onChange={(length) => setForm((f) => ({ ...f, length }))}
            invalid={Boolean(result.errors.length)}
            showLabel
          />
          <FieldError message={result.errors.length} />
        </div>
      </div>
      {submitted && result.missing && (
        <p className="field-error" role="alert">
          Enter both numbers to continue.
        </p>
      )}
      <StepActions canSave={result.anchor !== null} onBack={onBack} />
    </form>
  );
}

/** A flat tee with the two tape lines to measure. */
function TeeDiagram() {
  return (
    <svg className="tee-diagram" viewBox="0 0 120 110" aria-hidden="true">
      <path
        className="tee-diagram__tee"
        d="M42 8 Q60 18 78 8 L104 20 L116 44 L98 52 L92 40 L92 104 L28 104 L28 40 L22 52 L4 44 L16 20 Z"
      />
      <line className="tee-diagram__tape" x1="28" y1="46" x2="92" y2="46" />
      <line className="tee-diagram__tape" x1="45" y1="11" x2="45" y2="104" />
      <text x="70" y="41" textAnchor="middle">chest</text>
      <text x="50" y="80">length</text>
    </svg>
  );
}

// ---------- or: the quick question ----------

function StyleStep({
  initial,
  onSave,
  onBack,
}: {
  initial: FitStyle | null;
  onSave: (style: FitStyle) => void;
  onBack: () => void;
}) {
  const [style, setStyle] = useState<FitStyle | null>(initial);
  const name = useId();
  return (
    <form
      className="anchor-screen__form"
      onSubmit={(e) => {
        e.preventDefault();
        if (style) onSave(style);
      }}
    >
      <fieldset className="anchor-list">
        <legend className="visually-hidden">Fit</legend>
        {FIT_STYLES.map((s) => (
          <label key={s} className={`anchor-option${s === style ? ' is-selected' : ''}`}>
            <input type="radio" name={name} checked={s === style} onChange={() => setStyle(s)} />
            <span>
              <span className="anchor-option__name">{FIT_STYLE_TEXT[s].label}</span>
              <span className="anchor-option__brand">{FIT_STYLE_TEXT[s].hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <StepActions canSave={style !== null} onBack={onBack} />
    </form>
  );
}

function StepActions({ canSave, onBack }: { canSave: boolean; onBack: () => void }) {
  return (
    <div className="anchor-screen__actions">
      <button type="submit" className="button button--primary" aria-disabled={!canSave}>
        Save
      </button>
      <button type="button" className="button button--quiet" onClick={onBack}>
        Back
      </button>
    </div>
  );
}
