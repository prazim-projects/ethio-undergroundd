import { describe, expect, it } from 'vitest';
import { DEFAULT_API_URL, DEFAULT_FRONTEND_URL, resolveDeployment } from '../../config/deployment';

describe('deployment configuration', () => {
  it('uses the configured public hosts for production and native defaults', () => {
    expect(resolveDeployment({}, true)).toEqual({ apiUrl: DEFAULT_API_URL, frontendUrl: DEFAULT_FRONTEND_URL.replace(/\/$/, '') });
    expect(resolveDeployment({ MODE: 'development' }).apiUrl).toBe('https://127.0.0.1:8000/graphql/');
  });
  it('supports moving both hosts without changing request or sharing code', () => {
    expect(resolveDeployment({ VITE_API_URL: 'https://api.new-host.example/v2/graphql', VITE_FRONTEND_URL: 'https://new-host.example/' }, true))
      .toEqual({ apiUrl: 'https://api.new-host.example/v2/graphql/', frontendUrl: 'https://new-host.example' });
  });
  it.each([
    { VITE_API_URL: 'http://api.example/graphql/' },
    { VITE_FRONTEND_URL: 'http://app.example/' },
    { VITE_API_URL: 'https://api.example/wrong/' },
    { VITE_API_URL: 'https://api.example/graphql/?token=secret' },
    { VITE_FRONTEND_URL: 'https://user:secret@app.example/' },
  ])('rejects invalid native configuration: %j', (env) => expect(() => resolveDeployment(env, true)).toThrow());
});
