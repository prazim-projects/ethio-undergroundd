import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cancelUpload, publishWork } from '../../src/lib/uploads';

let offset = 0;
let started = 0;
let completions = 0;
let loseResponse = false;
let pause: AbortController | undefined;
const offsets: number[] = [];
const file = new File([new Uint8Array(16 * 1024 * 1024)], 'song.mp3', { type: 'audio/mpeg', lastModified: 1000 });
function form() { const data = new FormData(); data.set('file', file); data.set('title', 'Song'); data.set('workType', 'music'); return data; }
const session = () => ({ id: 'upload-id', offset, size: file.size, chunkSize: 2 * 1024 * 1024 });

class FakeXHR {
  upload = { onprogress: (_: unknown) => {} };
  method = ''; path = ''; headers: Record<string, string> = {};
  status = 200; responseText = ''; timeout = 0;
  onload = () => {}; onerror = () => {}; onabort = () => {}; onloadend = () => {}; ontimeout = () => {};
  open(method: string, path: string) { this.method = method; this.path = path; }
  setRequestHeader(key: string, value: string) { this.headers[key] = value; }
  abort() { this.onabort(); this.onloadend(); }
  send(body: Blob | string) {
    queueMicrotask(() => {
      let result: unknown;
      if (this.method === 'POST' && this.path.endsWith('/uploads/')) { started++; result = session(); }
      else if (this.method === 'PATCH') {
        if (pause && offset === 2 * 1024 * 1024) { pause.abort(); pause = undefined; return; }
        offsets.push(Number(this.headers['Upload-Offset']));
        offset += (body as Blob).size;
        if (loseResponse) { loseResponse = false; this.onerror(); this.onloadend(); return; }
        result = session();
      } else if (this.method === 'GET') result = session();
      else if (this.method === 'DELETE') { offset = 0; result = { cancelled: true }; }
      else { completions++; result = { id: 1 }; }
      this.responseText = JSON.stringify(result); this.onload(); this.onloadend();
    });
  }
}
beforeEach(() => {
  offset = 0; started = 0; completions = 0; loseResponse = false; pause = undefined; offsets.length = 0;
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) });
  vi.stubGlobal('XMLHttpRequest', FakeXHR);
});
afterEach(() => vi.unstubAllGlobals());
describe('resumable upload recovery', () => {
  it('queries the committed offset after a lost chunk response', async () => {
    loseResponse = true;
    await publishWork('token', 1, form(), new AbortController().signal, vi.fn());
    expect(offsets).toHaveLength(8);
    expect(offsets[0]).toBe(0); expect(offsets[1]).toBe(2 * 1024 * 1024);
    expect(completions).toBe(1);
  });
  it('resumes the same persisted session after pause and reselect', async () => {
    pause = new AbortController();
    await expect(publishWork('token', 1, form(), pause.signal, vi.fn())).rejects.toMatchObject({ name: 'AbortError' });
    expect(offset).toBe(2 * 1024 * 1024);
    await publishWork('token', 1, form(), new AbortController().signal, vi.fn());
    expect(started).toBe(1); expect(completions).toBe(1); expect(offset).toBe(file.size);
  });
  it('cancels a saved server session', async () => {
    pause = new AbortController();
    await expect(publishWork('token', 1, form(), pause.signal, vi.fn())).rejects.toMatchObject({ name: 'AbortError' });
    await cancelUpload('token', 1, file, 'music');
    await publishWork('token', 1, form(), new AbortController().signal, vi.fn());
    expect(started).toBe(2);
  });
});
