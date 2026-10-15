export type SwipeDirection = 'left' | 'right';

// Ignore taps, vertical scrolling and ambiguous diagonal gestures.
export function swipeDirection(dx: number, dy: number): SwipeDirection | null {
  if (Math.abs(dx) < 50 || Math.abs(dx) <= Math.abs(dy) * 1.4) return null;
  return dx < 0 ? 'left' : 'right';
}
