import { computed, ref } from "vue";
import { signIn, signInWithGoogle, signUp, startFaydaSignIn, updateProfile, type SessionUser, type SignUpPayload } from "../lib/graphql";

const token = ref(localStorage.getItem("underground_token") ?? "");
const user = ref<SessionUser | null>(JSON.parse(localStorage.getItem("underground_user") ?? "null"));

export function useAuth() {
  const isAuthenticated = computed(() => Boolean(token.value));

  function saveSession(nextToken: string, nextUser: SessionUser) {
    token.value = nextToken;
    user.value = nextUser;
    localStorage.setItem("underground_token", nextToken);
    localStorage.setItem("underground_user", JSON.stringify(nextUser));
  }

  async function register(payload: SignUpPayload) {
    const session = await signUp(payload);
    saveSession(session.token, session.user);
  }

  async function login(identifier: string, password: string) {
    const session = await signIn(identifier, password);
    saveSession(session.token, session.user);
  }

  async function loginWithGoogle(credential: string, clientId: string) {
    const session = await signInWithGoogle(credential, clientId);
    saveSession(session.token, session.user);
  }

  async function loginWithFayda() {
    const response = await startFaydaSignIn();
    window.location.href = response.authorizationUrl;
  }

  function logout() {
    token.value = "";
    user.value = null;
    localStorage.removeItem("underground_token");
    localStorage.removeItem("underground_user");
  }

  async function saveProfile(formData: FormData) {
    const response = await updateProfile(token.value, formData);
    user.value = response.user;
    localStorage.setItem("underground_user", JSON.stringify(response.user));
  }

  return { token, user, isAuthenticated, register, login, loginWithGoogle, loginWithFayda, logout, saveProfile };
}
