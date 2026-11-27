import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { RECENT_CHECKS } from '@choudo/core/ui-logic/state/fetched';
import { wearGarment } from '@choudo/core/ui-logic/state/outfit';

import { useReadyFetched, useUnsupportedHosts } from '@/hooks/use-fetched';
import { useTestMode } from '@/hooks/use-test-mode';
import { useWardrobe } from '@/hooks/use-wardrobe';
import { useLinkCheck } from '@/links/use-link-check';
import { CheckScreen } from '@/screens/check';
import { DEV_TOOLS } from '@/utils/dev-tools';

/**
 * The Check tab, where the app opens ("What size should I buy?"). The tabs layout sends a
 * first run to the Body screen, so a body is always stored here.
 */
export default function CheckRoute() {
  const wardrobe = useWardrobe();
  const link = useLinkCheck();
  const fetched = useReadyFetched();
  const [hosts] = useUnsupportedHosts();
  const [testMode] = useTestMode();
  // The result as the rest of the app has it (the context's one ready list), once it's stored;
  // the check's own copy only until then.
  const checked = link.state.kind === 'result' ? link.state.fetched.garment.id : null;
  const stored = checked ? fetched.find((f) => f.garment.id === checked) : undefined;
  const state = stored ? { kind: 'result' as const, fetched: stored } : link.state;
  if (!wardrobe) return null;
  return (
    <CheckScreen
      model={wardrobe.model}
      preference={wardrobe.preference}
      units={wardrobe.units}
      hasFitReference={wardrobe.preference.source === 'anchor'}
      state={state}
      recent={fetched.slice(0, RECENT_CHECKS)}
      onCheck={link.check}
      onRetry={link.retry}
      onOpenRecent={link.showStored}
      onTryOn={(garment, size) => {
        wardrobe.setOutfit(wearGarment(wardrobe.outfit, garment, size));
        router.navigate('/fitting-room');
      }}
      onOpenProduct={(url) => void WebBrowser.openBrowserAsync(url).catch(() => {})}
      onEditBody={() => router.push('/body')}
      unsupportedHosts={DEV_TOOLS && testMode ? hosts : undefined}
    />
  );
}
