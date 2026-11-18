import { estimateBody } from './domain/body';
import { fitGarment, recommendSize } from './domain/fit';
import { findGarment } from './domain/garments';
import { Mannequin } from './ui/components/Mannequin/Mannequin';

// Temporary preview page for the mannequin; replaced by the real screens next.
const bodies = [
  { heightCm: 165, weightKg: 58 },
  { heightCm: 176, weightKg: 85 },
  { heightCm: 190, weightKg: 110 },
].map((b) => estimateBody({ ...b, sizing: 'mens' }));

export function App() {
  const top = findGarment('knightweave-tee')!;
  const bottom = findGarment('corvo-slim-jean')!;
  return (
    <main style={{ display: 'flex', gap: 8, padding: 16, height: '90dvh' }}>
      {bodies.map((body, i) => {
        const topSize = recommendSize(body, top) ?? top.sizes[0]!.label;
        const bottomSize = recommendSize(body, bottom) ?? bottom.sizes[0]!.label;
        return (
          <div key={i} style={{ flex: 1 }}>
            <Mannequin
              body={body.measurements}
              top={{ garment: top, sizeLabel: topSize, fit: fitGarment(body, top, topSize) }}
              bottom={{ garment: bottom, sizeLabel: bottomSize, fit: fitGarment(body, bottom, bottomSize) }}
            />
          </div>
        );
      })}
    </main>
  );
}
