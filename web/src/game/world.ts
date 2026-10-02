import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { aabb, circle, type Bounds, type Collider } from './collision';
import { PALETTE, glow, solid, toon } from './materials';
import {
  glowSpriteTexture,
  grassTexture,
  plaqueTexture,
  prizeCardTexture,
  seeded,
  signTexture,
  stoneTexture,
  wheelTexture,
  type SignTexture,
} from './textures';

export const WORLD_BOUNDS: Bounds = { minX: -23.5, maxX: 23.5, minZ: -21.5, maxZ: 22.5 };

export const POND = { x: -11, z: 9, r: 4.6, surfaceY: 0.03 };
export const BENCH = { x: -8.6, z: -4.2, rotationY: Math.PI / 2, seatHeight: 0.5 };
export const WHEEL = { x: 10.2, z: -1.2, hubY: 1.75, radius: 1.35, facingY: -Math.PI / 2 };
export const ARCH = { z: 17, halfWidth: 4.0, postHeight: 3.4 };
export const PRIZE_STAND = { x: 5.9, z: 17.4 };
export const SPAWN = { x: 0, z: 20.4, heading: Math.PI };

export interface Bulb {
  mesh: THREE.Mesh;
  sprite: THREE.Sprite;
  on: THREE.Material;
  off: THREE.Material;
  index: number;
}

export interface World {
  group: THREE.Group;
  colliders: Collider[];
  bounds: Bounds;
  wheelDisc: THREE.Group;
  wheelGroup: THREE.Group;
  signBoard: THREE.Mesh;
  prizeCard: THREE.Mesh;
  sign: SignTexture;
  bulbs: Bulb[];
  water: THREE.Mesh;
  clouds: THREE.Object3D[];
  /** Spawn an expanding ring on the pond surface. */
  spawnRipple(x: number, z: number, strength?: number): void;
  update(dt: number, t: number): void;
}

const rnd = seeded(2026);

