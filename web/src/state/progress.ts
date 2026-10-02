/**
 * Pure game-progress rules for the Pepe Village demo.
 *
 * Everything here is deterministic given `now` (ms since epoch) so the rules can
 * be unit-tested without a browser. Persistence lives in `store.ts`.
 */

export const DEMO_DAYS = 30;
export const DAY_MS = 24 * 60 * 60 * 1000;
export const DEMO_LENGTH_MS = DEMO_DAYS * DAY_MS;

/** Six equal wheel segments, in clockwise order starting at the top. */
export const WHEEL_SEGMENTS = [10, 20, 30, 50, 75, 100] as const;
export const SEGMENT_COUNT = WHEEL_SEGMENTS.length;
export const SEGMENT_ANGLE = (Math.PI * 2) / SEGMENT_COUNT;

export interface Progress {
  version: 1;
  /** Accumulated game points (no monetary value). */
  points: number;
  /** Unused spin credits. */
  spins: number;
  /** UTC calendar day of the last daily claim, as YYYY-MM-DD, or null. */
  lastClaimDate: string | null;
  /** Current consecutive-day claim streak (0 before the first claim). */
  streak: number;
  /** Longest streak reached, for the end-of-demo summary. */
  bestStreak: number;
  /** ms timestamp of the first visit; the personal 30-day demo starts here. */
  demoStart: number;
  /** Count of wheel spins performed. */
  totalSpins: number;
  /** Count of fish caught in the mini-game. */
  fishCaught: number;
  /** Count of fishing attempts. */
  fishAttempts: number;
}

export function createProgress(now: number): Progress {
  return {
    version: 1,
    points: 0,
    spins: 0,
    lastClaimDate: null,
    streak: 0,
    bestStreak: 0,
    demoStart: now,
    totalSpins: 0,
    fishCaught: 0,
    fishAttempts: 0,
  };
}

/** YYYY-MM-DD in UTC for a timestamp. */
export function utcDateKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Difference in whole UTC calendar days between two date keys (b - a). */
export function dayDifference(a: string, b: string): number {
  const ta = Date.parse(`${a}T00:00:00Z`);
  const tb = Date.parse(`${b}T00:00:00Z`);
  return Math.round((tb - ta) / DAY_MS);
}

export function demoEnd(p: Progress): number {
  return p.demoStart + DEMO_LENGTH_MS;
}

export function isDemoActive(p: Progress, now: number): boolean {
  return now < demoEnd(p);
}

export function demoRemainingMs(p: Progress, now: number): number {
  return Math.max(0, demoEnd(p) - now);
}

export type ClaimStatus =
  | { ok: true }
  | { ok: false; reason: 'already-claimed' | 'demo-ended' };

export function claimStatus(p: Progress, now: number): ClaimStatus {
  if (!isDemoActive(p, now)) return { ok: false, reason: 'demo-ended' };
  if (p.lastClaimDate === utcDateKey(now)) return { ok: false, reason: 'already-claimed' };
  return { ok: true };
}

/**
 * Claim today's free spin. One claim per UTC calendar day. A claim on the day
 * after the previous claim extends the streak; any gap resets it to day 1.
 * Points and unused spins are always preserved.
 */
export function claimDaily(p: Progress, now: number): Progress {
  const status = claimStatus(p, now);
  if (!status.ok) return p;
  const today = utcDateKey(now);
  const consecutive = p.lastClaimDate !== null && dayDifference(p.lastClaimDate, today) === 1;
  const streak = consecutive ? p.streak + 1 : 1;
  return {
    ...p,
    spins: p.spins + 1,
    lastClaimDate: today,
    streak,
    bestStreak: Math.max(p.bestStreak, streak),
  };
}

export type SpinStatus =
  | { ok: true }
  | { ok: false; reason: 'no-spins' | 'demo-ended' };

export function spinStatus(p: Progress, now: number): SpinStatus {
  if (!isDemoActive(p, now)) return { ok: false, reason: 'demo-ended' };
  if (p.spins <= 0) return { ok: false, reason: 'no-spins' };
  return { ok: true };
}

export interface SpinResult {
  segment: number;
  points: number;
  progress: Progress;
}

/**
 * Consume one spin credit and award the selected segment's points. The result
 * is chosen before any animation so the wheel can be driven to land on it.
 * `random` is a number in [0, 1).
 */
