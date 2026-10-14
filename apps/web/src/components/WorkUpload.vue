<template>
  <section v-if="isAuthenticated && user?.profileType === 'creator'" class="upload-panel">
    <div>
      <span class="eyebrow">Publish a work</span>
      <h2>Put something into the world.</h2>
      <p class="upload-panel__intro">Music, photography, visual art, videography, poetry, or anything that needs a place to land.</p>
    </div>
    <form class="upload-panel__form" @submit.prevent="submit">
      <input v-model="title" required placeholder="Work title" aria-label="Work title" />
      <select v-model="workType" aria-label="Work type">
        <option value="music">Music</option>
        <option value="photography">Photography</option>
        <option value="visual_art">Visual art</option>
        <option value="videography">Videography</option>
        <option value="poetry">Poetry</option>
        <option value="other">Other</option>
      </select>
      <textarea v-model="description" rows="3" placeholder="Tell people what they are looking at or listening to." aria-label="Description"></textarea>
      <label class="file-picker">
        <span>{{ file?.name ?? "Choose a file" }}</span>
        <input required type="file" :accept="acceptedTypes" @change="selectFile" />
      </label>
      <label class="inline-toggle">
        <input v-model="isPayable" type="checkbox" />
        <span>Make this work payable through Telebirr</span>
      </label>
      <input v-if="isPayable" v-model="priceEtb" required min="1" step="0.01" type="number" placeholder="Price in ETB" aria-label="Price in ETB" />
      <p class="upload-panel__intro">{{ uploadHint }}</p>
      <progress v-if="loading" class="upload-progress" :value="progress" max="100">{{ progress }}%</progress>
      <p v-if="loading" class="upload-panel__intro">Uploading {{ progress }}%</p>
      <button class="primary-button" type="submit" :disabled="loading">{{ loading ? "Publishing..." : "Publish work" }}</button>
    </form>
    <p v-if="message" class="upload-panel__message">{{ message }}</p>
    <p v-if="error" class="form-error">{{ error }}</p>
  </section>
  <section v-else-if="isAuthenticated" class="upload-panel">
    <div>
      <span class="eyebrow">Creator access</span>
      <h2>Switch to creator.</h2>
      <p class="upload-panel__intro">Regular users can listen and collect. Change your profile type to creator before publishing work.</p>
    </div>
    <button class="primary-button" type="button" @click="$emit('go-profile')">Open profile settings</button>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { API_ORIGIN } from "../lib/graphql";
import { useAuth } from "../composables/use-auth";

const { token, user, isAuthenticated } = useAuth();
const emit = defineEmits<{ "go-profile": []; uploaded: [] }>();
const title = ref("");
const workType = ref("music");
const description = ref("");
const file = ref<File | null>(null);
const isPayable = ref(false);
const priceEtb = ref("");
const loading = ref(false);
const progress = ref(0);
const message = ref("");
const error = ref("");
const acceptedTypesByWorkType: Record<string, string> = {
  music: "audio/mpeg,audio/mp4,audio/aac,audio/ogg,audio/wav,.mp3,.m4a,.aac,.ogg,.wav",
  photography: "image/gif,image/jpeg,image/png,image/webp,.gif,.jpg,.jpeg,.png,.webp",
  visual_art: "image/gif,image/jpeg,image/png,image/webp,application/pdf,.gif,.jpg,.jpeg,.png,.webp,.pdf",
  videography: "video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm",
  poetry: "text/plain,application/pdf,.txt,.pdf",
  other: "image/gif,image/jpeg,image/png,image/webp,application/pdf,text/plain,audio/mpeg,video/mp4,.gif,.jpg,.jpeg,.png,.webp,.pdf,.txt,.mp3,.mp4",
};
const acceptedTypes = computed(() => acceptedTypesByWorkType[workType.value]);
const uploadHint = computed(() => `Allowed for ${workType.value.replace("_", " ")}: ${acceptedTypes.value.split(",").filter((item) => item.startsWith(".")).join(", ")}`);

function selectFile(event: Event) {
  file.value = (event.target as HTMLInputElement).files?.[0] ?? null;
}

async function submit() {
  if (!file.value || !token.value) return;
  loading.value = true;
  progress.value = 0;
  message.value = "";
  error.value = "";
  const formData = new FormData();
  formData.append("title", title.value);
  formData.append("workType", workType.value);
  formData.append("description", description.value);
  formData.append("file", file.value);
  formData.append("isPayable", String(isPayable.value));
  formData.append("priceEtb", isPayable.value ? priceEtb.value : "0");
  try {
    await uploadWithProgress(token.value, formData);
    message.value = "Your work is live in the catalog.";
    title.value = "";
    description.value = "";
    file.value = null;
    isPayable.value = false;
    priceEtb.value = "";
    progress.value = 100;
    emit("uploaded");
  } catch (requestError) {
    error.value = requestError instanceof Error ? requestError.message : "Upload failed";
  } finally {
    loading.value = false;
  }
}

function uploadWithProgress(nextToken: string, formData: FormData) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", `${API_ORIGIN}/works/upload/`);
    request.setRequestHeader("Authorization", `Token ${nextToken}`);
    request.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      progress.value = Math.round((event.loaded / event.total) * 100);
    };
    request.onload = () => {
      let payload: { error?: string } = {};
      try {
        payload = JSON.parse(request.responseText || "{}");
      } catch {
        payload = {};
      }
      if (request.status >= 200 && request.status < 300) resolve();
      else reject(new Error(payload.error ?? "Upload failed"));
    };
    request.onerror = () => reject(new Error("Upload failed"));
    request.send(formData);
  });
}
</script>
