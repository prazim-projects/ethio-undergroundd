import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { clearManagedWorksCache, queryGraphQL } from '../../src/lib/graphql';
import { clearQueries, readQuery, writeQuery } from '../../src/lib/query-cache';

class Storage {
  getItem(key: string) { return typeof this[key] === 'string' ? this[key] : null; }
  setItem(key: string, value: string) { this[key] = String(value); }
  removeItem(key: string) { delete this[key]; }
}
beforeEach(() => { vi.stubGlobal('localStorage', new Storage()); vi.stubGlobal('navigator', { onLine: true }); });
afterEach(() => { clearManagedWorksCache(); vi.unstubAllGlobals(); vi.useRealTimers(); });
const query = 'query PopularCatalog { searchWorks { id } }';
const reply = (data: unknown) => ({ ok: true, json: async () => ({ data }) });

it('deduplicates identical catalog requests and persists independent editable copies', async () => {
  const fetcher = vi.fn(async () => reply({ searchWorks: [{ id: '1' }] })); vi.stubGlobal('fetch', fetcher);
  const [a, b] = await Promise.all([queryGraphQL<any>(query), queryGraphQL<any>(query)]);
  expect(fetcher).toHaveBeenCalledTimes(1);
  a.searchWorks[0].id = 'unsaved';
  expect(b.searchWorks[0].id).toBe('1');
  expect((await queryGraphQL<any>(query)).searchWorks[0].id).toBe('1');
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(Object.keys(localStorage).some((key) => key.startsWith('underground_query_v1:public:'))).toBe(true);
  await queryGraphQL(query, undefined, true);
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it('never persists errors and can retry immediately', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ errors: [{ message: 'Temporary failure' }] }) }).mockResolvedValue(reply({ searchWorks: [] }));
  vi.stubGlobal('fetch', fetcher);
  await expect(queryGraphQL(query)).rejects.toThrow('Temporary failure');
  await expect(queryGraphQL(query)).resolves.toEqual({ searchWorks: [] });
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it('uses bounded previous successful results when offline, with TTL and invalidation', async () => {
  vi.useFakeTimers();
  const fetcher = vi.fn().mockResolvedValueOnce(reply({ searchWorks: [{ id: 'offline' }] })).mockRejectedValue(new Error('Offline'));
  vi.stubGlobal('fetch', fetcher);
  await queryGraphQL(query);
  vi.advanceTimersByTime(60_001); vi.stubGlobal('navigator', { onLine: false });
  await expect(queryGraphQL(query)).resolves.toEqual({ searchWorks: [{ id: 'offline' }] });
  clearManagedWorksCache();
  await expect(queryGraphQL(query)).rejects.toThrow('Offline');
});
it('caps cache entries and ignores private or unknown operations', async () => {
  for (let index = 0; index < 30; index++) writeQuery('public:' + index, { index });
  expect(Object.keys(localStorage).length).toBeLessThanOrEqual(24);
  expect(readQuery('public:29')).toEqual({ index: 29 });
  clearQueries();
  vi.stubGlobal('fetch', vi.fn(async () => reply({ currentCreator: { email: 'private' } })));
  await queryGraphQL('query Private { currentCreator { email } }');
  expect(Object.keys(localStorage)).toHaveLength(0);
});
