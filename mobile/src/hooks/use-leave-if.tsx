import { Redirect, useCanGoBack, useNavigation } from 'expo-router';
import { useEffect, type ReactElement } from 'react';

/**
 * For a sheet or screen whose item is gone (deleted elsewhere, a stale link): go back at once,
 * or to the Fitting room on a cold start. Returns what to render instead (null or a Redirect)
 * while `gone`, or undefined to render the screen. Uses the screen's own navigation: the
 * imperative router isn't bound until after the first render.
 */
export function useLeaveIf(gone: boolean): ReactElement | null | undefined {
  const navigation = useNavigation();
  const canGoBack = useCanGoBack();
  useEffect(() => {
    if (gone && canGoBack) navigation.goBack();
  }, [gone, canGoBack, navigation]);
  if (!gone) return undefined;
  return canGoBack ? null : <Redirect href="/" />;
}
