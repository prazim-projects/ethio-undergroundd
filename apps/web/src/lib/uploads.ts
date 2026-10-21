import { API_ORIGIN, clearManagedWorksCache } from "./graphql";
import { compressImage } from "./images";
import { cacheKey } from './query-cache';

type Session = { id: string; offset: number; size: number; chunkSize: number; workId?: number };
class UploadError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

function send(token: string, method: string, path: string, body: FormData | Blob | string | null,
  signal: AbortSignal, headers: Record<string, string> = {}, progress?: (loaded: number, total: number) => void): Promise<any> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const xhr = new XMLHttpRequest();
    xhr.open(method, `${API_ORIGIN}${path}`);
    xhr.timeout = 120_000;
    xhr.setRequestHeader("Authorization", `Token ${token}`);
    for (const [key, value] of Object.entries(headers)) xhr.setRequestHeader(key, value);
    const abort = () => xhr.abort();
    signal.addEventListener("abort", abort, { once: true });
    xhr.onloadend = () => signal.removeEventListener("abort", abort);
    xhr.upload.onprogress = (event) => { if (event.lengthComputable) progress?.(event.loaded, event.total); };
    xhr.onload = () => {
      let payload;
      try { payload = JSON.parse(xhr.responseText); }
      catch { reject(new UploadError("The server returned an invalid upload response.", xhr.status)); return; }
      if (xhr.status >= 200 && xhr.status < 300) resolve(payload);
      else reject(new UploadError(payload.error || "Upload failed", xhr.status));
    };
    xhr.onerror = () => reject(new UploadError("Connection lost. Retry to resume this upload.", 0));
    xhr.ontimeout = () => reject(new UploadError("Upload timed out. Retry to resume.", 0));
    xhr.onabort = () => reject(new DOMException("Upload paused", "AbortError"));
    xhr.send(body);
  });
}

async function fileKey(owner: number, file: File, workType: string) {
  // Sample without loading a large media file into memory. Reselect the same original file to resume.
  const sampleSize = 64 * 1024;
  const samples = new Blob([file.slice(0, sampleSize), file.slice(Math.floor(file.size / 2), Math.floor(file.size / 2) + sampleSize), file.slice(-sampleSize),
    `${API_ORIGIN}:${file.name}:${file.size}:${file.lastModified}:${workType}`]);
  const digest = await crypto.subtle.digest("SHA-256", await samples.arrayBuffer());
  return `underground_upload:${owner}:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

const canRetry = (error: unknown) => error instanceof UploadError && (error.status === 0 || error.status === 409 || error.status >= 500);
function storedId(key: string) { try { return localStorage.getItem(key); } catch { return null; } }
function storeId(key: string, id: string) { try { localStorage.setItem(key, id); } catch { /* Upload works without cross-reload recovery. */ } }
function forgetId(key: string) { try { localStorage.removeItem(key); } catch { /* Storage may be unavailable. */ } }

export async function cancelUpload(token: string, owner: number, file: File, workType: string) {
  const key = await fileKey(owner, file, workType);
  const id = storedId(key);
  if (id) await send(token, "DELETE", `/works/uploads/${encodeURIComponent(id)}/`, null, new AbortController().signal);
  forgetId(key);
}

export async function publishWork(token: string, owner: number, form: FormData, signal: AbortSignal, onProgress: (value: number) => void) {
  const original = form.get("file") as File;
  const metadata = JSON.stringify([...form.entries()].map(([name, value]) => [name, value instanceof File ? [value.name, value.size, value.lastModified] : value]));
  const requestKey = `${await fileKey(owner, original, String(form.get('workType')))}:request:${await cacheKey(metadata)}`;
  form.set("file", await compressImage(original));
  const cover = form.get("thumbnail");
  if (cover instanceof File) form.set("thumbnail", await compressImage(cover, 1024));
  signal.throwIfAborted();
  if (original.size < 16 * 1024 * 1024 || !/\.(mp3|m4a|aac|ogg|wav|mp4|mov|webm)$/i.test(original.name)) {
    const key = storedId(requestKey) || crypto.randomUUID();
    storeId(requestKey, key);
    for (let attempt = 0; ; attempt++) {
      try {
        await send(token, "POST", "/works/upload/", form, signal, { 'Idempotency-Key': key }, (loaded, total) => onProgress(Math.min(99, Math.round(loaded / total * 100))));
        break;
      } catch (error) { if (!canRetry(error) || attempt >= 2) throw error; }
    }
    forgetId(requestKey);
  } else {
    const workType = String(form.get("workType"));
    const key = await fileKey(owner, original, workType);
    const id = storedId(key);
    let session: Session | undefined;
    if (id) {
      try { session = await send(token, "GET", `/works/uploads/${encodeURIComponent(id)}/`, null, signal); }
      catch (error) {
        if (!(error instanceof UploadError) || ![404, 410].includes(error.status)) throw error;
        forgetId(key);
      }
    }
    if (!session) {
      session = await send(token, "POST", "/works/uploads/", JSON.stringify({
        filename: original.name, size: original.size, contentType: original.type, workType,
      }), signal, { "Content-Type": "application/json" });
      storeId(key, session!.id);
    }
    const path = `/works/uploads/${session!.id}/`;
    let retries = 0;
    while (!session!.workId && session!.offset < original.size) {
      signal.throwIfAborted();
      const offset = session!.offset;
      const chunk = original.slice(offset, offset + session!.chunkSize);
      try {
        session = await send(token, "PATCH", path, chunk, signal, {
          "Content-Type": "application/octet-stream", "Upload-Offset": String(offset),
        }, (loaded) => onProgress(Math.min(99, Math.round((offset + loaded) / original.size * 100))));
        retries = 0;
      } catch (error) {
        if (!canRetry(error) || retries++ >= 3) throw error;
        // The server may have committed a chunk whose response was lost.
        session = await send(token, "GET", path, null, signal);
      }
      onProgress(Math.min(99, Math.round(session!.offset / original.size * 100)));
    }
    if (!session!.workId) {
      const metadata = new FormData();
      form.forEach((value, field) => { if (field !== "file") metadata.append(field, value); });
      for (let attempt = 0; ; attempt++) {
        try { await send(token, "POST", path, metadata, signal); break; }
        catch (error) { if (!canRetry(error) || attempt >= 3) throw error; }
      }
    }
    forgetId(key);
  }
  clearManagedWorksCache();
  onProgress(100);
}
