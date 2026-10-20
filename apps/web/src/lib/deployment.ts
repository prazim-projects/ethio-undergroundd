import { resolveDeployment } from '../../config/deployment';

const deployment = resolveDeployment(import.meta.env);
export const API_URL = deployment.apiUrl;
export const FRONTEND_URL = deployment.frontendUrl;
const apk = new URL(import.meta.env.VITE_ANDROID_APK_URL || `${FRONTEND_URL}/downloads/ethio-underground.apk`, FRONTEND_URL);
if (!['https:', 'http:'].includes(apk.protocol) || apk.username || apk.password) throw new Error('VITE_ANDROID_APK_URL must be a public HTTP(S) download URL.');
export const ANDROID_APK_URL = apk.href;
export function publicWorkUrl(id: string) {
  return `${FRONTEND_URL}/works/work-${encodeURIComponent(id)}`;
}
