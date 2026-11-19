import type { BodyInput } from '../../domain/body';
import type { Closet as ClosetState } from '../state/useCloset';

export function Closet(_: { body: BodyInput; closet: ClosetState }) {
  return <main className="screen-stub">Closet</main>;
}
