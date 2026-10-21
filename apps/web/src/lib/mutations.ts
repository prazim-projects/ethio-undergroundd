// A failed attempt keeps its key; a successful one releases it. No token is persisted.
const keys = new WeakMap<object, string>();
export function mutationKey(input: object) {
  let key = keys.get(input);
  if (!key) { key = crypto.randomUUID(); keys.set(input, key); }
  return key;
}
export function completeMutation(input: object) { keys.delete(input); }
export async function fetchMutation(url: string, options: RequestInit, input: object) {
  const headers = new Headers(options.headers);
  headers.set('Idempotency-Key', mutationKey(input));
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetch(url, { ...options, headers });
      if (!(response.status >= 500) || attempt >= 2) return response;
      await response.body?.cancel().catch(() => {});
    } catch (error) { if (attempt >= 2 || options.signal?.aborted) throw error; }
    await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)));
  }
}
