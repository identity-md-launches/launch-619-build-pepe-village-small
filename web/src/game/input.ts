/**
 * Shared input state. Keyboard writes here from `Game`; the on-screen joystick
 * and interact button write here from React. The game loop only reads it.
 */
export interface InputState {
  /** Keyboard axes, -1..1 (x: left/right, y: forward/back). */
  keyX: number;
  keyY: number;
  /** Joystick axes, -1..1 (y positive = forward). */
  stickX: number;
  stickY: number;
  /** Set true for one frame when an interact key or button is pressed. */
  interactPressed: boolean;
}

export const input: InputState = {
  keyX: 0,
  keyY: 0,
  stickX: 0,
  stickY: 0,
  interactPressed: false,
};

const held = new Set<string>();

const FORWARD = ['KeyW', 'ArrowUp'];
const BACK = ['KeyS', 'ArrowDown'];
const LEFT = ['KeyA', 'ArrowLeft'];
const RIGHT = ['KeyD', 'ArrowRight'];
const INTERACT = ['KeyE'];

function recompute() {
  const any = (codes: string[]) => codes.some((c) => held.has(c));
  input.keyX = (any(RIGHT) ? 1 : 0) - (any(LEFT) ? 1 : 0);
  input.keyY = (any(FORWARD) ? 1 : 0) - (any(BACK) ? 1 : 0);
}

function isTypingTarget(t: EventTarget | null) {
  if (!(t instanceof HTMLElement)) return false;
  const tag = t.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable;
}

/** Attach keyboard listeners; returns a disposer. `enabled()` gates the game. */
export function attachKeyboard(enabled: () => boolean) {
  const onDown = (e: KeyboardEvent) => {
    if (isTypingTarget(e.target)) return;
    if (!enabled()) {
      held.clear();
      recompute();
      return;
    }
    if (INTERACT.includes(e.code)) {
      if (!e.repeat) input.interactPressed = true;
      e.preventDefault();
      return;
    }
    if ([...FORWARD, ...BACK, ...LEFT, ...RIGHT].includes(e.code)) {
      held.add(e.code);
      recompute();
      e.preventDefault();
    }
  };
  const onUp = (e: KeyboardEvent) => {
    held.delete(e.code);
    recompute();
  };
  const onBlur = () => {
    held.clear();
    recompute();
  };
  window.addEventListener('keydown', onDown);
  window.addEventListener('keyup', onUp);
  window.addEventListener('blur', onBlur);
  return () => {
    window.removeEventListener('keydown', onDown);
    window.removeEventListener('keyup', onUp);
    window.removeEventListener('blur', onBlur);
    held.clear();
    recompute();
  };
}

/** Combined movement vector, clamped to unit length. */
export function moveVector(): { x: number; y: number } {
  let x = input.keyX + input.stickX;
  let y = input.keyY + input.stickY;
  const len = Math.hypot(x, y);
  if (len > 1) {
    x /= len;
    y /= len;
  }
  return { x, y };
}
