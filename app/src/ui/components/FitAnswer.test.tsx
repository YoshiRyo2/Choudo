// @vitest-environment jsdom
import '../test/dom';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { estimateBody, type BodyInput } from '@choudo/core/domain/body';
import { fitAllSizes, VERDICTS, type GarmentOdds, type SizeOdds, type Verdict } from '@choudo/core/domain/fit';
import { findGarment } from '@choudo/core/domain/garments';
import { FitAnswer } from './FitAnswer';

// A real tee, so the why-line and the reliability line read real fits; the odds are made up per test.
const tee = findGarment('gildan-5000')!;
const [S, M, L] = tee.sizes.map((s) => s.label) as [string, string, string];
const estimated: BodyInput = { heightCm: 176, weightKg: 80, bodyType: 'mens' };
const measured: BodyInput = { ...estimated, overrides: { chestCm: 100 } };
const fitsFor = (body: BodyInput) => fitAllSizes(estimateBody(body), tee);

function sizeOdds(sizeLabel: string, verdicts: Partial<Record<Verdict, number>>): SizeOdds {
  const all = Object.fromEntries(VERDICTS.map((v) => [v, verdicts[v] ?? 0])) as Record<Verdict, number>;
  return { sizeLabel, zones: [], verdicts: all, likes: all.fits + all['as-designed'], meanGirthMissCm: 1 };
}
/** The tee's first three sizes with the middle one as given; it is suggested unless `recommended` says otherwise. */
const odds = (
  m: Partial<Record<Verdict, number>>,
  l: Partial<Record<Verdict, number>> = { roomier: 0.9, fits: 0.1 },
  recommended: string | null = M,
): GarmentOdds => ({
  garmentId: tee.id,
  sizes: [sizeOdds(S, { 'too-tight': 0.9, fits: 0.1 }), sizeOdds(M, m), sizeOdds(L, l)],
  recommended,
  samples: 500,
});

const paragraphs = () => screen.getAllByRole('paragraph').map((p) => p.textContent);
const headline = () => paragraphs()[0];
const line = () => paragraphs()[1];

function answer(props: { size?: string; odds: GarmentOdds; body?: BodyInput; hasFitReference?: boolean; onEditBody?: () => void }) {
  return render(
    <FitAnswer
      garment={tee}
      size={props.size ?? M}
      odds={props.odds}
      fits={fitsFor(props.body ?? estimated)}
      units="metric"
      hasFitReference={props.hasFitReference ?? false}
      onEditBody={props.onEditBody ?? (() => {})}
    />,
  );
}

describe('FitAnswer', () => {
  it(`says "${M} fits you" when ${M} likely fits`, () => {
    answer({ odds: odds({ fits: 0.8, roomier: 0.2 }) });
    expect(headline()).toBe(`${M} fits you`);
    expect(line()).toBe('Very likely fits how you like');
  });

  it('names the size shown when it is not the suggested one', () => {
    answer({ size: L, odds: odds({ fits: 0.8, roomier: 0.2 }) });
    expect(headline()).toBe(`${M} fits you`);
    expect(line()).toMatch(new RegExp(`^Showing ${L}: `));
  });

  it(`says "Your best bet" when ${M} only might fit`, () => {
    answer({ odds: odds({ fits: 0.45, roomier: 0.3, snugger: 0.25 }) });
    expect(headline()).toBe(`Your best bet: ${M}`);
    expect(line()).toBe('Might fit how you like');
  });

  it('says "Your best bet" on a close call', () => {
    answer({ odds: odds({ fits: 0.55, snugger: 0.45 }, { fits: 0.45, roomier: 0.55 }) });
    expect(headline()).toBe(`Your best bet: ${M}`);
    expect(line()).toBe(`Could go either way: ${M} or ${L}`);
  });

  it(`says "Your best bet" when ${M} likely won’t fit`, () => {
    answer({ odds: odds({ 'too-tight': 0.7, fits: 0.3 }) });
    expect(headline()).toBe(`Your best bet: ${M}`);
    expect(screen.queryByText(/fits you$/)).toBeNull();
  });

  it('uses the fallback copy when no size could be picked', () => {
    answer({ odds: odds({ fits: 0.8, roomier: 0.2 }, undefined, null) });
    expect(headline()).toBe(`Size ${M} · we couldn’t pick one for you`);
    expect(screen.queryByText(/fits you$|^Your best bet/)).toBeNull();
  });

  it('shows why in whole cm, comparing with the next size up, and never a percentage', () => {
    const { container } = answer({ odds: odds({ fits: 0.8, roomier: 0.2 }) });
    expect(paragraphs()[2]).toMatch(new RegExp(`^${M} gives you \\d+ cm of room at the chest; ${L} gives \\d+ cm\\.$`));
    expect(container.textContent).not.toMatch(/%/);
  });

  it('says the chest is estimated, and "Add your measurement" opens Edit body', () => {
    const onEditBody = vi.fn();
    const { container } = answer({ odds: odds({ fits: 0.8, roomier: 0.2 }), onEditBody });
    expect(paragraphs()[3]).toBe('Fair confidence: your chest is estimated from height and weight. Add your measurement');
    fireEvent.click(screen.getByRole('button', { name: 'Add your measurement' }));
    expect(onEditBody).toHaveBeenCalledOnce();
    expect(container.textContent).not.toMatch(/%/);
  });

  it('says good confidence with a measured chest, or with a tee you know fits, and offers nothing to add', () => {
    answer({ odds: odds({ fits: 0.8, roomier: 0.2 }), body: measured });
    expect(paragraphs()[3]).toBe('Good confidence: real size chart and your own measurements.');
    expect(screen.queryByRole('button', { name: 'Add your measurement' })).toBeNull();
    cleanup();

    answer({ odds: odds({ fits: 0.8, roomier: 0.2 }), hasFitReference: true });
    expect(screen.getByText('Good confidence: real size chart and a tee you know fits.')).toBeTruthy();
  });
});
