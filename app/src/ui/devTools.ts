/**
 * Tools for us, not for users: Test mode (and the landmark picker, which only the
 * dev server serves). They exist in `npm run dev` and are gone from the production build.
 */

/** true under `npm run dev`; false in `npm run build`, so Vite drops what it guards. */
export const DEV_TOOLS: boolean = import.meta.env.DEV;

/** Whether Test mode is on: switched on, and in development. A stored "on" never shows in production. */
export function devToolsOn(storedTestMode: boolean, dev: boolean): boolean {
  return dev && storedTestMode;
}
