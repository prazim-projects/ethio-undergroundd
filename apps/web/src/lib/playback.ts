import { API_ORIGIN } from './graphql';
import type { CreativeWork } from '../composables/use-catalog';
export interface PlaybackSnapshot {
  work: CreativeWork;
  queue: CreativeWork[];
  time: number;
  playing: boolean;
  volume: number;
  saved: number;
}
const key = (owner?: number) => `underground_playback:${API_ORIGIN}:${owner ?? 'guest'}`;
export function restorePlayback(owner?: number): PlaybackSnapshot | undefined {
  try {
    const state = JSON.parse(localStorage.getItem(key(owner)) || 'null') as PlaybackSnapshot | null;
    if (state && /^\d+$/.test(state.work?.id) && state.work.creator && Array.isArray(state.queue) && Number.isFinite(state.time) && state.time >= 0 && state.volume >= 0 && state.volume <= 1 && Date.now() - state.saved < 7 * 86400_000) return state;
  } catch { /* Playback remains available without storage. */ }
}
export function savePlayback(state: PlaybackSnapshot, owner?: number) {
  try { localStorage.setItem(key(owner), JSON.stringify(state)); } catch { /* Optional recovery. */ }
}
export function clearPlayback() {
  try { for (const name of Object.keys(localStorage)) if (name.startsWith('underground_playback:')) localStorage.removeItem(name); } catch { /* Optional storage. */ }
}
