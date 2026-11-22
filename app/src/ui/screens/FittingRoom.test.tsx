// @vitest-environment jsdom
import '../test/dom';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { estimateBody, type BodyInput } from '../../domain/body';
import { preferenceSpec } from '../../domain/fit';
import { findGarment } from '../../domain/garments';
import type { HeadKind } from '../components/Mannequin/heads';
import { fittingHeadline, isJustRight } from '../fitText';
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
  const [head, setHead] = useState<HeadKind>('cloud');
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
      head={head}
      onHeadChange={setHead}
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

describe('the mascot', () => {
  // Women's 165 cm / 70 kg in the surplice dress: M is suggested and "M fits you".
  const womens: BodyInput = { heightCm: 165, weightKg: 70, bodyType: 'womens' };
  const dress = findGarment('landsend-surplice-dress')!;
  const dressOdds = garmentOdds(estimateBody(womens), dress, preference);

  function DressRoom({ size }: { size: string }) {
    const [outfit, setOutfit] = useState<Outfit>({ ...outfitIn(size), topId: null, topSize: null, onepieceId: dress.id, onepieceSize: size });
    const [head, setHead] = useState<HeadKind>('cloud');
    return (
      <FittingRoom
        body={womens}
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
        head={head}
        onHeadChange={setHead}
      />
    );
  }

  const stamp = () => screen.queryByRole('img', { name: 'ちょうど: just right' });
  const head = () => document.querySelector<SVGGElement>('.mannequin__head')!;

  beforeEach(() => sessionStorage.clear());

  it('stamps ちょうど when the suggested size is shown and the headline says it fits', () => {
    expect(dressOdds.recommended).toBe('M');
    expect(fittingHeadline(dressOdds, 'M', dress).headline).toBe('M fits you');
    render(<DressRoom size="M" />);
    expect(stamp()).not.toBeNull();
  });

  it('shows no stamp for another size, even with "M fits you" in the headline', () => {
    render(<DressRoom size="XL" />);
    expect(within(fitSection()).getByText('M fits you')).toBeTruthy();
    expect(stamp()).toBeNull();
  });

  it('shows no stamp when the suggested size is only "Your best bet"', () => {
    expect(expectedHeadline).toBe(`Your best bet: ${recommended}`);
    expect(isJustRight(odds, recommended, tee)).toBe(false);
    render(<Room size={recommended} />);
    expect(stamp()).toBeNull();
  });

  it('drops the stamp once per garment + size per session, then simply shows it', () => {
    const first = render(<DressRoom size="M" />);
    expect(stamp()!.classList.contains('is-dropping')).toBe(true);
    first.unmount();
    render(<DressRoom size="M" />);
    expect(stamp()).not.toBeNull();
    expect(stamp()!.classList.contains('is-dropping')).toBe(false);
  });

  it('puts the shown size’s verdict tone on the face', () => {
    render(<DressRoom size="M" />);
    expect(head().dataset.face).toBe('good');
    expect(head().querySelector('.mascot-face')!.getAttribute('data-eyes')).toBe('closed');
    cleanup();
    const tone = fittingHeadline(dressOdds, 'XS', dress).tone;
    expect(tone).not.toBe('good');
    render(<DressRoom size="XS" />);
    expect(head().dataset.face).toBe(tone);
    expect(head().querySelector('.mascot-face')!.getAttribute('data-eyes')).toBe('dot');
  });

  it('picks a head from three 44 px buttons, one pressed at a time', () => {
    render(<DressRoom size="M" />);
    const picker = screen.getByRole('group', { name: 'Head' });
    const buttons = within(picker).getAllByRole('button');
    expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual(['Cloud head', 'Peach head', 'Bunny head']);
    expect(buttons.map((b) => b.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false']);
    expect(head().dataset.head).toBe('cloud');

    fireEvent.click(screen.getByRole('button', { name: 'Bunny head' }));
    expect(buttons.map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'true']);
    expect(head().dataset.head).toBe('bunny');
  });
});
