export type MediaKind = "audio" | "video" | "image" | "pdf" | "text" | "file";

export function mediaKind(file: string): MediaKind {
  const path = file.split(/[?#]/)[0].toLowerCase();
  if (/\.(mp3|m4a|aac|ogg|wav|flac)$/.test(path)) return "audio";
  if (/\.(mp4|webm|mov|ogv)$/.test(path)) return "video";
  if (/\.(jpg|jpeg|png|webp|gif|avif)$/.test(path)) return "image";
  if (/\.pdf$/.test(path)) return "pdf";
  if (/\.txt$/.test(path)) return "text";
  return "file";
}

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

export function nextIndex(index: number, length: number, direction = 1): number {
  return length ? (index + direction + length) % length : -1;
}
