<template>
  <section class="auth-panel">
    <div class="auth-panel__heading">
      <div>
        <span class="eyebrow">Account access</span>
        <h2>{{ mode === "sign-in" ? "Welcome back." : "Make a home for your work." }}</h2>
      </div>
      <button v-if="isAuthenticated" type="button" class="text-button" @click="logout">Sign out</button>
    </div>

    <template v-if="isAuthenticated">
      <p class="auth-panel__signed-in">Signed in as <strong>{{ user?.displayName }}</strong> <span>({{ user?.profileType === "creator" ? "creator" : "regular user" }})</span></p>
    </template>
    <template v-else>
      <div class="auth-panel__tabs" role="tablist">
        <button type="button" :class="{ active: mode === 'sign-in' }" @click="mode = 'sign-in'">Sign in</button>
        <button type="button" :class="{ active: mode === 'sign-up' }" @click="mode = 'sign-up'">Create account</button>
      </div>
      <form class="auth-panel__form" @submit.prevent="submit">
        <input v-if="mode === 'sign-up'" v-model="displayName" required placeholder="Display name" aria-label="Display name" />
        <input v-if="mode === 'sign-up'" v-model="username" required pattern="[A-Za-z0-9_.-]{3,30}" placeholder="Username" aria-label="Username" />
        <input v-if="mode === 'sign-up'" v-model="email" required type="email" placeholder="Email address" aria-label="Email address" />
        <input v-else v-model="identifier" required placeholder="Username or email" aria-label="Username or email" />
        <input v-model="password" required type="password" minlength="8" placeholder="Password (8+ characters)" aria-label="Password" />
        <input v-if="mode === 'sign-up'" v-model="confirmPassword" required type="password" minlength="8" placeholder="Confirm password" aria-label="Confirm password" />
        <select v-if="mode === 'sign-up'" v-model="profileType" aria-label="Account type">
          <option value="listener">Regular user</option>
          <option value="creator">Creator</option>
        </select>
        <p v-if="passwordMismatch" class="form-error">Passwords must match.</p>
        <button class="primary-button" type="submit" :disabled="loading || passwordMismatch">{{ loading ? "Working..." : mode === "sign-in" ? "Sign in" : "Create account" }}</button>
      </form>
      <div class="auth-panel__divider"><span>or</span></div>
      <div ref="googleButton" class="google-button"></div>
      <button v-if="!googleClientId" type="button" class="secondary-button" disabled>Continue with Google needs a client ID</button>
      <button type="button" class="secondary-button" @click="submitFayda" :disabled="loading">{{ loading ? "Working..." : "Continue with Fayda" }}</button>
      <p v-if="error" class="form-error">{{ error }}</p>
      <p class="auth-panel__fine-print">By joining, you agree to share your public creator profile and published work.</p>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useAuth } from "../composables/use-auth";

type AuthMode = "sign-in" | "sign-up";
type ProfileType = "listener" | "creator";
const mode = ref<AuthMode>("sign-in");
const displayName = ref("");
const username = ref("");
const email = ref("");
const identifier = ref("");
const password = ref("");
const confirmPassword = ref("");
const profileType = ref<ProfileType>("listener");
const loading = ref(false);
const error = ref("");
const googleButton = ref<HTMLDivElement | null>(null);
const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "";
const { user, isAuthenticated, register, login, loginWithGoogle, loginWithFayda, logout } = useAuth();
const passwordMismatch = computed(() => mode.value === "sign-up" && confirmPassword.value.length > 0 && password.value !== confirmPassword.value);

async function submit() {
  if (passwordMismatch.value) return;
  loading.value = true;
  error.value = "";
  try {
    if (mode.value === "sign-up") {
      await register({
        displayName: displayName.value,
        username: username.value,
        email: email.value,
        password: password.value,
        confirmPassword: confirmPassword.value,
        profileType: profileType.value,
      });
    } else {
      await login(identifier.value, password.value);
    }
  } catch (requestError) {
    error.value = requestError instanceof Error ? requestError.message : "Authentication failed";
  } finally {
    loading.value = false;
  }
}

async function submitFayda() {
  loading.value = true;
  error.value = "";
  try {
    await loginWithFayda();
  } catch (requestError) {
    error.value = requestError instanceof Error ? requestError.message : "Fayda sign-in is not configured";
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  if (!googleClientId || !googleButton.value) return;
  const render = () => {
    window.google?.accounts.id.initialize({
      client_id: googleClientId,
      callback: async (response) => {
        loading.value = true;
        error.value = "";
        try {
          await loginWithGoogle(response.credential, googleClientId);
        } catch (requestError) {
          error.value = requestError instanceof Error ? requestError.message : "Google sign-in failed";
        } finally {
          loading.value = false;
        }
      },
    });
    window.google?.accounts.id.renderButton(googleButton.value!, { theme: "outline", size: "large", width: 320 });
  };
  if (window.google) render();
  else {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = render;
    document.head.appendChild(script);
  }
});
</script>
