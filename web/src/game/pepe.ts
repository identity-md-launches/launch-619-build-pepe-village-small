import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { PALETTE, addOutline, solid, toon } from './materials';

export type Hat = 'none' | 'cap' | 'bucket' | 'party' | 'headset' | 'glasses' | 'bowtie' | 'visor';

export interface PepeOptions {
  hat?: Hat;
  hatColor?: number;
  shirt?: number;
}

/** Named parts so behaviours can animate a character without searching. */
export interface Pepe {
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  handL: THREE.Group;
  handR: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  eyeL: THREE.Group;
  eyeR: THREE.Group;
  /** World-space anchor above the head for labels and icons. */
  labelAnchor: THREE.Object3D;
}

// Shared geometries (characters are instanced many times).
const G = {
  skull: new THREE.SphereGeometry(0.42, 28, 20),
  jaw: new THREE.SphereGeometry(0.34, 24, 16),
  neck: new THREE.CylinderGeometry(0.11, 0.13, 0.14, 14),
  shirt: new RoundedBoxGeometry(0.64, 0.54, 0.44, 4, 0.12),
  shorts: new RoundedBoxGeometry(0.58, 0.3, 0.4, 4, 0.08),
  sleeve: new RoundedBoxGeometry(0.17, 0.2, 0.19, 3, 0.06),
  forearm: new THREE.CapsuleGeometry(0.07, 0.26, 4, 10),
  hand: new THREE.SphereGeometry(0.095, 14, 10),
  leg: new THREE.CapsuleGeometry(0.09, 0.24, 4, 10),
  foot: new THREE.SphereGeometry(0.13, 14, 10),
  eye: new THREE.SphereGeometry(0.15, 20, 14),
  pupil: new THREE.SphereGeometry(0.062, 12, 10),
  lid: new THREE.SphereGeometry(0.16, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.42),
  mouth: new THREE.TorusGeometry(0.34, 0.024, 8, 28, 1.35),
  lip: new THREE.TorusGeometry(0.3, 0.04, 8, 28, 1.25),
  capDome: new THREE.SphereGeometry(0.43, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.5),
  capBrim: new RoundedBoxGeometry(0.5, 0.05, 0.3, 2, 0.02),
  bucketTop: new THREE.CylinderGeometry(0.34, 0.4, 0.26, 20),
  bucketBrim: new THREE.CylinderGeometry(0.56, 0.5, 0.05, 24),
  party: new THREE.ConeGeometry(0.22, 0.55, 18),
  partyBall: new THREE.SphereGeometry(0.07, 10, 8),
  band: new THREE.TorusGeometry(0.44, 0.03, 8, 28, Math.PI),
  earcup: new RoundedBoxGeometry(0.12, 0.16, 0.14, 2, 0.04),
  glassRing: new THREE.TorusGeometry(0.17, 0.02, 8, 24),
  glassBridge: new THREE.BoxGeometry(0.1, 0.03, 0.03),
  bowtie: new THREE.ConeGeometry(0.1, 0.16, 3),
  bowKnot: new THREE.SphereGeometry(0.045, 8, 8),
  visor: new RoundedBoxGeometry(0.62, 0.08, 0.34, 2, 0.03),
};

const M = {
  skin: toon(PALETTE.pepeSkin),
  skinDark: toon(PALETTE.pepeSkinDark),
  shorts: toon(PALETTE.pepeShorts),
  eye: toon(PALETTE.eyeWhite),
  pupil: toon(PALETTE.pupil),
  mouth: toon(PALETTE.mouthLine),
  lip: toon(PALETTE.lip),
  dark: toon(0x2b2b33),
};

