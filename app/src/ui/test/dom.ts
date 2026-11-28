/**
 * What jsdom lacks for our components: <dialog>'s showModal / close, and
 * Element.scrollTo / scrollIntoView (the size row and carousel centre their pick), and window.scrollTo. Import from component tests.
 */
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

const dialog = globalThis.HTMLDialogElement?.prototype;
if (dialog && !dialog.showModal) {
  dialog.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  dialog.close = function (this: HTMLDialogElement) {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
}
// jsdom logs "not implemented" for window.scrollTo (App scrolls a new tab to its top).
if (globalThis.window) window.scrollTo = () => {};
if (globalThis.Element) {
  Element.prototype.scrollTo ??= function () {};
  Element.prototype.scrollIntoView ??= function () {};
}

afterEach(cleanup);
