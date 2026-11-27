import { useCallback, useEffect, useRef, useState } from 'react';
import { parseProductLink, uniqloGarmentId, type UniqloLink } from '@choudo/core/domain/links';
import { linkError, type CheckError } from '@choudo/core/ui-logic/checkText';
import { addFetched, addUnsupportedHost, findFetched, readyFetched, type ReadyFetched } from '@choudo/core/ui-logic/state/fetched';
import type { StoredFetched } from '@choudo/core/ui-logic/state/stored';

import { useFetchedList, useUnsupportedHosts } from '@/hooks/use-fetched';

import { checkUniqloLink, type FetchOptions } from './fetch-uniqlo';

/** What the Check tab shows under the field. */
export type CheckState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'result'; fetched: ReadyFetched }
  | { kind: 'error'; error: CheckError };

export interface LinkCheck {
  state: CheckState;
  /** Read the pasted text: a link Choudo can't read says why at once; a Uniqlo US one is fetched (or read from the cache). */
  check: (text: string) => void;
  /** Try the last link again (after a network error). */
  retry: () => void;
  /** Show a stored product's result again, from the cache. */
  showStored: (garmentId: string) => void;
}

/**
 * The Check tab's flow, storage included: the fetched list (cache + "From your link"
 * garments) and, for Test mode, the hosts it couldn't read. Only the product code is sent.
 */
export function useLinkCheck(options: FetchOptions = {}): LinkCheck {
  const [list, setList] = useFetchedList();
  const [hosts, setHosts] = useUnsupportedHosts();
  const [state, setState] = useState<CheckState>({ kind: 'idle' });
  // The latest stored values for callbacks that finish after a re-render.
  const latest = useRef({ list, hosts, setList, setHosts, options });
  latest.current = { list, hosts, setList, setHosts, options };
  const lastLink = useRef<UniqloLink | null>(null);
  // Each check gets a number: an older one that finishes late is ignored.
  const request = useRef(0);
  useEffect(
    () => () => {
      request.current += 1;
    },
    [],
  );

  const show = useCallback((entry: StoredFetched) => {
    const ready = readyFetched([entry])[0];
    setState(ready ? { kind: 'result', fetched: ready } : { kind: 'error', error: 'unreadable-chart' });
  }, []);

  const run = useCallback(
    async (link: UniqloLink) => {
      const id = ++request.current;
      lastLink.current = link;
      setState({ kind: 'loading' });
      const { list: stored, options: fetchOptions } = latest.current;
      const outcome = await checkUniqloLink(link, { ...fetchOptions, cached: findFetched(stored, uniqloGarmentId(link.productCode)) });
      if (id !== request.current) return;
      if (outcome.kind === 'error') {
        setState({ kind: 'error', error: outcome.error });
        return;
      }
      if (!outcome.fromCache) latest.current.setList(addFetched(latest.current.list, outcome.entry));
      show(outcome.entry);
    },
    [show],
  );

  const check = useCallback(
    (text: string) => {
      const link = parseProductLink(text);
      const error = linkError(link);
      if (error !== null || link === null || link.brand !== 'uniqlo') {
        request.current += 1;
        if (link?.brand === 'unknown' && error === 'unknown-brand') {
          latest.current.setHosts(addUnsupportedHost(latest.current.hosts, link.host));
        }
        setState({ kind: 'error', error: error ?? 'no-link' });
        return;
      }
      void run(link);
    },
    [run],
  );

  const retry = useCallback(() => {
    if (lastLink.current) void run(lastLink.current);
  }, [run]);

  const showStored = useCallback(
    (garmentId: string) => {
      const entry = findFetched(latest.current.list, garmentId);
      if (!entry) return;
      request.current += 1;
      show(entry);
    },
    [show],
  );

  return { state, check, retry, showStored };
}
