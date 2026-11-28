/**
 * The Worker's entry: the runtime treats every export here as an entrypoint, so this file
 * exports only the handler. The logic, and what it will and won't do, is in handle.ts.
 */

import { handle } from './handle';

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

export default {
  fetch(request: Request, _env: unknown, ctx: ExecutionContext): Promise<Response> {
    return handle(request, {
      fetch: (input, init) => fetch(input, init),
      // Cloudflare's own cache (not in the WebWorker types).
      cache: (caches as unknown as { default: Cache }).default,
      waitUntil: (p) => ctx.waitUntil(p),
    });
  },
};
