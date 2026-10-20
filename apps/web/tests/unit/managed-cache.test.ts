import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearManagedWorksCache, listMyWorks, updateWorkSettings } from '../../src/lib/graphql';
const payload = (title = 'Saved') => ({ works: [{ id: 1, title }], page: 1, pageSize: 20, total: 1, hasMore: false });
const reply = (value: unknown) => ({ ok: true, json: async () => value });
afterEach(() => { clearManagedWorksCache(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('private managed catalog cache', () => {
  it('deduplicates requests, scopes by account/page, and returns editable copies', async () => {
    const fetcher = vi.fn(async () => reply(payload())); vi.stubGlobal('fetch', fetcher);
    const [first, second] = await Promise.all([listMyWorks('alice'), listMyWorks('alice')]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    first.works[0].title = 'Unsaved edit';
    expect(second.works[0].title).toBe('Saved');
    expect((await listMyWorks('alice')).works[0].title).toBe('Saved');
    await listMyWorks('bob'); await listMyWorks('alice', 2);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(fetcher.mock.calls[2][0]).toContain('page=2&pageSize=20');
  });
  it('expires and supports explicit refresh', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn(async () => reply(payload())); vi.stubGlobal('fetch', fetcher);
    await listMyWorks('alice'); await listMyWorks('alice');
    vi.advanceTimersByTime(60_001); await listMyWorks('alice');
    await listMyWorks('alice', 1, true);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it('invalidates all pages after saving work settings', async () => {
    const fetcher = vi.fn(async () => reply(payload())); vi.stubGlobal('fetch', fetcher);
    await listMyWorks('alice');
    await updateWorkSettings('alice', 1, { title: 'New', description: '', published: true, isPayable: false, priceEtb: '0' });
    await listMyWorks('alice');
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it('does not let a pre-logout response repopulate the cache', async () => {
    let finish!: (value: unknown) => void;
    const fetcher = vi.fn().mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }))
      .mockResolvedValue(reply(payload('Fresh')));
    vi.stubGlobal('fetch', fetcher);
    const pending = listMyWorks('alice'); clearManagedWorksCache();
    finish(reply(payload('Stale'))); await pending;
    expect((await listMyWorks('alice')).works[0].title).toBe('Fresh');
  });
});
