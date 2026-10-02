import { useEffect, useRef, useState } from 'react';
import {
  WHEEL_SEGMENTS,
  claimStatus,
  claimDaily,
  isDemoActive,
  spinStatus,
  spinWheel,
  utcDateKey,
} from '../state/progress';
import { getProgress, setProgress, useProgress } from '../state/store';
import { Dialog } from './Dialog';

interface Props {
  open: boolean;
  onClose(): void;
  spinTo(segment: number): Promise<void>;
  isSpinning(): boolean;
  announce(text: string): void;
}

function msUntilUtcMidnight(now: number) {
  const d = new Date(now);
  const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
  return next - now;
}

function formatShort(ms: number) {
  const m = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(m / 60);
  return `${h}h ${String(m % 60).padStart(2, '0')}m`;
}

function randomUnit() {
  if (globalThis.crypto?.getRandomValues) {
    const a = new Uint32Array(1);
    globalThis.crypto.getRandomValues(a);
    return (a[0] ?? 0) / 0x100000000;
  }
  return Math.random();
}

export function WheelPanel({ open, onClose, spinTo, isSpinning, announce }: Props) {
  const progress = useProgress();
  const [now, setNow] = useState(() => Date.now());
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const lock = useRef(false);

  useEffect(() => {
    if (!open) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, [open]);

  useEffect(() => {
    if (!open) {
      setResult(null);
      setMessage(null);
    }
  }, [open]);

  const active = isDemoActive(progress, now);
  const claim = claimStatus(progress, now);
  const spin = spinStatus(progress, now);
  const claimedToday = progress.lastClaimDate === utcDateKey(now);

  const onClaim = () => {
    const current = getProgress();
    const status = claimStatus(current, Date.now());
    if (!status.ok) {
      setMessage(status.reason === 'demo-ended' ? 'The demo has ended. Claims are closed.' : 'Already claimed today. Come back after UTC midnight.');
      return;
    }
    const next = claimDaily(current, Date.now());
    setProgress(next);
    setResult(null);
    const text = `Spin claimed. Day ${next.streak} streak.`;
    setMessage(text);
    announce(text);
  };

  const onSpin = async () => {
    if (lock.current || isSpinning()) return;
    const current = getProgress();
    const r = spinWheel(current, Date.now(), randomUnit());
    if (!r) {
      const s = spinStatus(current, Date.now());
      setMessage(s.ok ? null : s.reason === 'demo-ended' ? 'The demo has ended. Spins are closed.' : 'No spins left. Claim your free spin tomorrow.');
      return;
    }
    // Commit the result before the animation so a reload or double click cannot duplicate it.
    lock.current = true;
    setProgress(r.progress);
    setSpinning(true);
    setResult(null);
    setMessage(null);
    try {
      await spinTo(r.segment);
    } finally {
      lock.current = false;
      setSpinning(false);
      const text = `You won ${r.points} points.`;
      setResult(text);
      announce(text);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Prize wheel" eyebrow="Spinner Sam" variant="sheet">
      <dl className="stats">
        <div>
          <dt>Points</dt>
          <dd>{progress.points}</dd>
        </div>
        <div>
          <dt>Spins</dt>
          <dd>{progress.spins}</dd>
        </div>
        <div>
          <dt>Streak</dt>
          <dd>{progress.streak > 0 ? `Day ${progress.streak}` : 'None'}</dd>
        </div>
      </dl>
      {active ? (
        <p className="muted">
          {claimedToday
            ? `Today's spin is claimed. Next claim in ${formatShort(msUntilUtcMidnight(now))} (UTC midnight).`
            : 'One free spin per UTC day. Claim it, then spin.'}
        </p>
      ) : (
        <p className="notice" role="note">
          The demo has ended. Final score: <strong>{progress.points} points</strong>. Claims and spins are closed; you can still explore and fish.
        </p>
      )}
      <div className="actions">
        <button type="button" className="btn btn--secondary" onClick={onClaim} disabled={!claim.ok || spinning}>
          {claimedToday ? 'Claimed today' : "Claim today's spin"}
        </button>
        <button type="button" className="btn btn--primary" onClick={onSpin} disabled={!spin.ok || spinning} aria-busy={spinning}>
          {spinning ? 'Spinning…' : 'Spin the wheel'}
        </button>
      </div>
      <p className="status" role="status" aria-live="polite">
        {result ?? message ?? ''}
      </p>
      <p className="fine">
        Segments: {WHEEL_SEGMENTS.join(', ')} points. The result is chosen before the wheel turns, then the wheel lands on it. Missing a day resets the streak to Day 1; points and unused spins are kept. Game points have no monetary value.
      </p>
    </Dialog>
  );
}
