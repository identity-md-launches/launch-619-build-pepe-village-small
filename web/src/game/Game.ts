import * as THREE from 'three';
import { rotationForSegment } from '../state/progress';
import { resolveCollisions, type Collider } from './collision';
import { attachKeyboard, input, moveVector } from './input';
import { animateBlink, animateWalk, createPepe, type Pepe } from './pepe';
import { CHAT_LINES, NPC_NAMES, buildNpcs, type Npcs } from './npcs';
import { ARCH, POND, PRIZE_STAND, SPAWN, WHEEL, buildWorld, type World } from './world';
import { ICONS, type IconName } from './icons';

export type InteractId = 'operator' | 'fisher' | 'reader' | 'caller' | 'greeters' | 'sign';

export interface Interactable {
  id: InteractId;
  name: string;
  icon: IconName;
  x: number;
  z: number;
  radius: number;
  anchor: THREE.Object3D;
}

export type FocusTarget = 'wheel' | 'fishing' | null;

export interface GameOptions {
  container: HTMLElement;
  overlay: HTMLElement;
  onNearestChange(id: InteractId | null): void;
  onInteract(id: InteractId): void;
  onReady?(): void;
  /** Prompt text under the character name ("Press E to interact" / "Tap Interact"). */
  promptText: string;
}

const PLAYER_RADIUS = 0.42;
const PLAYER_SPEED = 4.4;
const CAMERA_DISTANCE = 7.6;
const CAMERA_HEIGHT = 5.1;
const SKY = 0x9ad7f2;

interface Marker {
  item: Interactable;
  el: HTMLDivElement;
  label: HTMLDivElement;
}

