/**
 * Registers public/sw.js, which lets the installed app open offline. Production only
 * (main.tsx): under the dev server a cache would hide every edit.
 */
export function registerServiceWorker(base: string): void {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch((error: unknown) => {
      console.warn('Choudo: offline support is off, the service worker did not register.', error);
    });
  });
}
