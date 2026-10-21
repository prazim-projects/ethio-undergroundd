// Bounded, successful-response cache. Storage failures never prevent a request.
const prefix = 'underground_query_v1:';
const limit = 24;
const maxBytes = 1_500_000;
type Entry<T> = { saved: number; value: T };
export function readQuery<T>(key: string, age = 60_000): T | undefined {
  try {
    const entry = JSON.parse(localStorage.getItem(prefix + key) || 'null') as Entry<T> | null;
    if (entry && Date.now() - entry.saved < age) return structuredClone(entry.value);
  } catch { /* Corrupt or disabled storage is a cache miss. */ }
}
export function writeQuery<T>(key: string, value: T) {
  try {
    const data = JSON.stringify({ saved: Date.now(), value });
    if (data.length * 2 > maxBytes / 2) return;
    const entries = Object.keys(localStorage).filter((name) => name.startsWith(prefix)).map((name) => ({ name, data: localStorage.getItem(name)! }));
    entries.sort((a, b) => (JSON.parse(a.data).saved || 0) - (JSON.parse(b.data).saved || 0));
    let bytes = entries.reduce((sum, entry) => sum + entry.data.length * 2, 0);
    while (entries.length >= limit || bytes + data.length * 2 > maxBytes) {
      const oldest = entries.shift();
      if (!oldest) break;
      localStorage.removeItem(oldest.name); bytes -= oldest.data.length * 2;
    }
    localStorage.setItem(prefix + key, data);
  } catch { /* Full storage does not affect playback or uploads. */ }
}
export function clearQueries(scope = '') {
  try { for (const key of Object.keys(localStorage)) if (key.startsWith(prefix + scope)) localStorage.removeItem(key); } catch { /* Optional cache. */ }
}
export async function cacheKey(value: string) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
