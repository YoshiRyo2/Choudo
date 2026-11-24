// @vitest-environment jsdom
import '../test/dom';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { VERDICTS, type GarmentOdds, type SizeOdds, type Verdict } from '@choudo/core/domain/fit';
import { FitAnswer } from './FitAnswer';

const tee = { category: 'top', fitIntent: 'regular' } as const;

function sizeOdds(sizeLabel: string, verdicts: Partial<Record<Verdict, number>>): SizeOdds {
  const all = Object.fromEntries(VERDICTS.map((v) => [v, verdicts[v] ?? 0])) as Record<Verdict, number>;
  return { sizeLabel, zones: [], verdicts: all, likes: all.fits + all['as-designed'], meanGirthMissCm: 1 };
}
/** S, M, L with M as given; M suggested unless `recommended` says otherwise. */
const odds = (
  m: Partial<Record<Verdict, number>>,
  l: Partial<Record<Verdict, number>> = { roomier: 0.9, fits: 0.1 },
  recommended: string | null = 'M',
): GarmentOdds => ({
  garmentId: 'g',
  sizes: [sizeOdds('S', { 'too-tight': 0.9, fits: 0.1 }), sizeOdds('M', m), sizeOdds('L', l)],
  recommended,
  samples: 500,
});

const headline = () => screen.getAllByRole('paragraph')[0]!.textContent;
const line = () => screen.getAllByRole('paragraph')[1]!.textContent;

describe('FitAnswer', () => {
  it('says "M fits you" when M likely fits', () => {
    render(<FitAnswer garment={tee} size="M" odds={odds({ fits: 0.8, roomier: 0.2 })} />);
    expect(headline()).toBe('M fits you');
    expect(line()).toBe('Very likely fits how you like');
  });

  it('names the size shown when it is not the suggested one', () => {
    render(<FitAnswer garment={tee} size="L" odds={odds({ fits: 0.8, roomier: 0.2 })} />);
    expect(headline()).toBe('M fits you');
    expect(line()).toMatch(/^Showing L: /);
  });

  it('says "Your best bet" when M only might fit', () => {
    render(<FitAnswer garment={tee} size="M" odds={odds({ fits: 0.45, roomier: 0.3, snugger: 0.25 })} />);
    expect(headline()).toBe('Your best bet: M');
    expect(line()).toBe('Might fit how you like');
  });

  it('says "Your best bet" on a close call', () => {
    render(<FitAnswer garment={tee} size="M" odds={odds({ fits: 0.55, snugger: 0.45 }, { fits: 0.45, roomier: 0.55 })} />);
    expect(headline()).toBe('Your best bet: M');
    expect(line()).toBe('Could go either way: M or L');
  });

  it('says "Your best bet" when M likely won’t fit', () => {
    render(<FitAnswer garment={tee} size="M" odds={odds({ 'too-tight': 0.7, fits: 0.3 })} />);
    expect(headline()).toBe('Your best bet: M');
    expect(screen.queryByText(/fits you$/)).toBeNull();
  });

  it('uses the fallback copy when no size could be picked', () => {
    render(<FitAnswer garment={tee} size="M" odds={odds({ fits: 0.8, roomier: 0.2 }, undefined, null)} />);
    expect(headline()).toBe('Size M · we couldn’t pick one for you');
    expect(screen.queryByText(/fits you$|^Your best bet/)).toBeNull();
  });
});
