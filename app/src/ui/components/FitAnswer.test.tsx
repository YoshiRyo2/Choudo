// @vitest-environment jsdom
import '../test/dom';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { estimateBody } from '../../domain/body';
import { preferenceSpec } from '../../domain/fit';
import { findGarment } from '../../domain/garments';
import { verdictLine } from '../fitText';
import { garmentOdds } from '../state/odds';
import { FitAnswer } from './FitAnswer';

const garment = findGarment('gildan-5000')!;
const odds = garmentOdds(estimateBody({ heightCm: 176, weightKg: 85, bodyType: 'mens' }), garment, preferenceSpec(null, null));
const recommended = odds.recommended!;
const other = garment.sizes.map((s) => s.label).find((l) => l !== recommended)!;

describe('FitAnswer', () => {
  it('leads with the suggested size and its verdict', () => {
    render(<FitAnswer garment={garment} size={recommended} recommended={recommended} odds={odds} />);
    expect(screen.getByText(`${recommended} fits you`)).toBeTruthy();
    expect(screen.getByText(verdictLine(odds, recommended, garment).headline)).toBeTruthy();
  });

  it('says which size is shown when it is not the suggested one', () => {
    render(<FitAnswer garment={garment} size={other} recommended={recommended} odds={odds} />);
    expect(screen.getByText(`${recommended} fits you`)).toBeTruthy();
    expect(screen.getByText(`Showing ${other}: ${verdictLine(odds, other, garment).headline}`)).toBeTruthy();
  });

  it('uses the fallback copy when no size could be picked', () => {
    render(<FitAnswer garment={garment} size="M" recommended={null} odds={odds} />);
    expect(screen.getByText('Size M · we couldn’t pick one for you')).toBeTruthy();
    expect(screen.queryByText(/fits you$/)).toBeNull();
  });
});
