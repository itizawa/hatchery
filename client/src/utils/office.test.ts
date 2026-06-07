import { describe, expect, it } from "vitest";
import { clampPosition, nextPosition } from "./office.js";

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
