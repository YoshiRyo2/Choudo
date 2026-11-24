import { G, Line, Rect, Text } from 'react-native-svg';

import { paint } from './paint';

/** A strip of tape measure up the left edge, marked every 10 cm, topped at the body's height (the web HeightTape). */
export function HeightTape({ heightCm, x }: { heightCm: number; x: number }) {
  const floor = heightCm; // the body stands on y = height
  const ticks = [];
  for (let cm = 0; cm <= 210; cm += 2) {
    const y = floor - cm;
    if (y < -4) break;
    const major = cm % 10 === 0;
    ticks.push(
      <G key={cm}>
        <Line {...paint.tape.tick} x1={x} x2={x + (major ? 3.2 : 1.6)} y1={y} y2={y} />
        {major && cm > 0 && cm % 20 === 0 && (
          <Text {...paint.tape.num} x={x + 3.8} y={y + 1.2}>
            {String(cm)}
          </Text>
        )}
      </G>,
    );
  }
  return (
    <G testID="height-tape">
      <Rect {...paint.tape.strip} x={x} y={-4} width={8.5} height={floor + 4} />
      {ticks}
      <Line {...paint.tape.mark} x1={x - 1} x2={x + 24} y1={0} y2={0} />
      <Text {...paint.tape.reading} x={x + 10} y={-1.2}>
        {`${Math.round(heightCm)} cm`}
      </Text>
    </G>
  );
}
