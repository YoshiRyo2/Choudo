/**
 * The ちょうど stamp drops once per garment + size per session; seen again, it is
 * simply there. Kept in sessionStorage (this tab, until it closes), with an
 * in-memory copy for when storage is blocked.
 */

export const STAMP_SESSION_KEY = 'choudo.stamped.v1';

/** The bits of Web Storage we use. */
export type SessionStore = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

/** "gildan-5000|M" */
export const stampKey = (garmentId: string, size: string): string => `${garmentId}|${size}`;

/**
 * A ledger of stamps that have dropped: `claim(key)` is true the first time only.
 * Kept in `storage`; in memory instead while storage is missing, blocked or full.
 */
export function stampLedger(storage: SessionStore | null) {
  const memory = new Set<string>();
  const parse = (raw: string | null): string[] => {
    try {
      const parsed: unknown = JSON.parse(raw ?? '[]');
      return Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === 'string') : [];
    } catch {
      return [];
    }
  };
  return {
    claim(key: string): boolean {
      try {
        if (!storage) throw new Error('No session storage');
        const seen = parse(storage.getItem(STAMP_SESSION_KEY));
        if (seen.includes(key)) return false;
        storage.setItem(STAMP_SESSION_KEY, JSON.stringify([...seen, key]));
        return true;
      } catch {
        if (memory.has(key)) return false;
        memory.add(key);
        return true;
      }
    },
  };
}

function sessionStore(): SessionStore | null {
  try {
    // Missing outside a browser (the native app): the ledger then stays in memory.
    return (globalThis as { sessionStorage?: SessionStore }).sessionStorage ?? null;
  } catch {
    return null;
  }
}

const ledger = stampLedger(sessionStore());

/** True the first time this garment + size's stamp shows this session. */
export const claimStampDrop = (key: string): boolean => ledger.claim(key);
