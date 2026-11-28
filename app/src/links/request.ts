/** One GET for the Check flow (fetchUniqlo.ts, fetchZara.ts): a timeout, and one retry on a network error. */

export type Got = { ok: true; text: string } | { ok: false; status: number; text: string };

/** One GET with a timeout. Throws on a network error or a timeout; a non-2xx is a result. */
export async function get(url: string, fetchImpl: typeof fetch, timeoutMs: number): Promise<Got> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), timeoutMs);
  try {
    // No cookies or credentials: the service needs none. Accept is a CORS-safelisted header, so no preflight.
    const res = await fetchImpl(url, { signal: abort.signal, credentials: 'omit', headers: { Accept: 'application/json' } });
    if (!res.ok) return { ok: false, status: res.status, text: await res.text().catch(() => '') };
    return { ok: true, text: await res.text() };
  } finally {
    clearTimeout(timer);
  }
}

/** `get`, tried once more when the network fails (not when an error status comes back). */
export async function getWithRetry(url: string, fetchImpl: typeof fetch, timeoutMs: number): Promise<Got> {
  try {
    return await get(url, fetchImpl, timeoutMs);
  } catch {
    return get(url, fetchImpl, timeoutMs);
  }
}
