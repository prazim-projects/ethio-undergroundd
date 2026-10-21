import { afterEach, expect, it, vi } from 'vitest';
import { fetchMutation } from '../../src/lib/mutations';
afterEach(() => vi.unstubAllGlobals());
it('retries a lost mutation response using the same idempotency key and body', async () => {
  const body = new FormData(); body.set('title', 'Once');
  const fetcher = vi.fn().mockRejectedValueOnce(new Error('Connection lost')).mockResolvedValue(new Response('{}'));
  vi.stubGlobal('fetch', fetcher);
  await fetchMutation('https://example.test/works/upload/', { method: 'POST', body }, body);
  expect(fetcher).toHaveBeenCalledTimes(2);
  const first = fetcher.mock.calls[0][1]; const retry = fetcher.mock.calls[1][1];
  expect(first.headers.get('Idempotency-Key')).toBeTruthy();
  expect(retry.headers.get('Idempotency-Key')).toBe(first.headers.get('Idempotency-Key'));
  expect(retry.body).toBe(body);
});
it('does not retry validation or authentication failures', async () => {
  const fetcher = vi.fn(async () => new Response('{}', { status: 400 })); vi.stubGlobal('fetch', fetcher);
  expect((await fetchMutation('https://example.test/', { method: 'POST' }, {})).status).toBe(400);
  expect(fetcher).toHaveBeenCalledTimes(1);
});