export function createPepe(opts: PepeOptions = {}): Pepe {
  const shirtMat = toon(opts.shirt ?? PALETTE.pepeShirt);
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  // Legs: pivot at the hip so sitting/walking rotate from the right point.
  const makeLeg = (x: number) => {
    const leg = new THREE.Group();
    leg.position.set(x, 0.42, 0);
    const shin = solid(G.leg, M.skin, { outline: 0.025 });
    shin.position.y = -0.2;
    leg.add(shin);
    const foot = solid(G.foot, M.skin, { outline: 0.025 });
    foot.scale.set(1, 0.55, 1.3);
    foot.position.set(0, -0.38, 0.06);
    leg.add(foot);
    return leg;
  };
  const legL = makeLeg(-0.16);
  const legR = makeLeg(0.16);
  body.add(legL, legR);

  const shorts = solid(G.shorts, M.shorts);
  shorts.position.y = 0.55;
  body.add(shorts);

  const shirt = solid(G.shirt, shirtMat);
  shirt.position.y = 0.96;
  body.add(shirt);

  const neck = solid(G.neck, M.skin, { outline: 0.02 });
  neck.position.y = 1.27;
  body.add(neck);

  // Arms: pivot at the shoulder; rotation (0,0,0) hangs straight down.
  const makeArm = (side: -1 | 1) => {
    const arm = new THREE.Group();
    arm.position.set(side * 0.37, 1.14, 0);
    const sleeve = solid(G.sleeve, shirtMat, { outline: 0.025 });
    sleeve.position.y = -0.07;
    arm.add(sleeve);
    const forearm = solid(G.forearm, M.skin, { outline: 0.022 });
    forearm.position.y = -0.3;
    arm.add(forearm);
    const hand = new THREE.Group();
    hand.position.y = -0.5;
    const palm = solid(G.hand, M.skin, { outline: 0.022 });
    hand.add(palm);
    arm.add(hand);
    return { arm, hand };
  };
  const left = makeArm(-1);
  const right = makeArm(1);
  body.add(left.arm, right.arm);

  // Head: pivot at the neck so nods and turns look natural.
  const head = new THREE.Group();
  head.position.y = 1.32;
  body.add(head);

  const skull = solid(G.skull, M.skin, { outline: 0.035 });
  skull.scale.set(1.08, 0.86, 0.98);
  skull.position.y = 0.3;
  head.add(skull);
  const jaw = solid(G.jaw, M.skin, { outline: 0.035 });
  jaw.scale.set(1.18, 0.62, 1.0);
  jaw.position.set(0, 0.1, 0.06);
  head.add(jaw);

  const makeEye = (side: -1 | 1) => {
    const eye = new THREE.Group();
    eye.position.set(side * 0.2, 0.56, 0.24);
    const ball = solid(G.eye, M.eye, { outline: 0.018 });
    ball.scale.set(1, 0.82, 0.8);
    eye.add(ball);
    const pupil = solid(G.pupil, M.pupil, { outline: false, shadow: false });
    pupil.position.set(side * 0.02, -0.02, 0.11);
    eye.add(pupil);
    const lid = solid(G.lid, M.skinDark, { outline: 0.018 });
    lid.scale.set(1.02, 0.86, 0.84);
    lid.rotation.x = 0.28;
    lid.position.y = 0.0;
    eye.add(lid);
    return eye;
  };
  const eyeL = makeEye(-1);
  const eyeR = makeEye(1);
  head.add(eyeL, eyeR);

  // Wide mouth: a dark line and a red lower lip, both gentle smiles.
  const mouth = solid(G.mouth, M.mouth, { outline: false, shadow: false });
  mouth.rotation.z = -Math.PI / 2 - 1.35 / 2;
  mouth.position.set(0, 0.13 + 0.34, 0.37);
  head.add(mouth);
  const lip = solid(G.lip, M.lip, { outline: 0.012, shadow: false });
  lip.rotation.z = -Math.PI / 2 - 1.25 / 2;
  lip.scale.set(1, 1, 0.5);
  lip.position.set(0, 0.11 + 0.3, 0.36);
  head.add(lip);

  addHat(head, opts.hat ?? 'none', opts.hatColor ?? 0xd9534f, shirtMat);

  const labelAnchor = new THREE.Object3D();
  labelAnchor.position.y = 2.25;
  root.add(labelAnchor);

  return {
    root,
    body,
    head,
    armL: left.arm,
    armR: right.arm,
    handL: left.hand,
    handR: right.hand,
    legL,
    legR,
    eyeL,
    eyeR,
    labelAnchor,
  };
}

