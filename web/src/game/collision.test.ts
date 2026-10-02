import { describe, expect, it } from 'vitest';
import { aabb, circle, resolveCollisions } from './collision';

const bounds = { minX: -10, maxX: 10, minZ: -10, maxZ: 10 };

describe('collision resolution', () => {
  it('keeps a body outside an axis-aligned building', () => {
    const house = aabb(0, 0, 4, 4);
    const p = { x: 2.1, z: 0 };
    expect(resolveCollisions(p, 0.5, [house], bounds)).toBe(true);
    expect(p.x).toBeCloseTo(2.5, 5);
    expect(p.z).toBeCloseTo(0, 5);
  });

  it('slides along a wall rather than stopping dead', () => {
    const house = aabb(0, 0, 4, 4);
    const p = { x: 2.2, z: 1.0 };
    resolveCollisions(p, 0.5, [house], bounds);
    expect(p.x).toBeCloseTo(2.5, 5);
    expect(p.z).toBeCloseTo(1.0, 5);
  });

  it('pushes a body out of a round pond', () => {
    const pond = circle(0, 0, 3);
    const p = { x: 1, z: 1 };
    resolveCollisions(p, 0.4, [pond], bounds);
    expect(Math.hypot(p.x, p.z)).toBeCloseTo(3.4, 5);
  });

  it('clamps to the fence bounds', () => {
    const p = { x: 30, z: -30 };
    resolveCollisions(p, 0.5, [], bounds);
    expect(p).toEqual({ x: 9.5, z: -9.5 });
  });

  it('leaves free positions untouched', () => {
    const p = { x: 5, z: 5 };
    expect(resolveCollisions(p, 0.5, [aabb(0, 0, 2, 2), circle(-4, -4, 1)], bounds)).toBe(false);
    expect(p).toEqual({ x: 5, z: 5 });
  });
});
