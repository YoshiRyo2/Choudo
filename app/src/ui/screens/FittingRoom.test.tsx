// @vitest-environment jsdom
import '../test/dom';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { estimateBody, type BodyInput } from '@choudo/core/domain/body';
import { preferenceSpec } from '@choudo/core/domain/fit';
import { findGarment, GARMENTS, publicGarments, type CatalogueScope } from '@choudo/core/domain/garments';
import type { HeadKind } from '@choudo/core/ui-logic/components/Mannequin/heads';
import { fittingHeadline, isJustRight } from '@choudo/core/ui-logic/fitText';
import { garmentOdds } from '@choudo/core/ui-logic/state/odds';
import type { Outfit } from '@choudo/core/ui-logic/state/stored';
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

/** What the public site shows: no sample rows. */
const live = publicGarments(GARMENTS, { includeSamples: false });
const testing = { records: [], anchor: null, onAdd: () => {}, onClear: () => {} };

function Room({ size, testMode = false, stored, catalogue = 'all' }: { size: string; testMode?: boolean; stored?: Outfit; catalogue?: CatalogueScope }) {
  const [outfit, setOutfit] = useState(stored ?? outfitIn(size));
  const [head, setHead] = useState<HeadKind>('cloud');
  return (
    <FittingRoom
      body={body}
      preference={preference}
      units="metric"
      garments={live}
      outfit={outfit}
      onOutfitChange={setOutfit}
      catalogue={catalogue}
      onCatalogueChange={() => {}}
      onSaveOutfit={() => {}}
      nextOutfitName="Outfit 1"
      onUnitsChange={() => {}}
      onEditBody={() => {}}
      head={head}
      onHeadChange={setHead}
      testing={testMode ? testing : undefined}
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

  it('keeps zones and odds off the screen until Fit details is opened, and closes again', () => {
    render(<Room size={recommended} />);
    const main = screen.getByRole('main');
    // The main screen: no zone readout and no percentages; the only cm is the why-line's.
    expect(main.querySelector('.readout')).toBeNull();
    expect(main.textContent).not.toMatch(/%/);
    const why = within(fitSection()).getByText(new RegExp(`^${recommended} gives you \\d+ cm of room at the chest; `));
    expect(main.textContent!.replace(why.textContent!, '')).not.toMatch(/\d\s?cm/);
    expect(within(fitSection()).getByText(/^Fair confidence: your chest is estimated from height and weight\./)).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'See fit details' }));
    const sheet = screen.getByRole('dialog');
    expect(within(sheet).getByRole('heading', { name: tee.name })).toBeTruthy();
    expect(sheet.querySelector('.readout')).not.toBeNull();
    // The reliability line tops the readout; an estimated body number is marked "est.".
    expect(sheet.querySelector('.readout__summary .readout__trust')!.textContent).toMatch(/^Fair confidence: your chest is estimated/);
    expect(sheet.querySelector('.zone__est')!.textContent!.trim()).toBe('est.');
    // No chances outside Test mode (the garment's source note may say "100% cotton").
    expect(sheet.querySelector('.readout__summary')!.textContent).not.toMatch(/%/);
    expect(sheet.querySelector('.readout__zones')!.textContent).not.toMatch(/%/);
    expect(sheet.querySelector('.zone__odds')).toBeNull();
    expect(sheet.textContent).not.toMatch(/Chances come from/);

    fireEvent.click(within(sheet).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows each zone’s chances in Fit details with Test mode on', () => {
    render(<Room size={recommended} testMode />);
    fireEvent.click(screen.getByRole('button', { name: 'See fit details' }));
    const sheet = screen.getByRole('dialog');
    expect(sheet.querySelector('.zone__odds')).not.toBeNull();
    expect(sheet.textContent).toMatch(/\d%/);
    expect(sheet.textContent).toMatch(/Chances come from 500 tries/);
    // The answer itself still carries no percentage.
    expect(fitSection().textContent).not.toMatch(/%/);
  });

  it('swaps a stored sample (a Fieldline tee) for a real one, without changing what is stored', () => {
    const stored = { ...outfitIn('M'), topId: 'fieldline-boxy-tee' };
    render(<Room size="M" stored={stored} />);
    expect(screen.queryByText('Boxy Tee')).toBeNull();
    expect(document.body.textContent).not.toMatch(/Fieldline/);
    expect(stored.topId).toBe('fieldline-boxy-tee');
  });

  it('hides a category tab with no garments for this body, rather than an empty list', () => {
    // A men's body on its own sizing: no dresses, so no Dress tab.
    render(<Room size={recommended} catalogue="matching" />);
    const browsing = screen.getByRole('region', { name: 'Choose clothes' });
    const tabs = within(browsing).getAllByRole('radio').map((r) => r.closest('label')?.textContent ?? r.getAttribute('aria-label'));
    expect(tabs).not.toContain('Dress');
    expect(tabs).toEqual(expect.arrayContaining(['Top', 'Bottom', 'Jacket']));
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
        garments={GARMENTS}
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
