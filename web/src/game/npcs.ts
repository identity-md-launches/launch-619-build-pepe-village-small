import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { circle, type Collider } from './collision';
import { PALETTE, solid, toon } from './materials';
import { animateBlink, createPepe, type Pepe } from './pepe';
import { ARCH, BENCH, POND, WHEEL, type World } from './world';

export interface ChatLine {
  speaker: number;
  text: string;
}

export const CHAT_LINES: ChatLine[] = [
  { speaker: 0, text: 'Did you see the GRAND PRIZE sign? A whole IMD NFT!' },
  { speaker: 1, text: 'I spun the wheel 30 days in a row. Legend.' },
  { speaker: 2, text: 'You spun it once. Yesterday.' },
  { speaker: 0, text: 'The pond fish keep stealing my bait.' },
  { speaker: 1, text: 'That is not a fish. That is Gary.' },
  { speaker: 2, text: 'Gary is a frog. Like us.' },
  { speaker: 0, text: 'Then why is he fishing?' },
  { speaker: 1, text: 'Feels good, man.' },
  { speaker: 2, text: 'Feels good, man.' },
];

export interface ChatState {
  /** Index into CHAT_LINES, or -1 during the pause between lines. */
  line: number;
}

export interface Npcs {
  group: THREE.Group;
  colliders: Collider[];
  chatters: Pepe[];
  chat: ChatState;
  operator: Pepe;
  reader: Pepe;
  caller: Pepe;
  fisher: Pepe;
  greeters: Pepe[];
  /** Floating anchor between the two greeters for their shared label. */
  greeterAnchor: THREE.Object3D;
  /** World position of the fishing bobber (for ripples / camera focus). */
  bobber: THREE.Object3D;
  triggerSpin(): void;
  triggerCast(): void;
  update(dt: number, t: number): void;
}

const LINE_SECONDS = 3.1;
const GAP_SECONDS = 0.5;

function face(p: Pepe, tx: number, tz: number) {
  p.root.rotation.y = Math.atan2(tx - p.root.position.x, tz - p.root.position.z);
}

