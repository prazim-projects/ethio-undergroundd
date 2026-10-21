import { Capacitor } from "@capacitor/core";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { FileTransfer } from "@capacitor/file-transfer";
import { API_ORIGIN, workDownloadUrl } from "./graphql";
import type { CreativeWork } from "../composables/use-catalog";

export interface OfflineEntry {
  key: string;
  namespace: string;
  work: CreativeWork;
  size: number;
  savedAt: string;
  path?: string;
  opfs?: string;
  contentType?: string;
}
const native = Capacitor.isNativePlatform();
let database: Promise<IDBDatabase> | undefined;
function db() {
  return database ??= new Promise((resolve, reject) => {
    const request = indexedDB.open("underground-private-downloads", 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("entries", { keyPath: "key" });
      request.result.createObjectStore("files");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { database = undefined; reject(request.error); };
  });
}
async function read<T>(store: string, key?: string): Promise<T> {
  const connection = await db();
  return new Promise((resolve, reject) => {
    const transaction = connection.transaction(store);
    const request = key === undefined ? transaction.objectStore(store).getAll() : transaction.objectStore(store).get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function write(entry: OfflineEntry, blob?: Blob, remove = false) {
  const connection = await db();
  return new Promise<void>((resolve, reject) => {
    const transaction = connection.transaction(["entries", "files"], "readwrite");
    if (remove) {
      transaction.objectStore("entries").delete(entry.key);
      transaction.objectStore("files").delete(entry.key);
    } else {
      transaction.objectStore("entries").put(entry);
      transaction.objectStore("files").put(blob, entry.key);
    }
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error("Device storage is full or unavailable."));
    transaction.onerror = () => reject(transaction.error);
  });
}
async function namespace(owner: number) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${API_ORIGIN}:${owner}`));
  return `offline/${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}
function workId(id: string) {
  if (!/^\d+$/.test(id)) throw new Error("Invalid work ID.");
  return id;
}
async function getEntry(owner: number, id: string): Promise<OfflineEntry | undefined> {
  const scope = await namespace(owner);
  const key = `${scope}/${workId(id)}`;
  if (!native) return read<OfflineEntry | undefined>("entries", key);
  try {
    const result = await Filesystem.readFile({ directory: Directory.Data, path: `${key}.json`, encoding: Encoding.UTF8 });
    return JSON.parse(String(result.data));
  } catch (error) {
    if (isMissing(error)) return undefined;
    throw error;
  }
}
function isMissing(error: unknown) {
  return /not exist|not found|ENOENT|OS-PLUG-FILE-0008/i.test(String((error as { message?: string })?.message ?? error));
}
const saving = new Map<string, Promise<void>>();
const listeners = new Map<string, Set<(percent: number | null) => void>>();
const indexKey = (owner: number) => `underground_offline_index:${API_ORIGIN}:${owner}`;
export function isSavedOffline(owner: number, id: string) {
  try { return (JSON.parse(localStorage.getItem(indexKey(owner)) || '[]') as string[]).includes(id); } catch { return false; }
}
function remember(owner: number, ids: string[]) { try { localStorage.setItem(indexKey(owner), JSON.stringify(ids)); } catch { /* Optional fast lookup. */ } }
function markSaved(owner: number, id: string) {
  try { remember(owner, [...new Set([...JSON.parse(localStorage.getItem(indexKey(owner)) || '[]'), id])]); } catch { /* Optional index. */ }
}
export async function saveOffline(owner: number, work: CreativeWork, progress?: (percent: number | null) => void): Promise<void> {
  const key = `${API_ORIGIN}:${owner}:${workId(work.id)}`;
  const observers = listeners.get(key) ?? new Set();
  if (progress) observers.add(progress);
  listeners.set(key, observers);
  let pending = saving.get(key);
  if (!pending) {
    pending = downloadOffline(owner, work, (percent) => { for (const listener of observers) listener(percent); });
    saving.set(key, pending);
  }
  try { await pending; }
  finally {
    if (progress) observers.delete(progress);
    if (saving.get(key) === pending) { saving.delete(key); listeners.delete(key); }
  }
}
async function downloadOffline(owner: number, work: CreativeWork, progress: (percent: number | null) => void): Promise<void> {
  const scope = await namespace(owner);
  const key = `${scope}/${workId(work.id)}`;
  const previous = await getEntry(owner, work.id);
  if (previous && previous.work.file === work.file) {
    const source = await offlineSource(owner, work.id).catch(() => undefined);
    if (source) { source.release(); markSaved(owner, work.id); progress(100); return; }
  }
  progress(null);
  const entry: OfflineEntry = { key, namespace: scope, work: JSON.parse(JSON.stringify(work)), size: 0, savedAt: new Date().toISOString() };
  if (native) {
    await Filesystem.mkdir({ directory: Directory.Data, path: scope, recursive: true }).catch((error) => {
      if (!/exist/i.test(String(error.message))) throw error;
    });
    const extension = /\.(mp3|m4a|aac|ogg|wav|mp4|mov|webm|gif|jpe?g|png|webp|pdf|txt)$/i.exec(work.file)?.[1] ?? "bin";
    const path = `${key}-${crypto.randomUUID()}.${extension}`;
    const partial = `${path}.part`;
    const listener = await FileTransfer.addListener('progress', (event) => {
      if (event.url === workDownloadUrl(work.id)) progress(event.lengthComputable && event.contentLength ? Math.min(99, Math.round(event.bytes / event.contentLength * 100)) : null);
    });
    try {
      const destination = await Filesystem.getUri({ directory: Directory.Data, path: partial });
      await FileTransfer.downloadFile({ url: workDownloadUrl(work.id)!, path: destination.uri, progress: true });
      const stat = await Filesystem.stat({ directory: Directory.Data, path: partial });
      entry.size = stat.size;
      entry.path = path;
      await Filesystem.rename({ directory: Directory.Data, from: partial, to: path });
      await Filesystem.writeFile({ directory: Directory.Data, path: `${key}.json`, data: JSON.stringify(entry), encoding: Encoding.UTF8 });
    } catch (error) {
      await Filesystem.deleteFile({ directory: Directory.Data, path: partial }).catch(() => {});
      await Filesystem.deleteFile({ directory: Directory.Data, path }).catch(() => {});
      throw error;
    } finally { await listener.remove(); }
    if (previous?.path) await Filesystem.deleteFile({ directory: Directory.Data, path: previous.path }).catch(() => {});
  } else {
    const response = await fetch(workDownloadUrl(work.id)!);
    if (!response.ok) throw new Error("This work could not be downloaded.");
    entry.contentType = response.headers.get('Content-Type') || 'application/octet-stream';
    const total = response.headers.get('Content-Encoding') ? 0 : Number(response.headers.get('Content-Length'));
    // Stream directly to private browser storage when available. This avoids
    // retaining an entire large audio/video file in JavaScript memory.
    let root: FileSystemDirectoryHandle | undefined;
    let file: FileSystemFileHandle | undefined;
    let writable: FileSystemWritableFileStream | undefined;
    try {
      if (navigator.storage?.getDirectory) {
        root = await navigator.storage.getDirectory();
        entry.opfs = `${scope.replace('/', '-')}-${work.id}-${crypto.randomUUID()}`;
        file = await root.getFileHandle(entry.opfs, { create: true });
        if ('createWritable' in file) writable = await file.createWritable();
      }
    } catch { /* IndexedDB is the fallback when OPFS is unavailable. */ }
    if (!writable && entry.opfs) {
      await root?.removeEntry(entry.opfs).catch(() => {}); delete entry.opfs;
    }
    const parts: Uint8Array[] = [];
    try {
      if (response.body) {
        const reader = response.body.getReader();
        try {
          while (true) {
            const { value, done } = await reader.read(); if (done) break;
            entry.size += value.byteLength;
            if (writable) await writable.write(value); else parts.push(value);
            progress(total ? Math.min(99, Math.round(entry.size / total * 100)) : null);
          }
        } catch (error) { await reader.cancel().catch(() => {}); throw error; }
        finally { reader.releaseLock(); }
      } else {
        const value = new Uint8Array(await response.arrayBuffer()); entry.size = value.byteLength;
        if (writable) await writable.write(value); else parts.push(value);
      }
      if (total && entry.size !== total) throw new Error('Download was interrupted. Please retry.');
      if (writable) await writable.close();
      await write(entry, writable ? undefined : new Blob(parts, { type: entry.contentType }));
    } catch (error) {
      await writable?.abort().catch(() => {});
      if (entry.opfs) await root?.removeEntry(entry.opfs).catch(() => {});
      throw error;
    }
    if (previous?.opfs) await root?.removeEntry(previous.opfs).catch(() => {});
    // Ask the browser to protect this explicit download from automatic eviction.
    void navigator.storage?.persist?.().catch(() => false);
  }
  markSaved(owner, work.id);
  progress(100);
  window.dispatchEvent(new Event("offline-library-changed"));
}

export async function listOffline(owner: number): Promise<OfflineEntry[]> {
  const scope = await namespace(owner);
  let entries: OfflineEntry[];
  if (!native) entries = (await read<OfflineEntry[]>("entries")).filter((entry) => entry.namespace === scope);
  else {
    try {
      const listing = await Filesystem.readdir({ directory: Directory.Data, path: scope });
      entries = await Promise.all(listing.files.filter((file) => /^\d+\.json$/.test(file.name)).map(async (file) => {
        const data = await Filesystem.readFile({ directory: Directory.Data, path: `${scope}/${file.name}`, encoding: Encoding.UTF8 });
        return JSON.parse(String(data.data)) as OfflineEntry;
      }));
    } catch (error) { if (isMissing(error)) return []; throw error; }
  }
  remember(owner, entries.map((entry) => entry.work.id));
  return entries.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export async function removeOffline(owner: number, id: string) {
  const entry = await getEntry(owner, id);
  if (!entry) return;
  if (native) {
    if (entry.path) await Filesystem.deleteFile({ directory: Directory.Data, path: entry.path }).catch((error) => { if (!isMissing(error)) throw error; });
    await Filesystem.deleteFile({ directory: Directory.Data, path: `${entry.key}.json` });
  } else {
    if (entry.opfs) {
      const root = await navigator.storage.getDirectory();
      await root.removeEntry(entry.opfs).catch((error) => { if (error.name !== 'NotFoundError') throw error; });
    }
    await write(entry, undefined, true);
  }
  try { remember(owner, JSON.parse(localStorage.getItem(indexKey(owner)) || '[]').filter((value: string) => value !== id)); } catch { /* Optional index. */ }
  window.dispatchEvent(new Event("offline-library-changed"));
}

export async function offlineSource(owner: number, id: string): Promise<{ url: string; release: () => void } | undefined> {
  const entry = await getEntry(owner, id);
  if (!entry) return;
  if (native && entry.path) {
    await Filesystem.stat({ directory: Directory.Data, path: entry.path });
    const file = await Filesystem.getUri({ directory: Directory.Data, path: entry.path });
    return { url: Capacitor.convertFileSrc(file.uri), release: () => {} };
  }
  const blob = entry.opfs ? new Blob([await (await (await navigator.storage.getDirectory()).getFileHandle(entry.opfs)).getFile()], { type: entry.contentType || 'application/octet-stream' }) : await read<Blob | undefined>("files", entry.key);
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  return { url, release: () => URL.revokeObjectURL(url) };
}
