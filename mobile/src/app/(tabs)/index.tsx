import { catalogueFor, GARMENTS } from '@choudo/core/domain/garments';
import { router } from 'expo-router';

import { Button } from '@/components/button';
import { useBody } from '@/hooks/use-body';
import { Placeholder } from '@/screens/placeholder';

// Placeholder until the real Fitting room: shows the shared engine running on the phone.
export default function FittingRoom() {
  const [body] = useBody();
  if (body === null) return null;
  const count = catalogueFor(GARMENTS, body.bodyType, 'matching').length;
  return (
    <Placeholder
      title="Fitting room"
      action={<Button variant="outline" size="sm" title="Edit body" onPress={() => router.push('/body')} />}>
      {`${body.heightCm} cm · ${count} garments in your sizing`}
    </Placeholder>
  );
}