export function buildNpcs(world: World): Npcs {
  const group = new THREE.Group();
  const colliders: Collider[] = [];
  const place = (p: Pepe, x: number, z: number, heading: number, solidBody = true) => {
    p.root.position.set(x, 0, z);
    p.root.rotation.y = heading;
    group.add(p.root);
    if (solidBody) colliders.push(circle(x, z, 0.5, 'npc'));
  };

  // --- Three chatting Pepes in the square ------------------------------------
  const chatSpots: [number, number][] = [
    [-2.5, 2.1],
    [-0.5, 3.5],
    [-1.3, 0.7],
  ];
  const chatters = [
    createPepe({ hat: 'party', hatColor: 0xff6b6b }),
    createPepe({ hat: 'cap', hatColor: 0x4d96ff }),
    createPepe({ hat: 'glasses' }),
  ];
  const cx = chatSpots.reduce((s, v) => s + v[0], 0) / 3;
  const cz = chatSpots.reduce((s, v) => s + v[1], 0) / 3;
  chatters.forEach((p, i) => {
    const [x, z] = chatSpots[i]!;
    place(p, x, z, 0);
    face(p, cx, cz);
  });
  const chat: ChatState = { line: 0 };
  let chatClock = 0;

  // --- Wheel operator ----------------------------------------------------------
  const operator = createPepe({ hat: 'bowtie', hatColor: 0xff3b3b });
  place(operator, WHEEL.x - 0.6, WHEEL.z + 2.2, -Math.PI / 2);
  let spinSwing = 0;

  // --- Reader on the bench ---------------------------------------------------------
  const reader = createPepe({ hat: 'glasses' });
  place(reader, BENCH.x - 0.12, BENCH.z, BENCH.rotationY, false);
  reader.root.position.y = BENCH.seatHeight - 0.45;
  reader.legL.rotation.x = -Math.PI / 2 + 0.1;
  reader.legR.rotation.x = -Math.PI / 2 + 0.1;
  reader.armL.rotation.set(-1.25, 0, 0.35);
  reader.armR.rotation.set(-1.25, 0, -0.35);
  reader.head.rotation.x = 0.32;
  const book = new THREE.Group();
  book.position.set(0, 0.92, 0.46);
  book.rotation.x = -0.55;
  const coverMat = toon(0x8e3b46);
  const pageMat = toon(0xfff8e6);
  const coverGeo = new RoundedBoxGeometry(0.3, 0.36, 0.03, 2, 0.01);
  const pageGeo = new THREE.BoxGeometry(0.27, 0.33, 0.012);
  for (const s of [-1, 1]) {
    const half = new THREE.Group();
    half.rotation.y = s * -0.45;
    const cover = solid(coverGeo, coverMat, { outline: 0.012 });
    cover.position.x = s * 0.16;
    half.add(cover);
    const pages = solid(pageGeo, pageMat, { outline: false });
    pages.position.set(s * 0.16, 0, 0.022);
    half.add(pages);
    book.add(half);
  }
  const flipping = new THREE.Group();
  const flipPage = solid(new THREE.BoxGeometry(0.26, 0.32, 0.006), pageMat, { outline: 0.006 });
  flipPage.position.set(0.14, 0, 0.03);
  flipping.add(flipPage);
  flipping.rotation.y = -0.45;
  book.add(flipping);
  reader.body.add(book);
  let flipTimer = 2.5;
  let flipProgress = -1; // -1 idle, else 0..1

  // --- Pepe on the phone --------------------------------------------------------------
  const caller = createPepe({ hat: 'visor', hatColor: 0xffd93d });
  place(caller, 7.4, 6.6, -Math.PI * 0.75);
  caller.armR.rotation.set(-2.55, 0, -0.55);
  const phone = solid(new RoundedBoxGeometry(0.09, 0.19, 0.03, 2, 0.01), toon(0x2b2b33), { outline: 0.01 });
  phone.position.set(-0.05, 0.02, 0.07);
  phone.rotation.set(0.2, 0.3, 0.5);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.15), new THREE.MeshBasicMaterial({ color: 0x9fd6f5 }));
  screen.position.z = 0.016;
  phone.add(screen);
  caller.handR.add(phone);

  // --- Fisherman at the pond ------------------------------------------------------------
  const fisher = createPepe({ hat: 'bucket', hatColor: 0x6b9b3a });
  const fisherX = POND.x + POND.r + 1.35;
  place(fisher, fisherX, POND.z - 0.6, -Math.PI / 2);
  fisher.armR.rotation.set(-1.0, 0, -0.15);
  fisher.armL.rotation.set(-0.8, 0, 0.5);
  const rod = new THREE.Group();
  const rodMesh = solid(new THREE.CylinderGeometry(0.015, 0.03, 2.3, 8), toon(0xd9a066), { outline: 0.012 });
  rodMesh.position.y = 0.95;
  rod.add(rodMesh);
  const grip = solid(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 8), toon(0x2b2b33), { outline: 0.012 });
  grip.position.y = 0.05;
  rod.add(grip);
  const rodTip = new THREE.Object3D();
  rodTip.position.y = 2.1;
  rod.add(rodTip);
  rod.rotation.x = -0.9;
  fisher.handR.add(rod);
  const bobber = new THREE.Group();
  const bobTop = solid(new THREE.SphereGeometry(0.09, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), toon(0xff3b3b), { outline: 0.012, shadow: false });
  const bobBottom = solid(new THREE.SphereGeometry(0.09, 10, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), toon(0xffffff), { outline: 0.012, shadow: false });
  bobber.add(bobTop, bobBottom);
  const bobberRest = new THREE.Vector3(fisherX - 3.1, POND.surfaceY + 0.06, POND.z - 0.5);
  bobber.position.copy(bobberRest);
  group.add(bobber);
  const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]);
  const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0x1d2a1b }));
  line.frustumCulled = false;
  group.add(line);
  const bucket = solid(new THREE.CylinderGeometry(0.28, 0.22, 0.4, 12, 1, true), toon(0x3b3f4a), { outline: 0.02 });
  bucket.position.set(fisherX + 0.1, 0.2, POND.z + 0.5);
  group.add(bucket);
  let castProgress = -1; // -1 idle, else seconds since cast start
  let bobberRippleTimer = 1;
  const tipWorld = new THREE.Vector3();

  // --- Two greeters at the entrance ---------------------------------------------------------
  const greeters = [createPepe({ hat: 'cap', hatColor: 0xff8fb1 }), createPepe({ hat: 'party', hatColor: 0x4d96ff })];
  place(greeters[0]!, -2.7, ARCH.z - 1.7, 0);
  place(greeters[1]!, 2.7, ARCH.z - 1.7, 0);
  const greeterAnchor = new THREE.Object3D();
  greeterAnchor.position.set(0, 2.4, ARCH.z - 1.7);
  group.add(greeterAnchor);

  // --- Behaviours --------------------------------------------------------------------------
  const triggerSpin = () => {
    spinSwing = 1;
  };
  const triggerCast = () => {
    if (castProgress < 0) castProgress = 0;
  };

  const update = (dt: number, t: number) => {
    // Chat sequencing
    chatClock += dt;
    if (chat.line >= 0 && chatClock >= LINE_SECONDS) {
      chat.line = -1 - ((chat.line + 1) % CHAT_LINES.length); // encode next line in the pause
      chatClock = 0;
    } else if (chat.line < 0 && chatClock >= GAP_SECONDS) {
      chat.line = -chat.line - 1;
      chatClock = 0;
    }
    const speaking = chat.line >= 0 ? CHAT_LINES[chat.line]!.speaker : -1;
    chatters.forEach((p, i) => {
      animateBlink(p, t, i * 1.3);
      const isSpeaker = i === speaking;
      const targetArm = isSpeaker ? -0.9 + Math.sin(t * 7) * 0.25 : 0;
      p.armR.rotation.x = THREE.MathUtils.damp(p.armR.rotation.x, targetArm, 8, dt);
      p.armL.rotation.x = THREE.MathUtils.damp(p.armL.rotation.x, isSpeaker ? -0.4 : 0, 8, dt);
      p.body.position.y = isSpeaker ? Math.abs(Math.sin(t * 7)) * 0.04 : 0;
      p.head.rotation.x = isSpeaker ? 0 : Math.sin(t * 2.5 + i) * 0.06 + 0.04;
      p.head.rotation.z = isSpeaker ? Math.sin(t * 3) * 0.08 : 0;
    });

    // Operator
    animateBlink(operator, t, 0.4);
    operator.body.position.y = Math.sin(t * 2) * 0.02;
    if (spinSwing > 0) {
      spinSwing = Math.max(0, spinSwing - dt * 1.4);
      const k = 1 - spinSwing;
      operator.armL.rotation.x = -2.4 + k * 2.4;
      operator.armL.rotation.z = 0.6 * (1 - k);
    } else {
      operator.armL.rotation.x = THREE.MathUtils.damp(operator.armL.rotation.x, -0.6 + Math.sin(t * 1.5) * 0.15, 4, dt);
      operator.armL.rotation.z = THREE.MathUtils.damp(operator.armL.rotation.z, 1.1, 4, dt);
      operator.armR.rotation.x = Math.sin(t * 1.5 + 1) * 0.1;
    }
    operator.head.rotation.y = Math.sin(t * 0.8) * 0.25;

    // Reader: turn a page now and then
    animateBlink(reader, t, 0.9);
    reader.body.position.y = Math.sin(t * 1.4) * 0.012;
    reader.head.rotation.y = Math.sin(t * 0.9) * 0.08;
    if (flipProgress < 0) {
      flipTimer -= dt;
      if (flipTimer <= 0) {
        flipProgress = 0;
        flipTimer = 3.5 + Math.random() * 3;
      }
    } else {
      flipProgress += dt / 0.7;
      const k = Math.min(1, flipProgress);
      const e = 1 - Math.pow(1 - k, 3);
      flipping.rotation.y = -0.45 + e * (Math.PI - 0.9) * -1;
      flipPage.position.x = 0.14;
      reader.armR.rotation.x = -1.25 - Math.sin(k * Math.PI) * 0.35;
      reader.head.rotation.x = 0.32 - Math.sin(k * Math.PI) * 0.08;
      if (k >= 1) {
        flipProgress = -1;
        flipping.rotation.y = -0.45;
      }
    }

    // Caller: head nods, free hand gestures
    animateBlink(caller, t, 1.7);
    caller.head.rotation.z = 0.18 + Math.sin(t * 1.3) * 0.05;
    caller.head.rotation.x = Math.sin(t * 2.2) * 0.07;
    caller.head.rotation.y = Math.sin(t * 0.6) * 0.15;
    caller.armR.rotation.x = -2.55 + Math.sin(t * 2.2) * 0.04;
    const gesture = Math.max(0, Math.sin(t * 0.7));
    caller.armL.rotation.x = -gesture * 0.9 + Math.sin(t * 5) * 0.08 * gesture;
    caller.armL.rotation.z = gesture * 0.5;
    caller.body.position.y = Math.sin(t * 2.6) * 0.015;

    // Fisher: rod sway, periodic cast, bobber and ripples
    animateBlink(fisher, t, 2.3);
    fisher.body.position.y = Math.sin(t * 1.6) * 0.015;
    if (castProgress >= 0) {
      castProgress += dt;
      const k = castProgress;
      if (k < 0.5) {
        // wind back
        fisher.armR.rotation.x = -1.0 - (k / 0.5) * 1.5;
        fisher.body.rotation.y = (k / 0.5) * 0.3;
      } else if (k < 0.75) {
        const f = (k - 0.5) / 0.25;
        fisher.armR.rotation.x = -2.5 + f * 1.9;
        fisher.body.rotation.y = 0.3 - f * 0.5;
        bobber.visible = false;
      } else if (k < 1.3) {
        const f = (k - 0.75) / 0.55;
        fisher.armR.rotation.x = -0.6 - f * 0.4;
        fisher.body.rotation.y = -0.2 + f * 0.2;
        if (!bobber.visible) {
          bobber.visible = true;
          world.spawnRipple(bobberRest.x, bobberRest.z, 1.6);
          bobberRippleTimer = 0.25;
        }
      } else {
        castProgress = -1;
        fisher.armR.rotation.x = -1.0;
        fisher.body.rotation.y = 0;
      }
    } else {
      fisher.armR.rotation.x = -1.0 + Math.sin(t * 1.1) * 0.08;
      fisher.armR.rotation.z = -0.15 + Math.sin(t * 0.7) * 0.05;
      if (Math.sin(t * 0.35) > 0.96 && castProgress < 0) castProgress = 0;
    }
    bobber.position.y = bobberRest.y + Math.sin(t * 2.4) * 0.03;
    bobber.rotation.z = Math.sin(t * 2.4) * 0.15;
    bobberRippleTimer -= dt;
    if (bobberRippleTimer <= 0) {
      bobberRippleTimer = 2.2 + Math.random() * 1.5;
      world.spawnRipple(bobber.position.x, bobber.position.z, 0.5);
    }
    rodTip.getWorldPosition(tipWorld);
    const pos = lineGeo.getAttribute('position') as THREE.BufferAttribute;
    const midY = Math.min(tipWorld.y, bobber.position.y + 0.5);
    pos.setXYZ(0, tipWorld.x, tipWorld.y, tipWorld.z);
    pos.setXYZ(1, (tipWorld.x + bobber.position.x) / 2, midY, (tipWorld.z + bobber.position.z) / 2);
    pos.setXYZ(2, bobber.position.x, bobber.visible ? bobber.position.y + 0.05 : tipWorld.y, bobber.position.z);
    pos.needsUpdate = true;

    // Greeters: waving, bouncing
    greeters.forEach((p, i) => {
      animateBlink(p, t, i * 2.1);
      const wave = 2.5 + Math.sin(t * 7 + i) * 0.35;
      if (i === 0) {
        p.armL.rotation.z = -wave;
        p.armL.rotation.x = 0;
      } else {
        p.armR.rotation.z = wave;
        p.armR.rotation.x = 0;
      }
      p.body.position.y = Math.abs(Math.sin(t * 3.5 + i)) * 0.07;
      p.head.rotation.z = Math.sin(t * 3.5 + i) * 0.08;
    });
  };

  return {
    group,
    colliders,
    chatters,
    chat,
    operator,
    reader,
    caller,
    fisher,
    greeters,
    greeterAnchor,
    bobber,
    triggerSpin,
    triggerCast,
    update,
  };
}

export const NPC_NAMES = {
  operator: 'Spinner Sam',
  fisher: 'Captain Ribbit',
  reader: 'Professor Lily',
  caller: 'Newsy Ned',
  greeters: 'Gigi & Gus',
  sign: 'Grand prize sign',
} as const;

export { PALETTE };
