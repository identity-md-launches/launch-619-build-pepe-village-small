import { useCallback, useEffect, useRef, useState } from 'react';
import { isDemoActive, resolveCast, type CastResult } from '../state/progress';
import { getProgress, setProgress, useProgress } from '../state/store';
import { Dialog } from './Dialog';

interface Props {
  open: boolean;
  onClose(): void;
  onCast(): void;
  onSplash(strength: number): void;
  announce(text: string): void;
}

type Phase = 'idle' | 'casting' | 'result';

const BASE_SPEED = 0.55; // bar lengths per second

export function FishingPanel({ open, onClose, onCast, onSplash, announce }: Props) {
  const progress = useProgress();
  const [phase, setPhase] = useState<Phase>('idle');
  const [zone, setZone] = useState({ start: 0.4, end: 0.6 });
  const [result, setResult] = useState<CastResult | null>(null);
  const [streak, setStreak] = useState(0);
  const indicatorRef = useRef<HTMLDivElement>(null);
  const raf = useRef(0);
  const startTime = useRef(0);
  const speed = useRef(BASE_SPEED);
  const lastDrawn = useRef(0);
  const hookButton = useRef<HTMLButtonElement>(null);

  const positionAt = useCallback((t: number) => {
    const x = ((t - startTime.current) / 1000) * speed.current;
    const tri = x % 2;
    return tri <= 1 ? tri : 2 - tri;
  }, []);

  const stopLoop = () => cancelAnimationFrame(raf.current);

  const startCast = () => {
    const width = 0.14 + Math.random() * 0.08;
    const start = 0.08 + Math.random() * (0.84 - width);
    setZone({ start, end: start + width });
    setResult(null);
    speed.current = BASE_SPEED + Math.min(0.5, streak * 0.08);
    startTime.current = performance.now();
    setPhase('casting');
    onCast();
    const tick = (t: number) => {
      const p = positionAt(t);
      lastDrawn.current = p;
      if (indicatorRef.current) indicatorRef.current.style.insetInlineStart = `${(p * 100).toFixed(2)}%`;
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    window.setTimeout(() => hookButton.current?.focus(), 0);
  };

  const hook = () => {
    if (phase !== 'casting') return;
    stopLoop();
    // Judge the marker where the player last saw it, not where the clock says it is now.
    const p = lastDrawn.current;
    const r = resolveCast(getProgress(), Date.now(), p, zone.start, zone.end);
    setProgress(r.progress);
    setResult(r);
    setPhase('result');
    setStreak(r.caught ? streak + 1 : 0);
    onSplash(r.caught ? 2 : 1);
    announce(
      r.caught && r.fish
        ? `You caught a ${r.fish.name}.${r.pointsAwarded ? ` Plus ${r.pointsAwarded} points.` : ''}`
        : 'It got away.',
    );
  };

  useEffect(() => {
    if (!open) {
      stopLoop();
      setPhase('idle');
      setResult(null);
      setStreak(0);
    }
    return stopLoop;
  }, [open]);

  // Space / Enter hook while casting (buttons already handle Enter and Space
  // when focused; this covers focus elsewhere in the panel).
  useEffect(() => {
    if (!open || phase !== 'casting') return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.code === 'Space' || e.code === 'Enter') && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        hook();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const demoActive = isDemoActive(progress, Date.now());

  return (
    <Dialog open={open} onClose={onClose} title="Cast your line" eyebrow="Captain Ribbit" variant="sheet">
      <p className="muted">
        Press <strong>Hook</strong> while the marker is inside the green target. Closer to the centre catches a rarer fish.
      </p>
      <div className="fishbar" aria-hidden="true">
        <div className="fishbar-zone" style={{ insetInlineStart: `${zone.start * 100}%`, width: `${(zone.end - zone.start) * 100}%` }} />
        <div ref={indicatorRef} className="fishbar-indicator" style={{ insetInlineStart: '0%' }} />
      </div>
      <div className="actions">
        {phase === 'casting' ? (
          <button ref={hookButton} type="button" className="btn btn--primary" onClick={hook}>
            Hook
          </button>
        ) : (
          <button type="button" className="btn btn--primary" onClick={startCast} autoFocus={phase === 'result'}>
            {phase === 'result' ? 'Cast again' : 'Cast your line'}
          </button>
        )}
        <span className="muted tabular">
          Caught {progress.fishCaught} / {progress.fishAttempts} casts
        </span>
      </div>
      <p className="status" role="status" aria-live="polite">
        {result
          ? result.caught && result.fish
            ? `You caught a ${result.fish.name}!${result.pointsAwarded ? ` +${result.pointsAwarded} points.` : demoActive ? '' : ' (Demo ended: no points.)'}`
            : 'It got away. Cast again.'
          : phase === 'casting'
            ? 'Line is in the water…'
            : ''}
      </p>
      <p className="fine">Fishing points are game points only and do not create raffle tickets. Fishing stays open after the demo ends, without points.</p>
    </Dialog>
  );
}
