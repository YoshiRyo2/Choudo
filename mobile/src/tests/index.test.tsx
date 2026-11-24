// Temporary, with index.tsx: proves Jest reaches packages/core. Removed in Task 5.
import { GARMENTS } from '@choudo/core/domain/garments';
import { render, screen } from '@testing-library/react-native';

import Index from '@/app/index';

test('shows the seed catalogue size from @choudo/core', async () => {
  await render(<Index />);
  expect(GARMENTS.length).toBeGreaterThan(0);
  expect(screen.getByText(`${GARMENTS.length} garments`)).toBeTruthy();
});
