import * as THREE from 'three';
import { WHEEL_SEGMENTS } from '../state/progress';

/** All visual assets are drawn on canvases at start-up, so nothing is fetched. */

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  return { c, ctx };
}

function texture(c: HTMLCanvasElement, repeat?: [number, number]) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  return t;
}

/** Deterministic pseudo-random so the world looks the same on every visit. */
export function seeded(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

export function grassTexture(repeat = 24) {
  const { c, ctx } = canvas(256, 256);
  ctx.fillStyle = '#7ccd5f';
  ctx.fillRect(0, 0, 256, 256);
  const rnd = seeded(7);
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = rnd() < 0.5 ? '#8ad96c' : '#72c257';
    const x = rnd() * 256;
    const y = rnd() * 256;
    const r = 3 + rnd() * 7;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 40; i++) {
    ctx.strokeStyle = '#64b84c';
    ctx.lineWidth = 1.5;
    const x = rnd() * 256;
    const y = rnd() * 256;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rnd() - 0.5) * 6, y - 5 - rnd() * 6);
    ctx.stroke();
  }
  return texture(c, [repeat, repeat]);
}

export function stoneTexture(repeat = 4) {
  const { c, ctx } = canvas(256, 256);
  ctx.fillStyle = '#9f9788';
  ctx.fillRect(0, 0, 256, 256);
  const rnd = seeded(11);
  const cols = 5;
  const rows = 5;
  const cw = 256 / cols;
  const ch = 256 / rows;
  const shades = ['#d6cfc2', '#c9c2b6', '#bfb7aa', '#ded7cb', '#cdc5b7'];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const inset = 4 + rnd() * 3;
      const px = x * cw + inset;
      const py = y * ch + inset;
      const w = cw - inset * 2 - rnd() * 4;
      const h = ch - inset * 2 - rnd() * 4;
      ctx.fillStyle = shades[Math.floor(rnd() * shades.length)] ?? '#c9c2b6';
      ctx.beginPath();
      ctx.roundRect(px, py, w, h, 9);
      ctx.fill();
      ctx.strokeStyle = 'rgba(70, 60, 50, 0.25)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
  return texture(c, [repeat, repeat]);
}

export const WHEEL_COLORS = ['#ff6b6b', '#ffd93d', '#6bcB77', '#4d96ff', '#c77dff', '#ff9f43'] as const;

/**
 * Wheel face. Segment i is centred `i * 60°` clockwise from the top, so a
 * counter-clockwise mesh rotation of `i * 60°` brings it under a pointer at
 * 12 o'clock (see `rotationForSegment`).
 */
export function wheelTexture() {
  const size = 1024;
  const { c, ctx } = canvas(size, size);
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 8;
  const n = WHEEL_SEGMENTS.length;
  const step = (Math.PI * 2) / n;
  for (let i = 0; i < n; i++) {
    const centre = -Math.PI / 2 + i * step;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, centre - step / 2, centre + step / 2);
    ctx.closePath();
    ctx.fillStyle = WHEEL_COLORS[i] ?? '#ccc';
    ctx.fill();
    ctx.strokeStyle = '#1d2a1b';
    ctx.lineWidth = 10;
    ctx.stroke();
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(centre);
    ctx.fillStyle = '#1d2a1b';
    ctx.font = 'bold 118px system-ui, "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(WHEEL_SEGMENTS[i]), r * 0.62, 0);
    ctx.font = 'bold 44px system-ui, "Segoe UI", Arial, sans-serif';
    ctx.fillText('PTS', r * 0.62, 78);
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(cx, cy, 86, 0, Math.PI * 2);
  ctx.fillStyle = '#fff5cc';
  ctx.fill();
  ctx.strokeStyle = '#1d2a1b';
  ctx.lineWidth = 10;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.lineWidth = 14;
  ctx.stroke();
  const t = texture(c);
  t.anisotropy = 8;
  return t;
}

export interface SignTexture {
  texture: THREE.CanvasTexture;
  /** Redraw the countdown line; cheap enough to call once a minute. */
  setCountdown(text: string): void;
}

