import { describe, expect, it } from 'vitest';
import {
  DAY_MS,
  DEMO_LENGTH_MS,
  SEGMENT_COUNT,
  WHEEL_SEGMENTS,
  claimDaily,
  claimStatus,
  createProgress,
  formatRemaining,
  isDemoActive,
  normalizeProgress,
  resolveCast,
  rotationForSegment,
  segmentAtRotation,
  spinStatus,
  spinWheel,
  utcDateKey,
} from './progress';

const T0 = Date.parse('2026-10-02T12:00:00Z');

describe('daily claim', () => {
  it('grants one spin per UTC day and starts the streak at day 1', () => {
    const p0 = createProgress(T0);
    const p1 = claimDaily(p0, T0);
    expect(p1.spins).toBe(1);
    expect(p1.streak).toBe(1);
    expect(p1.lastClaimDate).toBe('2026-10-02');
    // A second claim the same UTC day is a no-op.
    const p2 = claimDaily(p1, T0 + 5 * 60 * 60 * 1000);
    expect(p2).toBe(p1);
    expect(claimStatus(p1, T0 + 1000)).toEqual({ ok: false, reason: 'already-claimed' });
  });

  it('uses the UTC calendar day, not local time', () => {
    const lateEvening = Date.parse('2026-10-02T23:30:00Z');
    const p1 = claimDaily(createProgress(T0), lateEvening);
    const p2 = claimDaily(p1, lateEvening + 60 * 60 * 1000); // 00:30 next UTC day
    expect(p2.spins).toBe(2);
    expect(p2.streak).toBe(2);
    expect(utcDateKey(lateEvening + 60 * 60 * 1000)).toBe('2026-10-03');
  });

  it('increments the streak on consecutive days and resets after a gap', () => {
    let p = createProgress(T0);
    p = claimDaily(p, T0);
    p = claimDaily(p, T0 + DAY_MS);
    p = claimDaily(p, T0 + 2 * DAY_MS);
    expect(p.streak).toBe(3);
    expect(p.spins).toBe(3);
    // Skip a day: streak resets to 1, points and spins preserved.
    const spun = spinWheel(p, T0 + 2 * DAY_MS, 0.5);
    expect(spun).not.toBeNull();
    p = spun!.progress;
    const pointsBefore = p.points;
    p = claimDaily(p, T0 + 4 * DAY_MS);
    expect(p.streak).toBe(1);
    expect(p.bestStreak).toBe(3);
    expect(p.points).toBe(pointsBefore);
    expect(p.spins).toBe(3); // 3 claimed - 1 spun + 1 new
  });

  it('refuses claims after the 30-day demo ends', () => {
    const p = createProgress(T0);
    expect(isDemoActive(p, T0 + DEMO_LENGTH_MS - 1)).toBe(true);
    expect(isDemoActive(p, T0 + DEMO_LENGTH_MS)).toBe(false);
    expect(claimStatus(p, T0 + DEMO_LENGTH_MS)).toEqual({ ok: false, reason: 'demo-ended' });
    expect(claimDaily(p, T0 + DEMO_LENGTH_MS)).toBe(p);
  });
});

describe('wheel', () => {
  it('consumes exactly one spin and awards the selected segment', () => {
    const p = claimDaily(createProgress(T0), T0);
    const r = spinWheel(p, T0, 0.999);
    expect(r).not.toBeNull();
    expect(r!.segment).toBe(5);
    expect(r!.points).toBe(100);
    expect(r!.progress.spins).toBe(0);
    expect(r!.progress.points).toBe(100);
    // Repeated clicks with no credits do nothing.
    expect(spinWheel(r!.progress, T0, 0.1)).toBeNull();
    expect(spinStatus(r!.progress, T0)).toEqual({ ok: false, reason: 'no-spins' });
  });

  it('maps random values evenly onto six segments', () => {
    const p = { ...createProgress(T0), spins: 100 };
    for (let i = 0; i < SEGMENT_COUNT; i++) {
      const r = spinWheel(p, T0, (i + 0.5) / SEGMENT_COUNT);
      expect(r!.segment).toBe(i);
      expect(r!.points).toBe(WHEEL_SEGMENTS[i]);
    }
  });

  it('refuses spins after the demo ends even with credits', () => {
    const p = { ...createProgress(T0), spins: 3 };
    expect(spinWheel(p, T0 + DEMO_LENGTH_MS, 0.5)).toBeNull();
  });

  it('lands the pointer on the chosen segment for any jitter and extra turns', () => {
    for (let s = 0; s < SEGMENT_COUNT; s++) {
      for (const j of [-0.4, -0.2, 0, 0.25, 0.4]) {
        const rot = rotationForSegment(s, j) + Math.PI * 2 * 7;
        expect(segmentAtRotation(rot)).toBe(s);
        expect(segmentAtRotation(-rot + 2 * rotationForSegment(s, j))).toBe(s);
      }
    }
  });
});

describe('fishing', () => {
  it('catches when the indicator is inside the zone and awards by precision', () => {
    const p = createProgress(T0);
    const miss = resolveCast(p, T0, 0.1, 0.4, 0.6);
    expect(miss.caught).toBe(false);
    expect(miss.pointsAwarded).toBe(0);
    expect(miss.progress.fishAttempts).toBe(1);
    const edge = resolveCast(p, T0, 0.41, 0.4, 0.6);
    expect(edge.caught).toBe(true);
    expect(edge.fish?.name).toBe('Lily-pad minnow');
    const centre = resolveCast(p, T0, 0.5, 0.4, 0.6);
    expect(centre.fish?.name).toBe('Legendary frogfish');
    expect(centre.pointsAwarded).toBe(40);
    expect(centre.progress.points).toBe(40);
  });

  it('stays playable but awards no points after the demo ends', () => {
    const p = createProgress(T0);
    const r = resolveCast(p, T0 + DEMO_LENGTH_MS + 1, 0.5, 0.4, 0.6);
    expect(r.caught).toBe(true);
    expect(r.pointsAwarded).toBe(0);
    expect(r.progress.points).toBe(0);
    expect(r.progress.fishCaught).toBe(1);
  });
});

describe('persistence helpers', () => {
  it('normalizes corrupt storage without losing valid fields', () => {
    const p = normalizeProgress(
      { points: 120, spins: '2', lastClaimDate: 'nope', streak: 4, demoStart: T0 - DAY_MS },
      T0,
    );
    expect(p.points).toBe(120);
    expect(p.spins).toBe(0);
    expect(p.lastClaimDate).toBeNull();
    expect(p.streak).toBe(4);
    expect(p.bestStreak).toBe(4);
    expect(p.demoStart).toBe(T0 - DAY_MS);
    expect(normalizeProgress('garbage', T0).demoStart).toBe(T0);
  });

  it('formats the countdown', () => {
    expect(formatRemaining(0)).toBe('Ended');
    expect(formatRemaining(DAY_MS * 29 + 3 * 3600_000 + 7 * 60_000 + 59_000)).toBe('29d 03h 07m');
  });
});
