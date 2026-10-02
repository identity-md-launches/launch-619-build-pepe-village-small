import { useRef } from 'react';
import { input } from '../game/input';

const RADIUS = 44;

/** Touch joystick: writes normalised axes into the shared input state. */
export function Joystick() {
  const baseRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const active = useRef<number | null>(null);

  const setKnob = (dx: number, dy: number) => {
    const knob = knobRef.current;
    if (knob) knob.style.transform = `translate(${dx}px, ${dy}px)`;
  };

  const update = (e: React.PointerEvent) => {
    const base = baseRef.current;
    if (!base) return;
    const rect = base.getBoundingClientRect();
    let dx = e.clientX - (rect.left + rect.width / 2);
    let dy = e.clientY - (rect.top + rect.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > RADIUS) {
      dx = (dx / len) * RADIUS;
      dy = (dy / len) * RADIUS;
    }
    input.stickX = dx / RADIUS;
    input.stickY = -dy / RADIUS;
    setKnob(dx, dy);
  };

  const release = () => {
    active.current = null;
    input.stickX = 0;
    input.stickY = 0;
    setKnob(0, 0);
  };

  return (
    <div
      ref={baseRef}
      className="joystick"
      role="application"
      aria-label="Movement joystick. Drag to walk."
      onPointerDown={(e) => {
        if (active.current !== null) return;
        active.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        update(e);
      }}
      onPointerMove={(e) => {
        if (active.current === e.pointerId) update(e);
      }}
      onPointerUp={(e) => {
        if (active.current === e.pointerId) release();
      }}
      onPointerCancel={release}
      onLostPointerCapture={release}
    >
      <div ref={knobRef} className="joystick-knob" />
    </div>
  );
}