function addHat(head: THREE.Group, hat: Hat, color: number, shirtMat: THREE.Material) {
  const mat = toon(color);
  switch (hat) {
    case 'cap': {
      const dome = solid(G.capDome, mat);
      dome.scale.set(1.02, 0.9, 0.95);
      dome.position.set(0, 0.62, -0.02);
      head.add(dome);
      const brim = solid(G.capBrim, mat);
      brim.position.set(0, 0.64, 0.42);
      head.add(brim);
      break;
    }
    case 'bucket': {
      const top = solid(G.bucketTop, mat);
      top.position.y = 0.78;
      head.add(top);
      const brim = solid(G.bucketBrim, mat);
      brim.position.y = 0.66;
      head.add(brim);
      break;
    }
    case 'party': {
      const cone = solid(G.party, mat);
      cone.position.set(0.05, 0.95, -0.05);
      cone.rotation.z = -0.12;
      head.add(cone);
      const ball = solid(G.partyBall, toon(PALETTE.gold), { outline: 0.012 });
      ball.position.set(0.09, 1.23, -0.05);
      head.add(ball);
      break;
    }
    case 'headset': {
      const band = solid(G.band, M.dark, { outline: 0.012 });
      band.position.y = 0.44;
      band.rotation.z = 0;
      head.add(band);
      for (const s of [-1, 1]) {
        const cup = solid(G.earcup, M.dark, { outline: 0.015 });
        cup.position.set(s * 0.45, 0.32, 0);
        head.add(cup);
      }
      break;
    }
    case 'glasses': {
      for (const s of [-1, 1]) {
        const ring = solid(G.glassRing, M.dark, { outline: false, shadow: false });
        ring.position.set(s * 0.2, 0.52, 0.39);
        head.add(ring);
      }
      const bridge = solid(G.glassBridge, M.dark, { outline: false, shadow: false });
      bridge.position.set(0, 0.52, 0.39);
      head.add(bridge);
      break;
    }
    case 'bowtie': {
      // Sits on the shirt collar, below the head pivot.
      for (const s of [-1, 1]) {
        const wing = solid(G.bowtie, mat, { outline: 0.015 });
        wing.rotation.z = s * Math.PI / 2;
        wing.position.set(s * 0.09, -0.1, 0.24);
        head.add(wing);
      }
      const knot = solid(G.bowKnot, mat, { outline: 0.012 });
      knot.position.set(0, -0.1, 0.26);
      head.add(knot);
      break;
    }
    case 'visor': {
      const v = solid(G.visor, mat);
      v.position.set(0, 0.7, 0.2);
      v.rotation.x = 0.1;
      head.add(v);
      break;
    }
    case 'none':
    default:
      break;
  }
  void shirtMat;
}

/** Simple walking cycle for the player. `phase` advances with distance. */
export function animateWalk(p: Pepe, phase: number, moving: boolean, dt: number) {
  const target = moving ? 1 : 0;
  const swing = Math.sin(phase) * 0.75 * target;
  p.legL.rotation.x = THREE.MathUtils.damp(p.legL.rotation.x, swing, 14, dt);
  p.legR.rotation.x = THREE.MathUtils.damp(p.legR.rotation.x, -swing, 14, dt);
  p.armL.rotation.x = THREE.MathUtils.damp(p.armL.rotation.x, -swing * 0.8, 14, dt);
  p.armR.rotation.x = THREE.MathUtils.damp(p.armR.rotation.x, swing * 0.8, 14, dt);
  p.body.position.y = moving ? Math.abs(Math.sin(phase)) * 0.06 : THREE.MathUtils.damp(p.body.position.y, 0, 10, dt);
}

/** Keep the eyes alive: a blink every few seconds by squashing the eye groups. */
export function animateBlink(p: Pepe, t: number, offset = 0) {
  const cycle = (t + offset) % 4.2;
  const s = cycle < 0.12 ? 0.15 : 1;
  p.eyeL.scale.y = s;
  p.eyeR.scale.y = s;
}

export { addOutline };
