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
const saving = new Set<string>();
export async function saveOffline(owner: number, work: CreativeWork): Promise<void> {
  const scope = await namespace(owner);
  const key = `${scope}/${workId(work.id)}`;
  if (saving.has(key)) throw new Error("This download is already in progress.");
  saving.add(key);
  try {
    const previous = await getEntry(owner, work.id);
    const entry: OfflineEntry = { key, namespace: scope, work: JSON.parse(JSON.stringify(work)), size: 0, savedAt: new Date().toISOString() };
    if (native) {
      await Filesystem.mkdir({ directory: Directory.Data, path: scope, recursive: true }).catch((error) => {
        if (!/exist/i.test(String(error.message))) throw error;
      });
      const extension = /\.(mp3|m4a|aac|ogg|wav|mp4|mov|webm|gif|jpe?g|png|webp|pdf|txt)$/i.exec(work.file)?.[1] ?? "bin";
      const path = `${key}-${crypto.randomUUID()}.${extension}`;
      const partial = `${path}.part`;
      try {
        const destination = await Filesystem.getUri({ directory: Directory.Data, path: partial });
        await FileTransfer.downloadFile({ url: workDownloadUrl(work.id)!, path: destination.uri });
        const stat = await Filesystem.stat({ directory: Directory.Data, path: partial });
        entry.size = stat.size;
        entry.path = path;
        await Filesystem.rename({ directory: Directory.Data, from: partial, to: path });
        await Filesystem.writeFile({ directory: Directory.Data, path: `${key}.json`, data: JSON.stringify(entry), encoding: Encoding.UTF8 });
      } catch (error) {
        await Filesystem.deleteFile({ directory: Directory.Data, path: partial }).catch(() => {});
        await Filesystem.deleteFile({ directory: Directory.Data, path }).catch(() => {});
        throw error;
      }
      if (previous?.path) await Filesystem.deleteFile({ directory: Directory.Data, path: previous.path }).catch(() => {});
    } else {
      const response = await fetch(workDownloadUrl(work.id)!, { cache: "no-store" });
      if (!response.ok) throw new Error("This work could not be downloaded.");
      const blob = await response.blob();
      entry.size = blob.size;
      await write(entry, blob);
      // Ask the browser to protect this explicit download from automatic eviction.
      await navigator.storage?.persist?.().catch(() => false);
    }
    window.dispatchEvent(new Event("offline-library-changed"));
  } finally { saving.delete(key); }
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
  return entries.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export async function removeOffline(owner: number, id: string) {
  const entry = await getEntry(owner, id);
  if (!entry) return;
  if (native) {
    if (entry.path) await Filesystem.deleteFile({ directory: Directory.Data, path: entry.path }).catch((error) => { if (!isMissing(error)) throw error; });
    await Filesystem.deleteFile({ directory: Directory.Data, path: `${entry.key}.json` });
  } else await write(entry, undefined, true);
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
  const blob = await read<Blob | undefined>("files", entry.key);
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  return { url, release: () => URL.revokeObjectURL(url) };
}
