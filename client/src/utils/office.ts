export type Position = { x: number; y: number };
export type Bounds = { width: number; height: number };
export type Direction = { dx: number; dy: number };

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
