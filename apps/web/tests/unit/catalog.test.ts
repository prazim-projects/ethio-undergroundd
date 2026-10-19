import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCatalog } from '../../src/composables/use-catalog';
import { queryGraphQL } from '../../src/lib/graphql';
vi.mock('../../src/lib/graphql', () => ({ queryGraphQL: vi.fn() }));
const query = vi.mocked(queryGraphQL);
const work = { id: '1', title: 'Track', file: 'track.mp3', playCount: 10, downloadCount: 0 };
const response = (title: string) => ({ popularCreatives: [], loadPopularWorks: [], searchWorks: [{ ...work, title }] });

describe('catalog state', () => {
  beforeEach(() => query.mockReset());
  it('shows all search results even without a search term', async () => {
    query.mockResolvedValue(response('Unfiltered'));
    const catalog = useCatalog(); await catalog.load();
    expect(catalog.works.value[0].title).toBe('Unfiltered');
  });
  it('ignores an older response that finishes after the newer search', async () => {
    let resolveOld!: (value: unknown) => void;
    query.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }));
    query.mockResolvedValueOnce(response('Latest'));
    const catalog = useCatalog();
    const old = catalog.load('old'); await catalog.load('latest');
    resolveOld(response('Stale')); await old;
    expect(catalog.works.value[0].title).toBe('Latest');
    expect(catalog.loading.value).toBe(false);
  });
  it('fetches a shared release outside the top catalog', async () => {
    query.mockResolvedValue({ getWork: work });
    const catalog = useCatalog(); await catalog.loadWork('1');
    expect(catalog.selectedWork.value?.id).toBe('1');
  });
  it('does not roll counts backward when responses arrive out of order', async () => {
    query.mockResolvedValue(response('Track'));
    const catalog = useCatalog(); await catalog.load();
    catalog.updateStats('1', { playCount: 12, downloadCount: 2 });
    catalog.updateStats('1', { playCount: 11, downloadCount: 1 });
    expect(catalog.works.value[0].playCount).toBe(12);
    expect(catalog.works.value[0].downloadCount).toBe(2);
  });
});
