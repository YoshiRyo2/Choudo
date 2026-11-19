import { useId, useState, type FormEvent } from 'react';
import type { Garment } from '../../domain/garments';
import { ConfirmButton } from '../components/ConfirmButton';
import { csvFileName, fitTestsCsv, type TesterAnswers } from '../state/fitTests';
import { CHEST_ANSWERS, LENGTH_ANSWERS, type ChestAnswer, type FitTestRecord, type LengthAnswer } from '../state/stored';
import './FitTestPanel.css';

interface FitTestPanelProps {
  /** The top on the mannequin, or null when browsing bottoms. */
  garment: Garment | null;
  size: string | null;
  records: FitTestRecord[];
  onSave: (answers: TesterAnswers) => void;
  onClear: () => void;
}

const CHEST_TEXT: Record<ChestAnswer, string> = {
  'too-tight': 'Too tight',
  'just-right': 'Just right',
  'too-loose': 'Too loose',
};
const LENGTH_TEXT: Record<LengthAnswer, string> = {
  'too-short': 'Too short',
  'just-right': 'Just right',
  'too-long': 'Too long',
};
const NONE = '__none__';

/** Test mode: record how the garment on the mannequin actually fits the tester. */
export function FitTestPanel({ garment, size, records, onSave, onClear }: FitTestPanelProps) {
  const [tester, setTester] = useState(() => records[records.length - 1]?.tester ?? '');
  const [chest, setChest] = useState<ChestAnswer | null>(null);
  const [length, setLength] = useState<LengthAnswer | null>(null);
  const [kept, setKept] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const id = useId();
  const ready = tester.trim() !== '' && chest !== null && length !== null && kept !== null;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!ready || !chest || !length || kept === null) return;
    onSave({ tester, chest, length, keptSize: kept === NONE ? null : kept });
    setChest(null);
    setLength(null);
    setKept(null);
    setSaved(true);
  }

  function download() {
    const blob = new Blob([fitTestsCsv(records)], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = csvFileName(new Date());
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="test-panel" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="test-panel__title">
        Test mode
      </h2>
      {garment && size ? (
        <form className="test-panel__form" onSubmit={submit} onChange={() => setSaved(false)}>
          <p className="test-panel__what">
            How does the {garment.brand} {garment.name} in <strong className="num">{size}</strong> really fit?
          </p>
          <label className="test-panel__tester">
            Tester
            <input value={tester} onChange={(e) => setTester(e.target.value)} placeholder="e.g. T03" autoComplete="off" />
          </label>
          <Choices legend="Chest" name={`${id}-chest`} options={CHEST_ANSWERS.map((a) => [a, CHEST_TEXT[a]])} value={chest} onChange={setChest} />
          <Choices legend="Length" name={`${id}-length`} options={LENGTH_ANSWERS.map((a) => [a, LENGTH_TEXT[a]])} value={length} onChange={setLength} />
          <Choices
            legend="Which size would they keep?"
            name={`${id}-kept`}
            options={[...garment.sizes.map((s) => [s.label, s.label] as [string, string]), [NONE, 'None']]}
            value={kept}
            onChange={setKept}
          />
          <div className="test-panel__actions">
            <button type="submit" className="button button--primary button--small" aria-disabled={!ready}>
              Save result
            </button>
            {saved && <span role="status">Saved.</span>}
          </div>
        </form>
      ) : (
        <p className="test-panel__what">Test mode records tops. Switch to Tops and pick one to record a result.</p>
      )}

      <footer className="test-panel__results">
        <span className="num">
          {records.length} {records.length === 1 ? 'result' : 'results'} saved on this device
        </span>
        {records.length > 0 && (
          <>
            <button type="button" className="button button--outline button--small" onClick={download}>
              Download CSV
            </button>
            <ConfirmButton label="Clear" confirmLabel="Tap again to clear all" onConfirm={onClear} />
          </>
        )}
      </footer>
    </section>
  );
}

function Choices<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
}: {
  legend: string;
  name: string;
  options: [T, string][];
  value: T | null;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="test-choices">
      <legend>{legend}</legend>
      <div className="test-choices__row">
        {options.map(([v, text]) => (
          <label key={v} className={`test-choice${v === value ? ' is-selected' : ''}`}>
            <input type="radio" name={name} value={v} checked={v === value} onChange={() => onChange(v)} />
            {text}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