function shortestAngle(from: number, to: number) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private world: World;
  private npcs: Npcs;
  private player: Pepe;
  private colliders: Collider[];
  private interactables: Interactable[];
  private markers: Marker[] = [];
  private bubbles: HTMLDivElement[] = [];
  private raf = 0;
  private timer = new THREE.Timer();
  private elapsed = 0;
  private heading = SPAWN.heading;
  private camYaw = SPAWN.heading;
  private camPos = new THREE.Vector3();
  private camLook = new THREE.Vector3();
  private walkPhase = 0;
  private nearest: InteractId | null = null;
  private paused = false;
  private focus: FocusTarget = null;
  private disposeKeyboard: () => void;
  private resizeObserver: ResizeObserver;
  private raycaster = new THREE.Raycaster();
  private pointerDown: { x: number; y: number; t: number } | null = null;
  private spin: { from: number; to: number; elapsed: number; duration: number; resolve: () => void } | null = null;
  private promptText: string;
  private tmp = new THREE.Vector3();
  private disposed = false;

  constructor(private opts: GameOptions) {
    this.promptText = opts.promptText;
    const { container, overlay } = opts;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.NoToneMapping;
    const canvas = this.renderer.domElement;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Pepe Village 3D scene. Move with the arrow keys or WASD, press E to interact.');
    canvas.tabIndex = -1;
    container.appendChild(canvas);

    this.scene.background = new THREE.Color(SKY);
    this.scene.fog = new THREE.Fog(SKY, 45, 95);

    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 160);

    const hemi = new THREE.HemisphereLight(0xe3f6ff, 0x7bb95f, 1.15);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff3d9, 2.3);
    sun.position.set(18, 30, 14);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -30;
    sun.shadow.camera.right = 30;
    sun.shadow.camera.top = 30;
    sun.shadow.camera.bottom = -30;
    sun.shadow.camera.near = 5;
    sun.shadow.camera.far = 80;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.03;
    this.scene.add(sun);
    this.scene.add(sun.target);

    this.world = buildWorld();
    this.scene.add(this.world.group);
    this.npcs = buildNpcs(this.world);
    this.scene.add(this.npcs.group);
    this.colliders = [...this.world.colliders, ...this.npcs.colliders];

    this.player = createPepe({ hat: 'cap', hatColor: 0xff3b3b });
    this.player.root.position.set(SPAWN.x, 0, SPAWN.z);
    this.player.root.rotation.y = this.heading;
    this.scene.add(this.player.root);

    this.interactables = [
      {
        id: 'greeters',
        name: NPC_NAMES.greeters,
        icon: 'wave',
        x: 0,
        z: ARCH.z - 1.7,
        radius: 3.4,
        anchor: this.npcs.greeterAnchor,
      },
      {
        id: 'sign',
        name: NPC_NAMES.sign,
        icon: 'star',
        x: PRIZE_STAND.x,
        z: PRIZE_STAND.z,
        radius: 3.2,
        anchor: this.anchorAt(PRIZE_STAND.x, 3.95, PRIZE_STAND.z),
      },
      {
        id: 'operator',
        name: NPC_NAMES.operator,
        icon: 'wheel',
        x: this.npcs.operator.root.position.x,
        z: this.npcs.operator.root.position.z,
        radius: 2.9,
        anchor: this.npcs.operator.labelAnchor,
      },
      {
        id: 'reader',
        name: NPC_NAMES.reader,
        icon: 'book',
        x: this.npcs.reader.root.position.x,
        z: this.npcs.reader.root.position.z,
        radius: 2.8,
        anchor: this.npcs.reader.labelAnchor,
      },
      {
        id: 'caller',
        name: NPC_NAMES.caller,
        icon: 'phone',
        x: this.npcs.caller.root.position.x,
        z: this.npcs.caller.root.position.z,
        radius: 2.8,
        anchor: this.npcs.caller.labelAnchor,
      },
      {
        id: 'fisher',
        name: NPC_NAMES.fisher,
        icon: 'fish',
        x: this.npcs.fisher.root.position.x,
        z: this.npcs.fisher.root.position.z,
        radius: 3.0,
        anchor: this.npcs.fisher.labelAnchor,
      },
    ];
    this.tagInteractables();
    this.buildOverlay(overlay);

    this.disposeKeyboard = attachKeyboard(() => !this.paused);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();

    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointerup', this.onPointerUp);

    // Initial camera placement
    this.updateCamera(1, true);
    this.raf = requestAnimationFrame(this.loop);
    opts.onReady?.();
  }

  private anchorAt(x: number, y: number, z: number) {
    const o = new THREE.Object3D();
    o.position.set(x, y, z);
    this.scene.add(o);
    return o;
  }

  /** Mark meshes so a tap on a character or the sign can open its interaction. */
  private tagInteractables() {
    const tag = (obj: THREE.Object3D, id: InteractId) => obj.traverse((o) => (o.userData.interactId = id));
    tag(this.npcs.operator.root, 'operator');
    tag(this.npcs.reader.root, 'reader');
    tag(this.npcs.caller.root, 'caller');
    tag(this.npcs.fisher.root, 'fisher');
    for (const g of this.npcs.greeters) tag(g.root, 'greeters');
    this.world.group.traverse((o) => {
      if (o.name === 'grand-prize-sign') tag(o, 'sign');
    });
  }

  private buildOverlay(overlay: HTMLElement) {
    overlay.replaceChildren();
    for (const item of this.interactables) {
      const el = document.createElement('div');
      el.className = 'marker';
      el.dataset.id = item.id;
      el.setAttribute('aria-hidden', 'true');
      const icon = document.createElement('div');
      icon.className = 'marker-icon';
      icon.innerHTML = ICONS[item.icon];
      const label = document.createElement('div');
      label.className = 'marker-label';
      label.hidden = true;
      const name = document.createElement('strong');
      name.textContent = item.name;
      const prompt = document.createElement('span');
      prompt.textContent = this.promptText;
      label.append(name, prompt);
      el.append(icon, label);
      overlay.appendChild(el);
      this.markers.push({ item, el, label });
    }
    this.npcs.chatters.forEach((_, i) => {
      const b = document.createElement('div');
      b.className = 'bubble';
      b.dataset.speaker = String(i);
      b.setAttribute('aria-hidden', 'true');
      b.hidden = true;
      overlay.appendChild(b);
      this.bubbles.push(b);
    });
  }

  setPromptText(text: string) {
    this.promptText = text;
    for (const m of this.markers) {
      const span = m.label.querySelector('span');
      if (span) span.textContent = text;
    }
  }

  setCountdown(text: string) {
    this.world.sign.setCountdown(text);
  }

  /** Pause player control (while a panel or dialog is open). Scene keeps animating. */
  setPaused(paused: boolean) {
    this.paused = paused;
    if (paused) {
      input.keyX = 0;
      input.keyY = 0;
      input.stickX = 0;
      input.stickY = 0;
    }
  }

  /**
   * Cinematic focus for the wheel and the pond. The player walks to a fixed
   * spot beside the character so they never block the camera.
   */
  setFocus(target: FocusTarget) {
    this.focus = target;
    if (target === 'wheel') {
      const x = WHEEL.x - 2.4;
      const z = WHEEL.z + 3.0;
      this.focusSpot = { x, z, heading: Math.atan2(WHEEL.x - x, WHEEL.z - z) };
    } else if (target === 'fishing') {
      const f = this.npcs.fisher.root.position;
      this.focusSpot = { x: f.x + 0.4, z: f.z + 1.7, heading: -Math.PI / 2 };
    } else {
      this.focusSpot = null;
    }
  }

  private focusSpot: { x: number; z: number; heading: number } | null = null;

  /** Trigger the nearest interaction (used by the mobile button). */
  interact() {
    if (this.nearest) this.opts.onInteract(this.nearest);
  }

  getNearest() {
    return this.nearest;
  }

  /** Player position in world units (x, z) and heading; used by validation scripts. */
  getPlayerState() {
    const p = this.player.root.position;
    return { x: p.x, z: p.z, heading: this.heading, nearest: this.nearest, wheelRotation: this.world.wheelDisc.rotation.z };
  }

  /** Move the player instantly (validation / debugging only). */
  teleport(x: number, z: number, heading = this.heading) {
    const pos = { x, z };
    resolveCollisions(pos, PLAYER_RADIUS, this.colliders, this.world.bounds);
    this.player.root.position.set(pos.x, 0, pos.z);
    this.heading = heading;
    this.camYaw = heading;
    this.player.root.rotation.y = heading;
    this.updateCamera(1, true);
  }

  /** Animate the wheel to land on `segment`; resolves when it stops. */
  spinTo(segment: number): Promise<void> {
    return new Promise((resolve) => {
      const disc = this.world.wheelDisc;
      const from = disc.rotation.z;
      const twoPi = Math.PI * 2;
      const jitter = (Math.random() - 0.5) * 0.7; // within ±0.35 of a segment
      const target = rotationForSegment(segment, jitter);
      const current = ((from % twoPi) + twoPi) % twoPi;
      let delta = target - current;
      if (delta < 0) delta += twoPi;
      const to = from + twoPi * 5 + delta;
      this.npcs.triggerSpin();
      this.spin = { from, to, elapsed: 0, duration: 5.2, resolve };
    });
  }

  isSpinning() {
    return this.spin !== null;
  }

  /** Play the fisherman's casting animation. */
  cast() {
    this.npcs.triggerCast();
  }

  splash(strength = 1.4) {
    const b = this.npcs.bobber.position;
    this.world.spawnRipple(b.x, b.z, strength);
  }

  private resize() {
    const { clientWidth: w, clientHeight: h } = this.opts.container;
    if (w === 0 || h === 0) return;
    this.renderer.setSize(w, h, false);
    const canvas = this.renderer.domElement;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    this.camera.aspect = w / h;
    // Portrait phones: widen the vertical field so the village stays readable.
    this.camera.fov = w < h ? 68 : 55;
    this.camera.updateProjectionMatrix();
  }

  private onPointerDown = (e: PointerEvent) => {
    this.pointerDown = { x: e.clientX, y: e.clientY, t: performance.now() };
  };

  /** First interactable under a screen point, or null. */
  hitTest(clientX: number, clientY: number): InteractId | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObjects([this.world.group, this.npcs.group], true);
    for (const hit of hits) {
      let o: THREE.Object3D | null = hit.object;
      while (o && !o.userData.interactId) o = o.parent;
      if (!o) continue;
      return o.userData.interactId as InteractId;
    }
    return null;
  }

  private onPointerUp = (e: PointerEvent) => {
    const d = this.pointerDown;
    this.pointerDown = null;
    if (!d || this.paused) return;
    // A tap: little movement and under ~0.8 s (long frames on slow devices stretch taps).
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 12 || performance.now() - d.t > 800) return;
    const id = this.hitTest(e.clientX, e.clientY);
    if (!id) return;
    const item = this.interactables.find((i) => i.id === id);
    if (!item) return;
    const p = this.player.root.position;
    const dist = Math.hypot(item.x - p.x, item.z - p.z);
    // The sign can be read from anywhere; characters need the player nearby.
    if (id === 'sign' || dist <= item.radius + 1.5) this.opts.onInteract(id);
  };

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    this.timer.update();
    const dt = Math.min(0.05, this.timer.getDelta());
    this.elapsed += dt;
    this.step(dt);
    this.renderer.render(this.scene, this.camera);
    this.updateOverlay();
  };

  private step(dt: number) {
    const t = this.elapsed;
    // --- Player movement -------------------------------------------------
    const mv = this.paused ? { x: 0, y: 0 } : moveVector();
    let moving = Math.hypot(mv.x, mv.y) > 0.05;
    const p = this.player.root.position;
    if (this.focusSpot) {
      const s = this.focusSpot;
      const d = Math.hypot(s.x - p.x, s.z - p.z);
      moving = d > 0.08;
      if (moving) {
        const k = Math.min(1, dt * 4);
        const nx = p.x + (s.x - p.x) * k;
        const nz = p.z + (s.z - p.z) * k;
        this.walkPhase += Math.hypot(nx - p.x, nz - p.z) * 9;
        p.x = nx;
        p.z = nz;
        this.heading += shortestAngle(this.heading, Math.atan2(s.x - p.x, s.z - p.z)) * Math.min(1, dt * 10);
      } else {
        this.heading += shortestAngle(this.heading, s.heading) * Math.min(1, dt * 6);
      }
      this.player.root.rotation.y = this.heading;
    } else if (moving) {
      const fx = Math.sin(this.camYaw);
      const fz = Math.cos(this.camYaw);
      const rx = Math.cos(this.camYaw);
      const rz = -Math.sin(this.camYaw);
      const dx = fx * mv.y + rx * mv.x;
      const dz = fz * mv.y + rz * mv.x;
      const len = Math.hypot(dx, dz);
      const step = PLAYER_SPEED * dt;
      const pos = { x: p.x + (dx / len) * step * Math.min(1, len), z: p.z + (dz / len) * step * Math.min(1, len) };
      resolveCollisions(pos, PLAYER_RADIUS, this.colliders, this.world.bounds);
      const movedX = pos.x - p.x;
      const movedZ = pos.z - p.z;
      p.x = pos.x;
      p.z = pos.z;
      const targetHeading = Math.atan2(dx, dz);
      this.heading += shortestAngle(this.heading, targetHeading) * Math.min(1, dt * 12);
      this.player.root.rotation.y = this.heading;
      this.walkPhase += Math.hypot(movedX, movedZ) * 9;
      // The camera swings behind the player's heading while walking.
      this.camYaw += shortestAngle(this.camYaw, this.heading) * Math.min(1, dt * 1.6);
    }
    animateWalk(this.player, this.walkPhase, moving, dt);
    animateBlink(this.player, t, 0.5);

    // --- Nearest interactable ------------------------------------------------
    let best: Interactable | null = null;
    let bestD = Infinity;
    for (const item of this.interactables) {
      const d = Math.hypot(item.x - p.x, item.z - p.z);
      if (d <= item.radius && d < bestD) {
        best = item;
        bestD = d;
      }
    }
    const nearestId = best?.id ?? null;
    if (nearestId !== this.nearest) {
      this.nearest = nearestId;
      this.opts.onNearestChange(nearestId);
    }
    if (input.interactPressed) {
      input.interactPressed = false;
      if (!this.paused && this.nearest) this.opts.onInteract(this.nearest);
    }

    // --- Wheel spin ---------------------------------------------------------------
    if (this.spin) {
      const s = this.spin;
      s.elapsed += dt;
      const k = Math.min(1, s.elapsed / s.duration);
      const e = 1 - Math.pow(1 - k, 3.2);
      this.world.wheelDisc.rotation.z = s.from + (s.to - s.from) * e;
      if (k >= 1) {
        this.world.wheelDisc.rotation.z = s.to;
        this.spin = null;
        s.resolve();
      }
    }

    this.world.update(dt, t);
    this.npcs.update(dt, t);
    this.updateCamera(dt, false);
  }

  private updateCamera(dt: number, snap: boolean) {
    const p = this.player.root.position;
    let targetPos: THREE.Vector3;
    let targetLook: THREE.Vector3;
    if (this.focus === 'wheel') {
      const dirX = Math.sin(WHEEL.facingY);
      const dirZ = Math.cos(WHEEL.facingY);
      targetPos = new THREE.Vector3(WHEEL.x + dirX * 5.4, WHEEL.hubY + 1.3, WHEEL.z + dirZ * 5.4 + 0.3);
      targetLook = new THREE.Vector3(WHEEL.x, WHEEL.hubY + 0.1, WHEEL.z);
    } else if (this.focus === 'fishing') {
      const b = this.npcs.bobber.position;
      const f = this.npcs.fisher.root.position;
      targetPos = new THREE.Vector3(f.x + 3.4, 3.2, f.z - 2.8);
      targetLook = new THREE.Vector3((b.x + f.x) / 2 - 0.4, 0.7, (b.z + f.z) / 2);
    } else {
      targetPos = new THREE.Vector3(p.x - Math.sin(this.camYaw) * CAMERA_DISTANCE, p.y + CAMERA_HEIGHT, p.z - Math.cos(this.camYaw) * CAMERA_DISTANCE);
      // Look a little ahead of the player so the horizon and tall signs stay in frame.
      targetLook = new THREE.Vector3(p.x + Math.sin(this.heading) * 2.2, p.y + 1.6, p.z + Math.cos(this.heading) * 2.2);
    }
    if (snap) {
      this.camPos.copy(targetPos);
      this.camLook.copy(targetLook);
    } else {
      const rate = this.focus ? 3.5 : 6;
      this.camPos.x = THREE.MathUtils.damp(this.camPos.x, targetPos.x, rate, dt);
      this.camPos.y = THREE.MathUtils.damp(this.camPos.y, targetPos.y, rate, dt);
      this.camPos.z = THREE.MathUtils.damp(this.camPos.z, targetPos.z, rate, dt);
      this.camLook.x = THREE.MathUtils.damp(this.camLook.x, targetLook.x, rate, dt);
      this.camLook.y = THREE.MathUtils.damp(this.camLook.y, targetLook.y, rate, dt);
      this.camLook.z = THREE.MathUtils.damp(this.camLook.z, targetLook.z, rate, dt);
    }
    // Keep the camera above the pond and ground.
    const pondD = Math.hypot(this.camPos.x - POND.x, this.camPos.z - POND.z);
    if (pondD < POND.r && this.camPos.y < 1.2) this.camPos.y = 1.2;
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
  }

  private project(obj: THREE.Object3D, out: { x: number; y: number; visible: boolean; depth: number }) {
    obj.getWorldPosition(this.tmp);
    const dist = this.tmp.distanceTo(this.camera.position);
    this.tmp.project(this.camera);
    const w = this.opts.container.clientWidth;
    const h = this.opts.container.clientHeight;
    out.visible = this.tmp.z > -1 && this.tmp.z < 1 && Math.abs(this.tmp.x) < 1.15 && Math.abs(this.tmp.y) < 1.15;
    out.x = (this.tmp.x * 0.5 + 0.5) * w;
    out.y = (-this.tmp.y * 0.5 + 0.5) * h;
    out.depth = dist;
  }

  private proj = { x: 0, y: 0, visible: false, depth: 0 };

  private updateOverlay() {
    for (const m of this.markers) {
      this.project(m.item.anchor, this.proj);
      const near = this.nearest === m.item.id;
      const show = this.proj.visible && this.proj.depth < 26 && !this.paused;
      m.el.style.display = show ? '' : 'none';
      if (!show) continue;
      const scale = THREE.MathUtils.clamp(1.15 - this.proj.depth / 40, 0.6, 1.05);
      m.el.style.transform = `translate(-50%, -100%) translate(${this.proj.x.toFixed(1)}px, ${this.proj.y.toFixed(1)}px) scale(${scale.toFixed(3)})`;
      m.el.classList.toggle('is-near', near);
      m.label.hidden = !near;
    }
    const line = this.npcs.chat.line;
    this.bubbles.forEach((b, i) => {
      const active = line >= 0 && CHAT_LINES[line]?.speaker === i;
      if (!active) {
        b.hidden = true;
        return;
      }
      const text = CHAT_LINES[line]!.text;
      if (b.textContent !== text) b.textContent = text;
      this.project(this.npcs.chatters[i]!.labelAnchor, this.proj);
      const show = this.proj.visible && this.proj.depth < 20 && !this.focus;
      b.hidden = !show;
      if (show) b.style.transform = `translate(-50%, -100%) translate(${this.proj.x.toFixed(1)}px, ${(this.proj.y - 8).toFixed(1)}px)`;
    });
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.disposeKeyboard();
    this.resizeObserver.disconnect();
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('pointerdown', this.onPointerDown);
    canvas.removeEventListener('pointerup', this.onPointerUp);
    this.renderer.dispose();
    canvas.remove();
    this.opts.overlay.replaceChildren();
  }
}