export function signTexture(): SignTexture {
  const w = 1536;
  const h = 640;
  const { c, ctx } = canvas(w, h);
  let countdown = '';
  const draw = () => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#1f2d4a';
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, 48);
    ctx.fill();
    ctx.strokeStyle = '#f5c542';
    ctx.lineWidth = 18;
    ctx.beginPath();
    ctx.roundRect(28, 28, w - 56, h - 56, 36);
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 190px system-ui, "Segoe UI", Arial, sans-serif';
    ctx.lineWidth = 22;
    ctx.strokeStyle = '#1d2a1b';
    ctx.lineJoin = 'round';
    ctx.strokeText('GRAND PRIZE', w / 2, 190);
    const grad = ctx.createLinearGradient(0, 100, 0, 280);
    grad.addColorStop(0, '#fff2a8');
    grad.addColorStop(0.5, '#f5c542');
    grad.addColorStop(1, '#e09a1c');
    ctx.fillStyle = grad;
    ctx.fillText('GRAND PRIZE', w / 2, 190);
    ctx.font = '700 86px system-ui, "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('Target prize: 1 IMD NFT', w / 2, 370);
    ctx.font = '600 68px system-ui, "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#9dffb8';
    ctx.fillText(`Demo ends in ${countdown || '…'}`, w / 2, 500);
    ctx.font = '600 40px system-ui, "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#cfd8ea';
    ctx.fillText('DEMO · points have no monetary value', w / 2, 580);
  };
  draw();
  const t = texture(c);
  t.anisotropy = 8;
  return {
    texture: t,
    setCountdown(text: string) {
      if (text === countdown) return;
      countdown = text;
      draw();
      t.needsUpdate = true;
    },
  };
}

/** Draws a simple Pepe face with canvas primitives (used on the prize card). */
function drawPepeFace(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#1d2a1b';
  ctx.fillStyle = '#5aa84a';
  ctx.beginPath();
  ctx.ellipse(0, 10, 110, 90, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  for (const ex of [-42, 42]) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(ex, -40, 36, 30, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#141a14';
    ctx.beginPath();
    ctx.arc(ex + 8, -36, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3e7f33';
    ctx.beginPath();
    ctx.ellipse(ex, -58, 38, 22, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.strokeStyle = '#1d2a1b';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(-70, 42);
  ctx.quadraticCurveTo(0, 70, 70, 42);
  ctx.stroke();
  ctx.strokeStyle = '#c9433a';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(-60, 52);
  ctx.quadraticCurveTo(0, 82, 60, 52);
  ctx.stroke();
  ctx.restore();
}

/** Original placeholder prize card (no real NFT art was provided). */
export function prizeCardTexture() {
  const w = 768;
  const h = 1024;
  const { c, ctx } = canvas(w, h);
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#2b1f5c');
  bg.addColorStop(1, '#0f3d3a');
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, 56);
  ctx.fill();
  ctx.strokeStyle = '#f5c542';
  ctx.lineWidth = 16;
  ctx.beginPath();
  ctx.roundRect(24, 24, w - 48, h - 48, 44);
  ctx.stroke();
  // Art area
  ctx.fillStyle = '#9ad7f2';
  ctx.beginPath();
  ctx.roundRect(64, 150, w - 128, 520, 32);
  ctx.fill();
  ctx.fillStyle = '#7ccd5f';
  ctx.beginPath();
  ctx.roundRect(64, 520, w - 128, 150, 32);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  for (const [cx, cy, r] of [
    [180, 230, 34],
    [220, 215, 44],
    [265, 235, 30],
    [560, 300, 30],
    [600, 285, 40],
    [640, 305, 28],
  ] as const) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  drawPepeFace(ctx, w / 2, 430, 1.4);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 72px system-ui, "Segoe UI", Arial, sans-serif';
  ctx.fillText('IMD NFT', w / 2, 90);
  ctx.font = '700 44px system-ui, "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#f5c542';
  ctx.fillText('TARGET PRIZE · 1 NFT', w / 2, 740);
  ctx.font = '600 38px system-ui, "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#d7e3f5';
  ctx.fillText('Placeholder art by the village', w / 2, 810);
  // Illustrative label banner
  ctx.fillStyle = '#ff6b6b';
  ctx.beginPath();
  ctx.roundRect(120, 870, w - 240, 90, 24);
  ctx.fill();
  ctx.fillStyle = '#1d2a1b';
  ctx.font = '800 50px system-ui, "Segoe UI", Arial, sans-serif';
  ctx.fillText('Illustrative image', w / 2, 916);
  const t = texture(c);
  t.anisotropy = 8;
  return t;
}

/** Soft radial sprite used behind the sign's bulbs for the glow. */
export function glowSpriteTexture() {
  const { c, ctx } = canvas(128, 128);
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Small text plaque (shop signs, bench plaque). */
export function plaqueTexture(text: string, bg = '#fff8e6', fg = '#1d2a1b') {
  const { c, ctx } = canvas(512, 160);
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(0, 0, 512, 160, 28);
  ctx.fill();
  ctx.strokeStyle = fg;
  ctx.lineWidth = 10;
  ctx.stroke();
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let size = 76;
  do {
    ctx.font = `800 ${size}px system-ui, "Segoe UI", Arial, sans-serif`;
    size -= 4;
  } while (ctx.measureText(text).width > 440 && size > 24);
  ctx.fillText(text, 256, 84);
  return texture(c);
}
