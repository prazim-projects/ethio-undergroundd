// Public deployment defaults. Override with VITE_API_URL / VITE_FRONTEND_URL when moving hosts.
export const DEFAULT_API_URL = 'https://prasim.pythonanywhere.com/graphql/';
export const DEFAULT_FRONTEND_URL = 'https://ethio-underground.vercel.app/';
export const VITE_API_URL = DEFAULT_API_URL;
export function resolveDeployment(env: { VITE_API_URL?: string; VITE_FRONTEND_URL?: string; MODE?: string }, native = false) {
  const local = env.MODE === 'development' || env.MODE === 'test';
  const api = new URL(env.VITE_API_URL || (local ? 'https://127.0.0.1:8000/graphql/' : DEFAULT_API_URL));
  const frontend = new URL(env.VITE_FRONTEND_URL || DEFAULT_FRONTEND_URL);
  for (const [label, url] of [['API', api], ['frontend', frontend]] as const) {
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
      throw new Error(`The ${label} URL must be an HTTP(S) URL without credentials, query or fragment.`);
    }
    if (native && url.protocol !== 'https:') throw new Error(`Native builds require an HTTPS ${label} URL.`);
  }
  if (!/\/graphql\/?$/.test(api.pathname)) throw new Error('VITE_API_URL must end in /graphql/.');
  return { apiUrl: `${api.href.replace(/\/$/, '')}/`, frontendUrl: frontend.href.replace(/\/$/, '') };
}
