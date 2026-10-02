import { useSyncExternalStore } from 'react';
import { createProgress, normalizeProgress, type Progress } from './progress';

export const STORAGE_KEY = 'pepe-village.progress.v1';

type Listener = () => void;

let current: Progress = load();
const listeners = new Set<Listener>();

function load(): Progress {
  const now = Date.now();
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!raw) {
      const fresh = createProgress(now);
      persist(fresh);
      return fresh;
    }
    const parsed = normalizeProgress(JSON.parse(raw), now);
    persist(parsed);
    return parsed;
  } catch {
    return createProgress(now);
  }
}

function persist(p: Progress) {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable (private mode, quota); keep in-memory state */
  }
}

export function getProgress(): Progress {
  return current;
}

export function setProgress(next: Progress) {
  if (next === current) return;
  current = next;
  persist(next);
  for (const l of listeners) l();
}

export function updateProgress(fn: (p: Progress) => Progress) {
  setProgress(fn(current));
}

export function resetProgress() {
  try {
    globalThis.localStorage?.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  setProgress(createProgress(Date.now()));
}

function subscribe(l: Listener) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useProgress(): Progress {
  return useSyncExternalStore(subscribe, getProgress, getProgress);
}