export function buildWorld(): World {
  const group = new THREE.Group();
  const colliders: Collider[] = [];

  // --- Ground, paths and plaza -------------------------------------------
  const grass = grassTexture(28);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), toon(0xffffff, { map: grass }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  const stone = stoneTexture(1);
  const stoneMat = toon(0xffffff, { map: stone });
  const path = (x: number, z: number, w: number, d: number, rotY = 0) => {
    const geo = new THREE.PlaneGeometry(w, d);
    const uv = geo.getAttribute('uv') as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (w / 2.2), uv.getY(i) * (d / 2.2));
    const m = new THREE.Mesh(geo, stoneMat);
    m.rotation.set(-Math.PI / 2, 0, rotY);
    m.position.set(x, 0.015, z);
    m.receiveShadow = true;
    group.add(m);
  };
  const plazaGeo = new THREE.CircleGeometry(7.2, 48);
  const puv = plazaGeo.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < puv.count; i++) puv.setXY(i, puv.getX(i) * 6.5, puv.getY(i) * 6.5);
  const plaza = new THREE.Mesh(plazaGeo, stoneMat);
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.y = 0.02;
  plaza.receiveShadow = true;
  group.add(plaza);
  const rim = new THREE.Mesh(new THREE.RingGeometry(7.2, 7.6, 48), toon(0xb3a894));
  rim.rotation.x = -Math.PI / 2;
  rim.position.y = 0.018;
  rim.receiveShadow = true;
  group.add(rim);
  path(0, 14, 3.2, 16); // entrance to plaza
  path(0, 21, 5, 4); // spawn pad
  path(9, -1.2, 5, 2.6); // to the wheel
  path(-8.5, -4.2, 5, 2.6); // to the bench
  path(-6.4, 7.2, 2.6, 5, Math.PI / 4); // to the pond
  path(0, -9.5, 3, 5); // to the town hall

  // --- Pond ------------------------------------------------------------
  const sand = new THREE.Mesh(new THREE.CircleGeometry(POND.r + 0.9, 40), toon(PALETTE.sand));
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(POND.x, 0.022, POND.z);
  sand.receiveShadow = true;
  group.add(sand);
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(POND.r, 40),
    new THREE.MeshToonMaterial({ color: PALETTE.water, transparent: true, opacity: 0.92 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(POND.x, POND.surfaceY, POND.z);
  water.receiveShadow = true;
  group.add(water);
  const shimmerMat = new THREE.MeshBasicMaterial({ color: 0xbfe9ff, transparent: true, opacity: 0.5 });
  for (let i = 0; i < 7; i++) {
    const a = rnd() * Math.PI * 2;
    const d = rnd() * (POND.r - 1.2);
    const s = new THREE.Mesh(new THREE.CircleGeometry(0.22 + rnd() * 0.3, 10), shimmerMat);
    s.rotation.x = -Math.PI / 2;
    s.scale.x = 2.2;
    s.position.set(POND.x + Math.cos(a) * d, POND.surfaceY + 0.004, POND.z + Math.sin(a) * d);
    group.add(s);
  }
  // Lily pads and reeds
  const padMat = toon(0x3f9d4a);
  for (let i = 0; i < 6; i++) {
    const a = rnd() * Math.PI * 2;
    const d = 1 + rnd() * (POND.r - 1.6);
    const pad = new THREE.Mesh(new THREE.CircleGeometry(0.3 + rnd() * 0.2, 14, 0.4, Math.PI * 1.8), padMat);
    pad.rotation.x = -Math.PI / 2;
    pad.rotation.z = rnd() * Math.PI * 2;
    pad.position.set(POND.x + Math.cos(a) * d, POND.surfaceY + 0.008, POND.z + Math.sin(a) * d);
    pad.receiveShadow = true;
    group.add(pad);
    if (rnd() < 0.5) {
      const flower = solid(new THREE.SphereGeometry(0.09, 8, 6), toon(0xff8fb1), { outline: 0.012 });
      flower.position.copy(pad.position).add(new THREE.Vector3(0, 0.08, 0));
      group.add(flower);
    }
  }
  const reedMat = toon(0x6b9b3a);
  for (let i = 0; i < 14; i++) {
    const a = Math.PI * 0.6 + rnd() * Math.PI * 1.3; // keep the fishing bank clear
    const d = POND.r + 0.2 + rnd() * 0.5;
    const h = 0.6 + rnd() * 0.6;
    const reed = solid(new THREE.CylinderGeometry(0.03, 0.045, h, 6), reedMat, { outline: 0.012 });
    reed.position.set(POND.x + Math.cos(a) * d, h / 2, POND.z + Math.sin(a) * d);
    reed.rotation.z = (rnd() - 0.5) * 0.3;
    group.add(reed);
  }
  // Stone rim around the pond
  const rimStoneMat = toon(0xb9b1a3);
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    const st = solid(new RoundedBoxGeometry(0.5 + rnd() * 0.3, 0.22, 0.4, 2, 0.08), rimStoneMat, { outline: 0.02 });
    st.position.set(POND.x + Math.cos(a) * (POND.r + 0.55), 0.1, POND.z + Math.sin(a) * (POND.r + 0.55));
    st.rotation.y = -a;
    group.add(st);
  }
  colliders.push(circle(POND.x, POND.z, POND.r + 0.75, 'pond'));

  // Ripples
  const ripples: { mesh: THREE.Mesh; age: number; life: number }[] = [];
  const rippleGeo = new THREE.RingGeometry(0.85, 1, 32);
  const spawnRipple = (x: number, z: number, strength = 1) => {
    const mat = new THREE.MeshBasicMaterial({ color: 0xe8f8ff, transparent: true, opacity: 0.8, depthWrite: false });
    const m = new THREE.Mesh(rippleGeo, mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, POND.surfaceY + 0.01, z);
    m.scale.setScalar(0.15 * strength);
    group.add(m);
    ripples.push({ mesh: m, age: 0, life: 1.6 + strength * 0.4 });
  };

  // --- Buildings ---------------------------------------------------------
  const house = (opts: {
    x: number;
    z: number;
    w: number;
    d: number;
    h: number;
    wall: number;
    roof: number;
    facing: 'north' | 'south' | 'east' | 'west';
    label?: string;
    awning?: number;
  }) => {
    const g = new THREE.Group();
    g.position.set(opts.x, 0, opts.z);
    const rot = { south: 0, west: Math.PI / 2, north: Math.PI, east: -Math.PI / 2 }[opts.facing];
    g.rotation.y = rot;
    // After rotation the local +z face is the front (door side).
    const w = opts.facing === 'south' || opts.facing === 'north' ? opts.w : opts.d;
    const d = opts.facing === 'south' || opts.facing === 'north' ? opts.d : opts.w;
    const walls = solid(new RoundedBoxGeometry(w, opts.h, d, 3, 0.12), toon(opts.wall), { outline: 0.04 });
    walls.position.y = opts.h / 2;
    g.add(walls);
    const roof = solid(new THREE.ConeGeometry(1, opts.h * 0.55, 4), toon(opts.roof), { outline: 0.04 });
    roof.rotation.y = Math.PI / 4;
    roof.scale.set((w / 2 + 0.45) * Math.SQRT2, 1, (d / 2 + 0.45) * Math.SQRT2);
    roof.position.y = opts.h + (opts.h * 0.55) / 2 - 0.05;
    g.add(roof);
    const eave = solid(new THREE.BoxGeometry(w + 0.9, 0.18, d + 0.9), toon(opts.roof), { outline: 0.03 });
    eave.position.y = opts.h + 0.02;
    g.add(eave);
    const chimney = solid(new THREE.BoxGeometry(0.5, 1, 0.5), toon(0xb08968), { outline: 0.03 });
    chimney.position.set(-w / 4, opts.h + 0.6, -d / 5);
    g.add(chimney);
    const door = solid(new RoundedBoxGeometry(1.05, 1.9, 0.18, 2, 0.12), toon(PALETTE.woodDark), { outline: 0.03 });
    door.position.set(0, 0.95, d / 2 + 0.02);
    g.add(door);
    const knob = solid(new THREE.SphereGeometry(0.06, 8, 6), toon(PALETTE.gold), { outline: 0.01 });
    knob.position.set(0.32, 0.95, d / 2 + 0.13);
    g.add(knob);
    const winFrame = toon(0xffffff);
    const winGlass = toon(0x9fd6f5);
    const windows: [number, number, number][] = [
      [-w / 2 + 1.1, opts.h * 0.58, d / 2],
      [w / 2 - 1.1, opts.h * 0.58, d / 2],
      [-w / 2, opts.h * 0.58, 0],
      [w / 2, opts.h * 0.58, 0],
    ];
    for (const [wx, wy, wz] of windows) {
      const side = Math.abs(wx) === w / 2;
      const frame = solid(new RoundedBoxGeometry(0.95, 0.95, 0.14, 2, 0.08), winFrame, { outline: 0.025 });
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.72), winGlass);
      if (side) {
        frame.rotation.y = Math.PI / 2;
        frame.position.set(wx + Math.sign(wx) * 0.03, wy, wz);
        glass.rotation.y = Math.sign(wx) * Math.PI / 2;
        glass.position.set(wx + Math.sign(wx) * 0.11, wy, wz);
      } else {
        frame.position.set(wx, wy, wz + 0.03);
        glass.position.set(wx, wy, wz + 0.11);
      }
      g.add(frame, glass);
    }
    if (opts.awning !== undefined) {
      const aw = solid(new THREE.BoxGeometry(2.4, 0.12, 1.1), toon(opts.awning), { outline: 0.03 });
      aw.position.set(0, 2.2, d / 2 + 0.55);
      aw.rotation.x = 0.25;
      g.add(aw);
    }
    if (opts.label) {
      const plaque = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.75), new THREE.MeshBasicMaterial({ map: plaqueTexture(opts.label) }));
      plaque.position.set(0, opts.h - 0.55, d / 2 + 0.1);
      g.add(plaque);
    }
    group.add(g);
    colliders.push(aabb(opts.x, opts.z, opts.w + 0.5, opts.d + 0.5, opts.label ?? 'house'));
  };

  house({ x: -11, z: -11.5, w: 6.5, d: 5.5, h: 3.3, wall: PALETTE.pastelPink, roof: PALETTE.roofRed, facing: 'south', label: 'BAKERY', awning: 0xff8fa3 });
  house({ x: 0, z: -14.5, w: 9, d: 6, h: 4.2, wall: PALETTE.pastelYellow, roof: PALETTE.roofTeal, facing: 'south', label: 'TOWN HALL' });
  house({ x: 11, z: -11.5, w: 6.5, d: 5.5, h: 3.3, wall: PALETTE.pastelMint, roof: PALETTE.roofPlum, facing: 'south', label: 'SHOP', awning: 0x6bcb77 });
  house({ x: 16, z: 5, w: 5, d: 5.5, h: 3.1, wall: PALETTE.pastelLilac, roof: PALETTE.roofOrange, facing: 'west' });
  house({ x: -17, z: -2, w: 5, d: 5.5, h: 3.1, wall: PALETTE.pastelPeach, roof: PALETTE.roofTeal, facing: 'east' });
  house({ x: 14.5, z: 14, w: 5, d: 5, h: 3, wall: PALETTE.pastelBlue, roof: PALETTE.roofRed, facing: 'west' });

  // --- Trees, bushes, flowers ------------------------------------------------
  const trunkMat = toon(PALETTE.trunk);
  const leafMat = toon(PALETTE.leaf);
  const leafLightMat = toon(PALETTE.leafLight);
  const tree = (x: number, z: number, s = 1) => {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.scale.setScalar(s);
    const trunk = solid(new THREE.CylinderGeometry(0.22, 0.3, 1.6, 10), trunkMat);
    trunk.position.y = 0.8;
    g.add(trunk);
    const blobs: [number, number, number, number][] = [
      [0, 2.1, 0, 1.05],
      [-0.6, 1.7, 0.2, 0.7],
      [0.6, 1.8, -0.1, 0.72],
      [0.1, 2.75, 0.1, 0.7],
    ];
    blobs.forEach(([bx, by, bz, r], i) => {
      const b = solid(new THREE.SphereGeometry(r, 16, 12), i === 3 ? leafLightMat : leafMat, { outline: 0.045 });
      b.position.set(bx, by, bz);
      g.add(b);
    });
    group.add(g);
    colliders.push(circle(x, z, 0.55 * s, 'tree'));
  };
  const trees: [number, number, number][] = [
    [-20, -17, 1.2],
    [-19, 15, 1.1],
    [19, -17, 1.2],
    [20.5, 9.5, 1],
    [-6.5, -15.5, 0.9],
    [6.5, -16, 0.9],
    [-21, 5, 1.1],
    [20.5, -4, 1],
    [-16, 17, 1],
    [19, 19, 1.1],
    [-9, 15.5, 0.9],
    [9.5, 10, 0.95],
    [-14.5, 4, 0.85],
    [6.5, 13, 0.9],
    [-6, 19.5, 0.9],
    [12, 19.5, 0.9],
    [-19.5, -8, 1],
    [21, 17, 0.9],
  ];
  for (const [x, z, s] of trees) tree(x, z, s);

  const bush = (x: number, z: number, s = 1) => {
    const b = solid(new THREE.SphereGeometry(0.55, 14, 10), leafLightMat, { outline: 0.035 });
    b.scale.set(s * 1.3, s * 0.8, s);
    b.position.set(x, 0.35 * s, z);
    group.add(b);
    colliders.push(circle(x, z, 0.6 * s, 'bush'));
  };
  bush(-5.5, -10, 1.1);
  bush(5.5, -10, 1.1);
  bush(-14, -7, 0.9);
  bush(13.5, 1, 0.9);
  bush(-13, 14, 0.9);
  bush(8, 16.5, 0.9);
  bush(-8, 17.5, 0.9);

  const flowerColors = [0xff6b6b, 0xffd93d, 0xff8fb1, 0xffffff, 0xc77dff];
  const stemMat = toon(0x4e9a3b);
  const flowerBed = (x: number, z: number, r: number, count: number) => {
    for (let i = 0; i < count; i++) {
      const a = rnd() * Math.PI * 2;
      const d = Math.sqrt(rnd()) * r;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.35, 5), stemMat);
      stem.position.set(x + Math.cos(a) * d, 0.17, z + Math.sin(a) * d);
      group.add(stem);
      const head = solid(new THREE.SphereGeometry(0.1, 8, 6), toon(flowerColors[Math.floor(rnd() * flowerColors.length)] ?? 0xffffff), { outline: 0.012, shadow: false });
      head.position.set(stem.position.x, 0.38, stem.position.z);
      group.add(head);
    }
  };
  // Central planter in the square
  const planter = solid(new THREE.CylinderGeometry(1.2, 1.3, 0.5, 20), toon(0xb3a894), { outline: 0.03 });
  planter.position.set(2.6, 0.25, -2.8);
  group.add(planter);
  const soil = new THREE.Mesh(new THREE.CircleGeometry(1.1, 20), toon(0x6e4a26));
  soil.rotation.x = -Math.PI / 2;
  soil.position.set(2.6, 0.51, -2.8);
  group.add(soil);
  flowerBed(2.6, -2.8, 0.9, 14);
  colliders.push(circle(2.6, -2.8, 1.35, 'planter'));
  flowerBed(-11, -8.2, 1.4, 10);
  flowerBed(11, -8.2, 1.4, 10);
  flowerBed(-3.2, 12, 0.9, 8);
  flowerBed(3.2, 12, 0.9, 8);
  // Raise the planter flowers onto the soil
  group.children.forEach((c) => {
    if (c instanceof THREE.Mesh && Math.hypot(c.position.x - 2.6, c.position.z + 2.8) < 1.05 && c.position.y < 0.5) c.position.y += 0.5;
  });

  // --- Lamp posts ----------------------------------------------------------
  const lamp = (x: number, z: number) => {
    const pole = solid(new THREE.CylinderGeometry(0.07, 0.1, 3, 10), toon(0x3b3f4a), { outline: 0.025 });
    pole.position.set(x, 1.5, z);
    group.add(pole);
    const headG = solid(new RoundedBoxGeometry(0.5, 0.5, 0.5, 2, 0.1), toon(0x3b3f4a), { outline: 0.025 });
    headG.position.set(x, 3.2, z);
    group.add(headG);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), glow(0xfff1b0));
    bulb.position.set(x, 3.2, z);
    group.add(bulb);
    colliders.push(circle(x, z, 0.28, 'lamp'));
  };
  lamp(-2.9, 12.5);
  lamp(2.9, 12.5);
  lamp(-5.5, -5.5);
  lamp(5.5, -5.5);

  // --- Bench --------------------------------------------------------------
  const benchG = new THREE.Group();
  benchG.position.set(BENCH.x, 0, BENCH.z);
  benchG.rotation.y = BENCH.rotationY;
  const woodMat = toon(PALETTE.wood);
  const seat = solid(new RoundedBoxGeometry(2.1, 0.12, 0.7, 2, 0.04), woodMat, { outline: 0.025 });
  seat.position.y = BENCH.seatHeight;
  benchG.add(seat);
  const back = solid(new RoundedBoxGeometry(2.1, 0.55, 0.1, 2, 0.04), woodMat, { outline: 0.025 });
  back.position.set(0, BENCH.seatHeight + 0.42, -0.3);
  back.rotation.x = -0.15;
  benchG.add(back);
  for (const s of [-1, 1]) {
    const leg = solid(new THREE.BoxGeometry(0.12, BENCH.seatHeight, 0.6), toon(0x3b3f4a), { outline: 0.02 });
    leg.position.set(s * 0.9, BENCH.seatHeight / 2, 0);
    benchG.add(leg);
  }
  group.add(benchG);
  colliders.push(aabb(BENCH.x, BENCH.z, 1.3, 2.6, 'bench'));

  // --- Prize wheel ---------------------------------------------------------
  const wheelGroup = new THREE.Group();
  wheelGroup.position.set(WHEEL.x, 0, WHEEL.z);
  wheelGroup.rotation.y = WHEEL.facingY;
  const standMat = toon(0x3b3f4a);
  for (const s of [-1, 1]) {
    const leg = solid(new THREE.CylinderGeometry(0.09, 0.11, WHEEL.hubY + 0.3, 10), standMat, { outline: 0.025 });
    leg.position.set(s * 0.55, (WHEEL.hubY + 0.3) / 2, -0.35);
    leg.rotation.x = -0.18;
    wheelGroup.add(leg);
  }
  const base = solid(new RoundedBoxGeometry(1.8, 0.2, 1.1, 2, 0.06), standMat, { outline: 0.03 });
  base.position.set(0, 0.1, -0.2);
  wheelGroup.add(base);
  const axle = solid(new THREE.CylinderGeometry(0.08, 0.08, 0.9, 10), standMat, { outline: 0.02 });
  axle.rotation.x = Math.PI / 2;
  axle.position.set(0, WHEEL.hubY, -0.3);
  wheelGroup.add(axle);
  const wheelDisc = new THREE.Group();
  wheelDisc.position.set(0, WHEEL.hubY, 0.1);
  const rimMesh = solid(new THREE.CylinderGeometry(WHEEL.radius, WHEEL.radius, 0.16, 48), toon(0xfff5cc), { outline: 0.035 });
  rimMesh.rotation.x = Math.PI / 2;
  wheelDisc.add(rimMesh);
  const face = new THREE.Mesh(new THREE.CircleGeometry(WHEEL.radius - 0.02, 48), new THREE.MeshBasicMaterial({ map: wheelTexture() }));
  face.position.z = 0.085;
  wheelDisc.add(face);
  const pegMat = toon(0x1d2a1b);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const peg = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), pegMat);
    peg.position.set(Math.cos(a) * (WHEEL.radius - 0.1), Math.sin(a) * (WHEEL.radius - 0.1), 0.12);
    wheelDisc.add(peg);
  }
  const hub = solid(new THREE.SphereGeometry(0.14, 12, 10), toon(PALETTE.gold), { outline: 0.02 });
  hub.position.z = 0.12;
  wheelDisc.add(hub);
  wheelGroup.add(wheelDisc);
  const pointer = solid(new THREE.ConeGeometry(0.13, 0.42, 3), toon(0xff3b3b), { outline: 0.025 });
  pointer.rotation.x = 0;
  pointer.rotation.z = Math.PI; // point downwards
  pointer.position.set(0, WHEEL.hubY + WHEEL.radius + 0.06, 0.2);
  wheelGroup.add(pointer);
  const bunting = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.5), new THREE.MeshBasicMaterial({ map: plaqueTexture('PRIZE WHEEL', '#ffd93d') }));
  bunting.position.set(0, WHEEL.hubY + WHEEL.radius + 0.75, 0.0);
  wheelGroup.add(bunting);
  group.add(wheelGroup);
  colliders.push(aabb(WHEEL.x, WHEEL.z, 1.3, 2.2, 'wheel'));

  // --- Entrance arch with the GRAND PRIZE sign -------------------------------
  const archMat = toon(0xfff1d6);
  for (const s of [-1, 1]) {
    const post = solid(new RoundedBoxGeometry(0.5, ARCH.postHeight, 0.5, 2, 0.08), archMat, { outline: 0.035 });
    post.position.set(s * ARCH.halfWidth, ARCH.postHeight / 2, ARCH.z);
    group.add(post);
    const cap = solid(new THREE.SphereGeometry(0.32, 12, 10), toon(PALETTE.gold), { outline: 0.025 });
    cap.position.set(s * ARCH.halfWidth, ARCH.postHeight + 0.2, ARCH.z);
    group.add(cap);
    colliders.push(aabb(s * ARCH.halfWidth, ARCH.z, 0.9, 0.9, 'arch-post'));
  }
  const beam = solid(new RoundedBoxGeometry(ARCH.halfWidth * 2 + 0.6, 0.34, 0.4, 2, 0.08), archMat, { outline: 0.035 });
  beam.position.set(0, ARCH.postHeight - 0.2, ARCH.z);
  group.add(beam);
  const sign = signTexture();
  const boardW = 7.6;
  const boardH = 2.8;
  const signBoard = new THREE.Mesh(new THREE.PlaneGeometry(boardW, boardH), new THREE.MeshBasicMaterial({ map: sign.texture }));
  const boardY = ARCH.postHeight + boardH / 2 + 0.2;
  signBoard.position.set(0, boardY, ARCH.z + 0.26);
  signBoard.name = 'grand-prize-sign';
  group.add(signBoard);
  const boardBack = solid(new RoundedBoxGeometry(boardW + 0.2, boardH + 0.2, 0.3, 2, 0.1), toon(0x1f2d4a), { outline: 0.04 });
  boardBack.position.set(0, boardY, ARCH.z + 0.05);
  boardBack.name = 'grand-prize-sign';
  group.add(boardBack);

  const bulbs: Bulb[] = [];
  const glowTex = glowSpriteTexture();
  const bulbGeo = new THREE.SphereGeometry(0.1, 10, 8);
  const mats = {
    greenOn: glow(PALETTE.neonGreen),
    greenOff: glow(0x1f7a3a),
    goldOn: glow(0xffe36e),
    goldOff: glow(0x8a6a16),
  };
  const addBulb = (x: number, y: number) => {
    const index = bulbs.length;
    const isGreen = index % 2 === 0;
    const mesh = new THREE.Mesh(bulbGeo, isGreen ? mats.greenOn : mats.goldOn);
    mesh.position.set(x, y, ARCH.z + 0.34);
    group.add(mesh);
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTex,
        color: isGreen ? PALETTE.neonGreen : 0xffd95a,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    sprite.scale.setScalar(0.7);
    sprite.position.set(x, y, ARCH.z + 0.36);
    group.add(sprite);
    bulbs.push({
      mesh,
      sprite,
      on: isGreen ? mats.greenOn : mats.goldOn,
      off: isGreen ? mats.greenOff : mats.goldOff,
      index,
    });
  };
  const perimeterStep = 0.7;
  const left = -boardW / 2;
  const right = boardW / 2;
  const bottom = boardY - boardH / 2;
  const top = boardY + boardH / 2;
  for (let x = left; x <= right + 0.01; x += perimeterStep) addBulb(x, top);
  for (let y = top - perimeterStep; y > bottom; y -= perimeterStep) addBulb(right, y);
  for (let x = right; x >= left - 0.01; x -= perimeterStep) addBulb(x, bottom);
  for (let y = bottom + perimeterStep; y < top; y += perimeterStep) addBulb(left, y);

  // Prize card on a stand beside the arch
  const standG = new THREE.Group();
  standG.position.set(PRIZE_STAND.x, 0, PRIZE_STAND.z);
  const standPole = solid(new THREE.CylinderGeometry(0.08, 0.1, 1.5, 10), toon(0x3b3f4a), { outline: 0.025 });
  standPole.position.y = 0.75;
  standG.add(standPole);
  const standFoot = solid(new THREE.CylinderGeometry(0.45, 0.5, 0.12, 14), toon(0x3b3f4a), { outline: 0.025 });
  standFoot.position.y = 0.06;
  standG.add(standFoot);
  const frame = solid(new RoundedBoxGeometry(1.75, 2.25, 0.12, 2, 0.08), toon(PALETTE.gold), { outline: 0.03 });
  frame.position.set(0, 2.4, 0);
  frame.name = 'grand-prize-sign';
  standG.add(frame);
  const prizeCard = new THREE.Mesh(new THREE.PlaneGeometry(1.55, 2.07), new THREE.MeshBasicMaterial({ map: prizeCardTexture() }));
  prizeCard.position.set(0, 2.4, 0.08);
  prizeCard.name = 'grand-prize-sign';
  standG.add(prizeCard);
  group.add(standG);
  colliders.push(aabb(PRIZE_STAND.x, PRIZE_STAND.z, 1.2, 0.8, 'prize-stand'));

  // --- Fence around the village ------------------------------------------------
  const fenceMat = toon(0xf4e7cf);
  const postGeo = new RoundedBoxGeometry(0.18, 1.0, 0.18, 2, 0.04);
  const fencePost = (x: number, z: number) => {
    const p = solid(postGeo, fenceMat, { outline: 0.02 });
    p.position.set(x, 0.5, z);
    group.add(p);
  };
  const rail = (x1: number, z1: number, x2: number, z2: number) => {
    const len = Math.hypot(x2 - x1, z2 - z1);
    for (const y of [0.35, 0.75]) {
      const r = solid(new THREE.BoxGeometry(len, 0.08, 0.06), fenceMat, { outline: 0.015 });
      r.position.set((x1 + x2) / 2, y, (z1 + z2) / 2);
      r.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
      group.add(r);
    }
  };
  const B = WORLD_BOUNDS;
  const step = 2.5;
  for (let x = B.minX; x <= B.maxX + 0.01; x += step) {
    fencePost(x, B.minZ - 0.3);
    fencePost(x, B.maxZ + 0.3);
  }
  for (let z = B.minZ; z <= B.maxZ + 0.01; z += step) {
    fencePost(B.minX - 0.3, z);
    fencePost(B.maxX + 0.3, z);
  }
  rail(B.minX, B.minZ - 0.3, B.maxX, B.minZ - 0.3);
  rail(B.minX, B.maxZ + 0.3, B.maxX, B.maxZ + 0.3);
  rail(B.minX - 0.3, B.minZ, B.minX - 0.3, B.maxZ);
  rail(B.maxX + 0.3, B.minZ, B.maxX + 0.3, B.maxZ);

  // --- Clouds -----------------------------------------------------------------
  const clouds: THREE.Object3D[] = [];
  const cloudMat = toon(0xffffff);
  for (let i = 0; i < 7; i++) {
    const c = new THREE.Group();
    const parts = 3 + Math.floor(rnd() * 3);
    for (let j = 0; j < parts; j++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.9 + rnd() * 0.9, 12, 8), cloudMat);
      b.position.set(j * 1.3 - parts * 0.6, rnd() * 0.4, rnd() * 0.6);
      b.scale.y = 0.65;
      c.add(b);
    }
    c.position.set(-40 + rnd() * 80, 16 + rnd() * 5, -30 + rnd() * 50);
    c.userData.speed = 0.4 + rnd() * 0.5;
    group.add(c);
    clouds.push(c);
  }

  // --- Update ------------------------------------------------------------------
  let ambientRippleTimer = 0;
  const update = (dt: number, t: number) => {
    // Chasing bulbs along the sign perimeter.
    const tick = Math.floor(t * 5);
    for (const b of bulbs) {
      const on = (b.index + tick) % 3 !== 0;
      b.mesh.material = on ? b.on : b.off;
      b.sprite.material.opacity = on ? 0.9 : 0.15;
    }
    for (const c of clouds) {
      c.position.x += (c.userData.speed as number) * dt;
      if (c.position.x > 45) c.position.x = -45;
    }
    for (let i = ripples.length - 1; i >= 0; i--) {
      const r = ripples[i]!;
      r.age += dt;
      const k = r.age / r.life;
      if (k >= 1) {
        group.remove(r.mesh);
        (r.mesh.material as THREE.Material).dispose();
        ripples.splice(i, 1);
        continue;
      }
      const s = 0.15 + k * 2.2;
      r.mesh.scale.setScalar(s);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - k);
    }
    ambientRippleTimer -= dt;
    if (ambientRippleTimer <= 0) {
      ambientRippleTimer = 1.6 + Math.random() * 2;
      const a = Math.random() * Math.PI * 2;
      const d = Math.random() * (POND.r - 1);
      spawnRipple(POND.x + Math.cos(a) * d, POND.z + Math.sin(a) * d, 0.6);
    }
  };

  return {
    group,
    colliders,
    bounds: WORLD_BOUNDS,
    wheelDisc,
    wheelGroup,
    signBoard,
    prizeCard,
    sign,
    bulbs,
    water,
    clouds,
    spawnRipple,
    update,
  };
}
