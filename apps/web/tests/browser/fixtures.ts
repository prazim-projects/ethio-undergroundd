import type { Page } from '@playwright/test';

export const artist = { id: '1', publicId: 'audit-artist', username: 'audit', displayName: 'Addis Sessions', profileType: 'creator', bio: 'Independent sounds from Addis Ababa.', location: 'Addis Ababa, ET', disciplines: ['music'], avatar: '' };
export const works = [
  { id: '1', title: 'Midnight in Addis', file: 'works/addis.wav', workType: 'MUSIC' },
  { id: '2', title: 'Bati After Hours', file: 'works/bati.wav', workType: 'MUSIC' },
  { id: '3', title: 'Sunday in Piassa', file: 'works/piassa.wav', workType: 'MUSIC' },
  { id: '4', title: 'Aster / Live Session', file: 'works/aster.wav', workType: 'MUSIC' },
  { id: '5', title: 'A Small Poem', file: 'works/poem.txt', workType: 'POETRY' },
  { id: '6', title: 'Visual Art Portfolio', file: 'works/portfolio.pdf', workType: 'VISUAL_ART' },
].map((work) => ({ ...work, description: 'Audit fixture, not a real release.', thumbnail: '', isPayable: false, priceEtb: '0.00', playCount: 10, downloadCount: 0, creator: artist }));

function silentWav() {
  const dataSize = 8000 * 2 * 20;
  const b = Buffer.alloc(44 + dataSize);
  b.write('RIFF'); b.writeUInt32LE(36 + dataSize, 4); b.write('WAVE', 8); b.write('fmt ', 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(8000, 24); b.writeUInt32LE(16000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(dataSize, 40);
  return b;
}

export async function mockCatalog(page: Page) {
  const counts = new Map<string, number>();
  await page.route('**/graphql/', async (route) => {
    const body = route.request().postDataJSON();
    const variables = body.variables || {};
    const filtered = works.filter((work) => (!variables.workType || work.workType.toLowerCase() === variables.workType) && (!variables.query || `${work.title} ${artist.displayName}`.toLowerCase().includes(variables.query.toLowerCase())));
    const data = body.query.includes('query Work(') ? { getWork: works.find((w) => w.id === variables.id) || null } : body.query.includes('getCreatorQuery') ? { getCreator: { ...artist, works } } : { popularCreatives: [artist], loadPopularWorks: filtered.slice(0, 4), searchWorks: filtered };
    await route.fulfill({ json: { data }, headers: { 'Access-Control-Allow-Origin': '*' } });
  });
  await page.route('**/works/*/play/', async (route) => {
    const id = route.request().url().split('/').at(-3)!;
    counts.set(id, (counts.get(id) || 0) + 1);
    await route.fulfill({ json: { playCount: 10 + counts.get(id)!, downloadCount: 0 }, headers: { 'Access-Control-Allow-Origin': '*' } });
  });
  await page.route('**/works/*/stream/', async (route) => {
    const id = route.request().url().split('/').at(-3);
    const headers = { 'Access-Control-Allow-Origin': '*' };
    if (id === '5') await route.fulfill({ contentType: 'text/plain; charset=utf-8', body: '<script>window.previewInjected=true</script>\nA small poem from Addis.', headers });
    else if (id === '6') await route.fulfill({ contentType: 'application/pdf', body: '%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF', headers });
    else await route.fulfill({ contentType: 'audio/wav', body: silentWav(), headers });
  });
  return counts;
}
