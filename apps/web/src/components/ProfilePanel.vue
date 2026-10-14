<template>
  <section class="page-panel">
    <span class="eyebrow">Profile</span>
    <template v-if="user">
      <div class="profile-header">
        <img v-if="avatarPreview" class="profile-avatar" :src="avatarPreview" :alt="user.displayName" />
        <div v-else class="profile-avatar profile-avatar--empty">{{ initials }}</div>
        <div>
          <h2>{{ user.displayName }}</h2>
          <p class="page-panel__intro">@{{ user.username }} / {{ user.profileType === "creator" ? "creator" : "regular user" }}</p>
        </div>
      </div>

      <form class="profile-form" @submit.prevent="submit">
        <input v-model="displayName" required placeholder="Display name" aria-label="Display name" />
        <select v-model="profileType" aria-label="Profile type">
          <option value="listener">Regular user</option>
          <option value="creator">Creator</option>
        </select>
        <input v-model="location" placeholder="Location" aria-label="Location" />
        <input v-model="disciplines" placeholder="Disciplines, separated by commas" aria-label="Disciplines" />
        <textarea v-model="bio" rows="4" placeholder="Bio" aria-label="Bio"></textarea>
        <label class="file-picker">
          <span>{{ avatar?.name ?? "Upload profile image" }}</span>
          <input type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" @change="selectAvatar" />
        </label>
        <button class="primary-button" type="submit" :disabled="loading">{{ loading ? "Saving..." : "Save profile" }}</button>
      </form>
      <p v-if="message" class="upload-panel__message">{{ message }}</p>
      <p v-if="error" class="form-error">{{ error }}</p>
    </template>
    <template v-else>
      <h2>Your profile starts here.</h2>
      <p class="page-panel__intro">Sign in or create an account to edit your circle profile image and public information.</p>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { mediaUrl } from "../lib/graphql";
import { useAuth } from "../composables/use-auth";

type ProfileType = "listener" | "creator";
const { user, saveProfile } = useAuth();
const displayName = ref("");
const profileType = ref<ProfileType>("listener");
const location = ref("");
const disciplines = ref("");
const bio = ref("");
const avatar = ref<File | null>(null);
const avatarPreview = ref("");
const loading = ref(false);
const message = ref("");
const error = ref("");
const initials = computed(() => (user.value?.displayName ?? "U").slice(0, 2).toUpperCase());

watch(
  user,
  (nextUser) => {
    if (!nextUser) return;
    displayName.value = nextUser.displayName ?? "";
    profileType.value = nextUser.profileType ?? "listener";
    location.value = nextUser.location ?? "";
    disciplines.value = Array.isArray(nextUser.disciplines) ? nextUser.disciplines.join(", ") : "";
    bio.value = nextUser.bio ?? "";
    avatarPreview.value = mediaUrl(nextUser.avatar) ?? "";
  },
  { immediate: true },
);

function selectAvatar(event: Event) {
  const selected = (event.target as HTMLInputElement).files?.[0] ?? null;
  error.value = "";
  if (selected && !["image/jpeg", "image/png", "image/webp"].includes(selected.type)) {
    error.value = "Profile image must be JPG, PNG, or WebP.";
    avatar.value = null;
    return;
  }
  avatar.value = selected;
  if (selected) avatarPreview.value = URL.createObjectURL(selected);
}

async function submit() {
  loading.value = true;
  message.value = "";
  error.value = "";
  const formData = new FormData();
  formData.append("displayName", displayName.value);
  formData.append("profileType", profileType.value);
  formData.append("location", location.value);
  formData.append("disciplines", disciplines.value);
  formData.append("bio", bio.value);
  if (avatar.value) formData.append("avatar", avatar.value);
  try {
    await saveProfile(formData);
    message.value = "Profile updated.";
  } catch (requestError) {
    error.value = requestError instanceof Error ? requestError.message : "Profile update failed";
  } finally {
    loading.value = false;
  }
}
</script>
