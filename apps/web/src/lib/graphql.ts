const API_URL = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000/graphql/";
export const API_ORIGIN = API_URL.replace(/\/graphql\/?$/, "");

export async function queryGraphQL<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`GraphQL request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as { data?: T; errors?: { message: string }[] };
  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message).join(", "));
  }

  if (!payload.data) {
    throw new Error("GraphQL returned no data");
  }

  return payload.data;
}

export function mediaUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http")) return path;
  if (path.startsWith("/")) return `${API_ORIGIN}${path}`;
  return `${API_ORIGIN}/${path.startsWith("media/") ? path : `media/${path}`}`;
}

export function workDownloadUrl(workId?: string | number | null): string | undefined {
  if (!workId) return undefined;
  return `${API_ORIGIN}/works/${workId}/download/`;
}

export function workStreamUrl(workId?: string | number | null): string | undefined {
  if (!workId) return undefined;
  return `${API_ORIGIN}/works/${workId}/stream/`;
}

export function creatorProfilePath(publicId: string): string {
  return `/creators/${encodeURIComponent(publicId)}`;
}

async function postEmpty<T>(path: string) {
  const response = await fetch(`${API_ORIGIN}${path}`, { method: "POST" });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "Request failed");
  return payload as T;
}

export function recordWorkPlay(workId: string | number) {
  return postEmpty<{ playCount: number; downloadCount: number }>(`/works/${workId}/play/`);
}

export function initiateTelebirrPayment(workId: string | number) {
  return postEmpty<{ provider: "telebirr"; checkoutUrl: string; amount: string; currency: "ETB" }>(`/works/${workId}/pay/`);
}

export function startFaydaSignIn() {
  return postEmpty<{ authorizationUrl: string }>("/auth/fayda/start/");
}

export interface SessionUser {
  id: number;
  username: string;
  email: string;
  displayName: string;
  profileType: "listener" | "creator";
  bio: string;
  location: string;
  disciplines: string[];
  avatar: string;
}

export interface AuthResponse {
  token: string;
  user: SessionUser;
}

async function postJson<T>(path: string, body: unknown, headers: Record<string, string> = {}) {
  const response = await fetch(`${API_ORIGIN}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "Request failed");
  return payload as T;
}

export interface SignUpPayload {
  displayName: string;
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  profileType: "listener" | "creator";
}

export const signUp = (payload: SignUpPayload) => postJson<AuthResponse>("/auth/sign-up/", payload);

export const signIn = (identifier: string, password: string) =>
  postJson<AuthResponse>("/auth/sign-in/", { identifier, password });

export const signInWithGoogle = (credential: string, clientId: string) =>
  postJson<AuthResponse>("/auth/google/", { credential }, { "X-Google-Client-Id": clientId });

export async function uploadWork(token: string, formData: FormData) {
  const response = await fetch(`${API_ORIGIN}/works/upload/`, {
    method: "POST",
    headers: { Authorization: `Token ${token}` },
    body: formData,
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "Upload failed");
  return payload as { id: number; title: string; workType: string; file: string };
}

export async function updateProfile(token: string, formData: FormData) {
  const response = await fetch(`${API_ORIGIN}/auth/profile/`, {
    method: "POST",
    headers: { Authorization: `Token ${token}` },
    body: formData,
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "Profile update failed");
  return payload as { user: SessionUser };
}

export interface ManagedWork {
  id: number;
  title: string;
  workType: string;
  description: string;
  file: string;
  thumbnail: string;
  published: boolean;
  isPayable: boolean;
  priceEtb: string;
  playCount: number;
  downloadCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkSettingsPayload {
  title: string;
  description: string;
  published: boolean;
  isPayable: boolean;
  priceEtb: string;
}

export async function listMyWorks(token: string) {
  const response = await fetch(`${API_ORIGIN}/works/mine/`, {
    headers: { Authorization: `Token ${token}` },
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "Unable to load creations");
  return payload as { works: ManagedWork[] };
}

export async function updateWorkSettings(token: string, workId: number, settings: WorkSettingsPayload) {
  const response = await fetch(`${API_ORIGIN}/works/${workId}/settings/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Token ${token}` },
    body: JSON.stringify(settings),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "Unable to update work");
  return payload as { work: ManagedWork };
}