export function spinWheel(p: Progress, now: number, random: number): SpinResult | null {
  if (!spinStatus(p, now).ok) return null;
  const segment = Math.min(SEGMENT_COUNT - 1, Math.max(0, Math.floor(random * SEGMENT_COUNT)));
  const points = WHEEL_SEGMENTS[segment] ?? 0;
  return {
    segment,
    points,
    progress: {
      ...p,
      spins: p.spins - 1,
      points: p.points + points,
      totalSpins: p.totalSpins + 1,
    },
  };
}

/**
 * Wheel rotation (radians, counter-clockwise as seen from the front) that puts
 * the centre of `segment` under a pointer fixed at the top of the wheel.
 * `jitter` is a fraction in [-0.4, 0.4] of a segment width so the wheel does
 * not always stop dead centre; it never leaves the segment.
 */
export function rotationForSegment(segment: number, jitter = 0): number {
  const j = Math.max(-0.4, Math.min(0.4, jitter));
  return segment * SEGMENT_ANGLE + j * SEGMENT_ANGLE;
}

/** Inverse of `rotationForSegment` for any rotation (handles extra turns). */
export function segmentAtRotation(rotation: number): number {
  const twoPi = Math.PI * 2;
  const r = ((rotation % twoPi) + twoPi) % twoPi;
  return Math.floor((r + SEGMENT_ANGLE / 2) / SEGMENT_ANGLE) % SEGMENT_COUNT;
}

export interface FishType {
  name: string;
  points: number;
  /** Minimum catch precision (0 = anywhere in the zone, 1 = dead centre). */
  minPrecision: number;
}

export const FISH_TYPES: readonly FishType[] = [
  { name: 'Lily-pad minnow', points: 5, minPrecision: 0 },
  { name: 'Pond perch', points: 10, minPrecision: 0.35 },
  { name: 'Golden carp', points: 20, minPrecision: 0.7 },
  { name: 'Legendary frogfish', points: 40, minPrecision: 0.92 },
];

export interface CastResult {
  caught: boolean;
  fish: FishType | null;
  /** 0..1, how close to the centre of the target zone the hook landed. */
  precision: number;
  pointsAwarded: number;
  progress: Progress;
}

/**
 * Resolve one "Cast your line" attempt. `indicator`, `zoneStart` and `zoneEnd`
 * are positions in [0, 1] along the bar. Points are only awarded while the demo
 * is active; after it ends fishing stays playable for fun.
 */
export function resolveCast(
  p: Progress,
  now: number,
  indicator: number,
  zoneStart: number,
  zoneEnd: number,
): CastResult {
  const inZone = indicator >= zoneStart && indicator <= zoneEnd;
  const half = (zoneEnd - zoneStart) / 2;
  const centre = zoneStart + half;
  const precision = inZone && half > 0 ? 1 - Math.abs(indicator - centre) / half : 0;
  let fish: FishType | null = null;
  if (inZone) {
    for (const f of FISH_TYPES) if (precision >= f.minPrecision) fish = f;
  }
  const active = isDemoActive(p, now);
  const pointsAwarded = fish && active ? fish.points : 0;
  return {
    caught: inZone,
    fish,
    precision,
    pointsAwarded,
    progress: {
      ...p,
      points: p.points + pointsAwarded,
      fishAttempts: p.fishAttempts + 1,
      fishCaught: p.fishCaught + (inZone ? 1 : 0),
    },
  };
}

/** Format a remaining duration as "12d 03h 07m" style text (UTC-agnostic). */
export function formatRemaining(ms: number): string {
  if (ms <= 0) return 'Ended';
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${days}d ${pad(hours)}h ${pad(minutes)}m`;
}

/** Validate an unknown value loaded from storage into a Progress object. */
export function normalizeProgress(raw: unknown, now: number): Progress {
  const fresh = createProgress(now);
  if (!raw || typeof raw !== 'object') return fresh;
  const r = raw as Record<string, unknown>;
  const num = (v: unknown, fallback: number) =>
    typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : fallback;
  const date =
    typeof r.lastClaimDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.lastClaimDate)
      ? r.lastClaimDate
      : null;
  const demoStart = num(r.demoStart, fresh.demoStart);
  return {
    version: 1,
    points: Math.floor(num(r.points, 0)),
    spins: Math.floor(num(r.spins, 0)),
    lastClaimDate: date,
    streak: Math.floor(num(r.streak, 0)),
    bestStreak: Math.floor(num(r.bestStreak, Math.floor(num(r.streak, 0)))),
    demoStart: demoStart > 0 && demoStart <= now + DAY_MS ? demoStart : fresh.demoStart,
    totalSpins: Math.floor(num(r.totalSpins, 0)),
    fishCaught: Math.floor(num(r.fishCaught, 0)),
    fishAttempts: Math.floor(num(r.fishAttempts, 0)),
  };
}
