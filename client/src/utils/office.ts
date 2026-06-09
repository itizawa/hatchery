export type Position = { x: number; y: number };
export type Bounds = { width: number; height: number };
export type Direction = { dx: number; dy: number };

/** 仮想オフィスの最大サイズ（論理上限・アスペクト比の基準）。 */
export const OFFICE_MAX_BOUNDS: Bounds = { width: 800, height: 500 };

/**
 * コンテナ実幅から、上限 `maxBounds.width` でクランプしつつ
 * `maxBounds` のアスペクト比を維持した bounds を算出する純粋関数。
 *
 * - `containerWidth >= maxBounds.width` → `maxBounds` を返す（上限クランプ）。
 * - `0 < containerWidth < maxBounds.width` → 幅にフィットし高さをアスペクト比で算出。
 * - `containerWidth <= 0`（測定前など） → `{ width: 0, height: 0 }`（描画抑制用ガード）。
 */
export function officeBounds(
  containerWidth: number,
  maxBounds: Bounds = OFFICE_MAX_BOUNDS,
): Bounds {
  if (containerWidth <= 0) {
    return { width: 0, height: 0 };
  }
  if (containerWidth >= maxBounds.width) {
    return { width: maxBounds.width, height: maxBounds.height };
  }
  const aspect = maxBounds.height / maxBounds.width;
  return { width: containerWidth, height: containerWidth * aspect };
}

export function clampPosition(pos: Position, bounds: Bounds, charSize: number): Position {
  return {
    x: Math.max(0, Math.min(bounds.width - charSize, pos.x)),
    y: Math.max(0, Math.min(bounds.height - charSize, pos.y)),
  };
}

export function nextPosition(
  pos: Position,
  direction: Direction,
  speed: number,
  bounds: Bounds,
  charSize: number,
): { position: Position; direction: Direction } {
  let { dx, dy } = direction;
  let newX = pos.x + dx * speed;
  let newY = pos.y + dy * speed;

  if (newX <= 0 || newX >= bounds.width - charSize) {
    dx = -dx;
    newX = Math.max(0, Math.min(bounds.width - charSize, newX));
  }
  if (newY <= 0 || newY >= bounds.height - charSize) {
    dy = -dy;
    newY = Math.max(0, Math.min(bounds.height - charSize, newY));
  }

  return { position: { x: newX, y: newY }, direction: { dx, dy } };
}

export function randomDirection(): Direction {
  const angle = Math.random() * 2 * Math.PI;
  return { dx: Math.cos(angle), dy: Math.sin(angle) };
}

export function randomPosition(bounds: Bounds, charSize: number): Position {
  return {
    x: Math.random() * (bounds.width - charSize),
    y: Math.random() * (bounds.height - charSize),
  };
}
