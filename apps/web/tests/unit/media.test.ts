import { describe, it, expect } from 'vitest';
import { mediaKind, formatTime, nextIndex } from '../../src/lib/media';

describe('media classification', () => {
  it.each([
    ['portfolio.PDF?token=abc', 'pdf'], ['poem.txt#page=2', 'text'],
    ['art.jpeg', 'image'], ['other.mp3', 'audio'], ['film.mov', 'video'],
    ['/works/1/stream/', 'file'], ['file.exe', 'file'], ['', 'file'],
  ])('classifies %s by the actual file extension', (file, kind) => expect(mediaKind(file)).toBe(kind));
});
describe('player boundaries', () => {
  it.each([[0, '0:00'], [65.8, '1:05'], [NaN, '0:00'], [Infinity, '0:00'], [-1, '0:00']])('formats %s', (time, label) => expect(formatTime(time)).toBe(label));
  it('wraps forward and backward without invalid indices', () => {
    expect(nextIndex(3, 4)).toBe(0);
    expect(nextIndex(0, 4, -1)).toBe(3);
    expect(nextIndex(0, 0)).toBe(-1);
    expect(nextIndex(0, 1)).toBe(0);
  });
});
