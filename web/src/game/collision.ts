export type Collider =
  | { kind: 'aabb'; minX: number; maxX: number; minZ: number; maxZ: number; label?: string }
  | { kind: 'circle'; x: number; z: number; r: number; label?: string };

export interface Bounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export function aabb(cx: number, cz: number, w: number, d: number, label?: string): Collider {
  return { kind: 'aabb', minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2, label };
}

export function circle(x: number, z: number, r: number, label?: string): Collider {
  return { kind: 'circle', x, z, r, label };
}

/**
 * Push a circular body (centre `p`, radius `r`) out of every collider and the
 * world bounds. Two passes keep corners stable when two shapes overlap.
 * Returns true when any collider was touched.
 */
export function resolveCollisions(
  p: { x: number; z: number },
  r: number,
  colliders: readonly Collider[],
  bounds: Bounds,
): boolean {
  let touched = false;
  for (let pass = 0; pass < 2; pass++) {
    for (const c of colliders) {
      if (c.kind === 'aabb') {
        const nx = Math.max(c.minX, Math.min(p.x, c.maxX));
        const nz = Math.max(c.minZ, Math.min(p.z, c.maxZ));
        let dx = p.x - nx;
        let dz = p.z - nz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        touched = true;
        if (d2 < 1e-9) {
          // Centre is inside the box: push out through the nearest face.
          const left = p.x - c.minX;
          const right = c.maxX - p.x;
          const front = p.z - c.minZ;
          const back = c.maxZ - p.z;
          const m = Math.min(left, right, front, back);
          if (m === left) p.x = c.minX - r;
          else if (m === right) p.x = c.maxX + r;
          else if (m === front) p.z = c.minZ - r;
          else p.z = c.maxZ + r;
          continue;
        }
        const d = Math.sqrt(d2);
        dx /= d;
        dz /= d;
        p.x = nx + dx * r;
        p.z = nz + dz * r;
      } else {
        let dx = p.x - c.x;
        let dz = p.z - c.z;
        const min = r + c.r;
        const d2 = dx * dx + dz * dz;
        if (d2 >= min * min) continue;
        touched = true;
        const d = Math.sqrt(d2) || 1e-6;
        dx /= d;
        dz /= d;
        p.x = c.x + dx * min;
        p.z = c.z + dz * min;
      }
    }
    const bx = Math.max(bounds.minX + r, Math.min(p.x, bounds.maxX - r));
    const bz = Math.max(bounds.minZ + r, Math.min(p.z, bounds.maxZ - r));
    if (bx !== p.x || bz !== p.z) touched = true;
    p.x = bx;
    p.z = bz;
  }
  return touched;
}
