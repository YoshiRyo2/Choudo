import { catalogueFor, GARMENTS } from '@choudo/core/domain/garments';

import { useBody } from '@/hooks/use-body';
import { Placeholder } from '@/screens/placeholder';

// Placeholder until the real Fitting room: shows the shared engine running on the phone.
export default function FittingRoom() {
  const [body] = useBody();
  if (body === null) return null;
  const count = catalogueFor(GARMENTS, body.bodyType, 'matching').length;
  return (
    <Placeholder title="Fitting room">
      {`${body.heightCm} cm · ${count} garments in your sizing`}
    </Placeholder>
  );
}
