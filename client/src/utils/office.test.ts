import { describe, expect, it } from "vitest";
import { OFFICE_MAX_BOUNDS, clampPosition, nextPosition, officeBounds } from "./office.js";

const BOUNDS = { width: 800, height: 500 };
const CHAR_SIZE = 48;

describe("clampPosition", () => {
  it("leaves position within bounds unchanged", () => {
    expect(clampPosition({ x: 100, y: 100 }, BOUNDS, CHAR_SIZE)).toEqual({ x: 100, y: 100 });
  });

  it("clamps negative x to 0", () => {
    expect(clampPosition({ x: -10, y: 100 }, BOUNDS, CHAR_SIZE).x).toBe(0);
  });

  it("clamps x exceeding right bound", () => {
    expect(clampPosition({ x: 800, y: 100 }, BOUNDS, CHAR_SIZE).x).toBe(800 - CHAR_SIZE);
  });

  it("clamps negative y to 0", () => {
    expect(clampPosition({ x: 100, y: -5 }, BOUNDS, CHAR_SIZE).y).toBe(0);
  });

  it("clamps y exceeding bottom bound", () => {
    expect(clampPosition({ x: 100, y: 500 }, BOUNDS, CHAR_SIZE).y).toBe(500 - CHAR_SIZE);
  });
});

describe("nextPosition", () => {
  const SPEED = 1;

  it("moves x in the positive direction", () => {
    const result = nextPosition({ x: 100, y: 100 }, { dx: 1, dy: 0 }, SPEED, BOUNDS, CHAR_SIZE);
    expect(result.position.x).toBe(101);
    expect(result.direction.dx).toBe(1);
  });

  it("moves y in the positive direction", () => {
    const result = nextPosition({ x: 100, y: 100 }, { dx: 0, dy: 1 }, SPEED, BOUNDS, CHAR_SIZE);
    expect(result.position.y).toBe(101);
    expect(result.direction.dy).toBe(1);
  });

  it("bounces dx when hitting the right wall", () => {
    // x = 752 = 800 - 48 (right edge), dx = 1 => newX = 753 >= 752 => bounce
    const result = nextPosition({ x: 752, y: 100 }, { dx: 1, dy: 0 }, SPEED, BOUNDS, CHAR_SIZE);
    expect(result.direction.dx).toBe(-1);
    expect(result.position.x).toBeLessThanOrEqual(800 - CHAR_SIZE);
  });

  it("bounces dx when hitting the left wall", () => {
    // x = 0, dx = -1 => newX = -1 <= 0 => bounce
    const result = nextPosition({ x: 0, y: 100 }, { dx: -1, dy: 0 }, SPEED, BOUNDS, CHAR_SIZE);
    expect(result.direction.dx).toBe(1);
    expect(result.position.x).toBeGreaterThanOrEqual(0);
  });

  it("bounces dy when hitting the bottom wall", () => {
    // y = 452 = 500 - 48 (bottom edge), dy = 1 => newY = 453 >= 452 => bounce
    const result = nextPosition({ x: 100, y: 452 }, { dx: 0, dy: 1 }, SPEED, BOUNDS, CHAR_SIZE);
    expect(result.direction.dy).toBe(-1);
    expect(result.position.y).toBeLessThanOrEqual(500 - CHAR_SIZE);
  });

  it("bounces dy when hitting the top wall", () => {
    // y = 0, dy = -1 => newY = -1 <= 0 => bounce
    const result = nextPosition({ x: 100, y: 0 }, { dx: 0, dy: -1 }, SPEED, BOUNDS, CHAR_SIZE);
    expect(result.direction.dy).toBe(1);
    expect(result.position.y).toBeGreaterThanOrEqual(0);
  });
});

describe("officeBounds (#280)", () => {
  it("OFFICE_MAX_BOUNDS は 800x500", () => {
    expect(OFFICE_MAX_BOUNDS).toEqual({ width: 800, height: 500 });
  });

  it("コンテナ幅が上限以上なら上限 800x500 にクランプする", () => {
    expect(officeBounds(1000)).toEqual({ width: 800, height: 500 });
    expect(officeBounds(800)).toEqual({ width: 800, height: 500 });
  });

  it("コンテナ幅が上限未満ならコンテナ幅にフィットしアスペクト比 800:500 を維持する", () => {
    expect(officeBounds(400)).toEqual({ width: 400, height: 250 });
    expect(officeBounds(640)).toEqual({ width: 640, height: 400 });
  });

  it("算出された width は常に上限 800 以下", () => {
    for (const w of [0, 100, 320, 799, 800, 1200]) {
      expect(officeBounds(w).width).toBeLessThanOrEqual(800);
    }
  });

  it("コンテナ幅が 0 以下なら {0,0} を返す（測定前ガード）", () => {
    expect(officeBounds(0)).toEqual({ width: 0, height: 0 });
    expect(officeBounds(-50)).toEqual({ width: 0, height: 0 });
  });

  it("maxBounds を指定するとその上限・アスペクト比に従う", () => {
    expect(officeBounds(2000, { width: 600, height: 300 })).toEqual({ width: 600, height: 300 });
    expect(officeBounds(300, { width: 600, height: 300 })).toEqual({ width: 300, height: 150 });
  });
});
