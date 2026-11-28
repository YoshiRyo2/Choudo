// @vitest-environment jsdom
import './ui/test/dom';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from './App';
import { STORAGE_KEYS } from '@choudo/core/ui-logic/state/stored';

describe('the mascot head choice', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem(STORAGE_KEYS.body, JSON.stringify({ heightCm: 165, weightKg: 62, bodyType: 'womens' }));
  });

  const drawnHead = () => document.querySelector<SVGGElement>('.mannequin__head')?.dataset.head;
  /** The site opens on Check; the head picker is in the Fitting room. */
  const openFittingRoom = () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Fitting room/ }));
  };

  it('starts on the cloud', () => {
    openFittingRoom();
    expect(screen.getByRole('button', { name: 'Cloud head' }).getAttribute('aria-pressed')).toBe('true');
    expect(drawnHead()).toBe('cloud');
  });

  it('is saved on the device and comes back next time', () => {
    openFittingRoom();
    fireEvent.click(screen.getByRole('button', { name: 'Peach head' }));
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.head)!)).toBe('peach');
    cleanup();

    openFittingRoom();
    expect(screen.getByRole('button', { name: 'Peach head' }).getAttribute('aria-pressed')).toBe('true');
    expect(drawnHead()).toBe('peach');
  });

  it('draws the chosen head on the other screens’ mannequins too', () => {
    localStorage.setItem(STORAGE_KEYS.head, JSON.stringify('bunny'));
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Discover/ }));
    const heads = [...document.querySelectorAll<SVGGElement>('.mannequin__head')].map((g) => g.dataset.head);
    expect(heads.length).toBeGreaterThan(0);
    expect(new Set(heads)).toEqual(new Set(['bunny']));
  });

  it('ignores a stored value that isn’t a head', () => {
    localStorage.setItem(STORAGE_KEYS.head, JSON.stringify('cat'));
    openFittingRoom();
    expect(drawnHead()).toBe('cloud');
  });
});
