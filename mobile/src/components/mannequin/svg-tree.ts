/** Test helpers: walk a rendered react-native-svg tree (toJSON) by host type. */
import { processColor } from 'react-native';

export interface Node {
  type: string;
  props: Record<string, unknown>;
  children: Node[] | null;
}

type Json = Node | Node[] | string | null;

/** Every host node of this type (e.g. "RNSVGPath"), in document order. */
export function nodes(tree: Json, type?: string): Node[] {
  if (tree === null || typeof tree === 'string') return [];
  if (Array.isArray(tree)) return tree.flatMap((t) => nodes(t, type));
  const own = type === undefined || tree.type === type ? [tree] : [];
  return [...own, ...nodes((tree.children ?? []) as Node[], type)];
}

/** The first node with this testID, or undefined. */
export function byTestId(tree: Json, testID: string): Node | undefined {
  return nodes(tree).find((n) => n.props.testID === testID);
}

/** A colour as react-native-svg stores it on a host node. */
export const brush = (color: string) => ({ type: 0, payload: processColor(color) });

/** The tree with every node carrying this testID removed. */
export function without(tree: Json, testID: string): Json {
  if (tree === null || typeof tree === 'string') return tree;
  if (Array.isArray(tree)) return tree.map((t) => without(t, testID)).filter((t) => t !== null) as Node[];
  if (tree.props.testID === testID) return null;
  return {
    ...tree,
    children: tree.children ? ((tree.children as Node[]).map((c) => without(c, testID)).filter((c) => c !== null) as Node[]) : null,
  };
}
