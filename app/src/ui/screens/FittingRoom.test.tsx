// @vitest-environment jsdom
import '../test/dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { estimateBody, type BodyInput } from '../../domain/body';
import { preferenceSpec } from '../../domain/fit';
import { findGarment } from '../../domain/garments';
import { fittingHeadline } from '../fitText';
import { garmentOdds } from '../state/odds';
import type { Outfit } from '../state/stored';
import { FittingRoom } from './FittingRoom';

const body: BodyInput = { heightCm: 176, weightKg: 85, bodyType: 'mens' };
const preference = preferenceSpec(null, null);
const tee = findGarment('gildan-5000')!;
const odds = garmentOdds(estimateBody(body), tee, preference);
const recommended = odds.recommended!;
// "M fits you" or "Your best bet: M", judged on the suggested size whichever is shown.
const expectedHeadline = fittingHeadline(odds, recommended, tee).headline;
const other = tee.sizes.map((s) => s.label).find((l) => l !== recommended)!;

const outfitIn = (size: string): Outfit => ({
  topId: tee.id,
  topSize: size,
  bottomId: null,
  bottomSize: null,
  outerId: null,
  outerSize: null,
  onepieceId: null,
  onepieceSize: null,
});

function Room({ size }: { size: string }) {
  const [outfit, setOutfit] = useState(outfitIn(size));
  return (
    <FittingRoom
      body={body}
      preference={preference}
      units="metric"
      outfit={outfit}
      onOutfitChange={setOutfit}
      catalogue="all"
      onCatalogueChange={() => {}}
      onSaveOutfit={() => {}}
      nextOutfitName="Outfit 1"
      onUnitsChange={() => {}}
      onEditBody={() => {}}
    />
  );
}

const fitSection = () => screen.getByRole('region', { name: 'Fit' });

describe('FittingRoom', () => {
  it('leads with the suggested size', () => {
    render(<Room size={recommended} />);
    expect(expectedHeadline).toMatch(new RegExp(`^(${recommended} fits you|Your best bet: ${recommended})$`));
    expect(within(fitSection()).getByText(expectedHeadline)).toBeTruthy();
    expect(within(fitSection()).queryByText(/^Showing /)).toBeNull();
  });

  it('names the size shown when another size is picked', () => {
    render(<Room size={other} />);
    expect(within(fitSection()).getByText(expectedHeadline)).toBeTruthy();
    expect(within(fitSection()).getByText(new RegExp(`^Showing ${other}: `))).toBeTruthy();
  });

  it('keeps zones, cm and odds off the screen until Fit details is opened, and closes again', () => {
    render(<Room size={recommended} />);
    const main = screen.getByRole('main');
    // No numbers on the main screen: no zone readout, no cm, no percentages.
    expect(main.querySelector('.readout')).toBeNull();
    expect(main.textContent).not.toMatch(/\d\s?cm|\d%/);
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'See fit details' }));
    const sheet = screen.getByRole('dialog');
    expect(within(sheet).getByRole('heading', { name: tee.name })).toBeTruthy();
    expect(sheet.querySelector('.readout')).not.toBeNull();
    expect(sheet.textContent).toMatch(/\d%/);

    fireEvent.click(within(sheet).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
