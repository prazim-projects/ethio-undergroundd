<template>
  <section v-if="isAuthenticated && user?.profileType === 'creator'" class="upload-panel">
    <div>
      <span class="eyebrow">Publish a work</span>
      <h2>Put something into the world.</h2>
      <p class="upload-panel__intro">Music, photography, visual art, videography, poetry, or anything that needs a place to land.</p>
    </div>
    <form class="upload-panel__form" @submit.prevent="submit">
      <fieldset :disabled="loading" class="upload-fields">
      <input v-model="title" required maxlength="220" placeholder="Work title" aria-label="Work title" />
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
        <input :required="!file" type="file" :accept="acceptedTypes" @change="selectFile" />
      </label>
      <button v-if="nativeCameraAvailable && ['photography', 'visual_art', 'other'].includes(workType)" type="button" class="secondary-button" @click="capture('file')">Take a photo</button>
      <label class="inline-toggle">
        <input v-model="isPayable" type="checkbox" />
        <span>Make this work payable through Telebirr</span>
      </label>
      <label class="file-picker"><span>Cover artwork (optional)</span><input type="file" accept="image/jpeg,image/png,image/webp" @change="cover = ($event.target as HTMLInputElement).files?.[0] ?? null" /></label>
      <button v-if="nativeCameraAvailable" type="button" class="secondary-button" @click="capture('cover')">Photograph cover artwork</button>
      <input v-if="isPayable" v-model="priceEtb" required min="1" step="0.01" type="number" placeholder="Price in ETB" aria-label="Price in ETB" />
      <p class="upload-panel__intro">{{ uploadHint }}</p>
      </fieldset>
      <p class="upload-panel__intro">Images are compressed before upload. Audio/video from 16 MB supports resume, up to 1 GB. After reopening, select the same file and publish again to resume within 7 days.</p>
      <progress v-if="loading" class="upload-progress" :value="progress" max="100">{{ progress }}%</progress>
      <p v-if="loading" class="upload-panel__intro">Uploading {{ progress }}%</p>
      <button class="primary-button" type="submit" :disabled="loading">{{ loading ? "Publishing..." : "Publish work" }}</button>
      <button v-if="loading" type="button" class="secondary-button" @click="controller?.abort()">Pause upload</button>
      <button v-if="!loading && file && error" type="button" class="secondary-button" @click="discardUpload">Discard saved upload</button>
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
import { computed, onUnmounted, ref, watch } from "vue";
import { publishWork, cancelUpload } from "../lib/uploads";
import { takePhoto, nativeCameraAvailable } from "../lib/camera";
import { useAuth } from "../composables/use-auth";

const { token, user, isAuthenticated } = useAuth();
const emit = defineEmits<{ "go-profile": []; uploaded: [] }>();
const title = ref("");
const workType = ref("music");
const description = ref("");
const file = ref<File | null>(null);
const cover = ref<File | null>(null);
const isPayable = ref(false);
const priceEtb = ref("");
const loading = ref(false);
const progress = ref(0);
const message = ref("");
const error = ref("");
let controller: AbortController | undefined;
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

async function capture(target: 'file' | 'cover') {
  try {
    const photo = await takePhoto();
    if (target === 'file') file.value = photo; else cover.value = photo;
  } catch (err) { error.value = err instanceof Error ? err.message : 'Camera unavailable.'; }
}

async function discardUpload() {
  if (!token.value || !user.value || !file.value) return;
  try { await cancelUpload(token.value, user.value.id, file.value, workType.value); error.value = ''; message.value = 'Saved upload discarded.'; }
  catch (err) { error.value = err instanceof Error ? err.message : 'Unable to discard upload.'; }
}

async function submit() {
  if (!file.value || !token.value || !user.value) return;
  const sessionToken = token.value;
  controller = new AbortController();
  loading.value = true;
  progress.value = 0;
  message.value = "";
  error.value = "";
  const formData = new FormData();
  formData.append("title", title.value);
  formData.append("workType", workType.value);
  formData.append("description", description.value);
  formData.append("file", file.value);
  if (cover.value) formData.append("thumbnail", cover.value);
  formData.append("isPayable", String(isPayable.value));
  formData.append("priceEtb", isPayable.value ? priceEtb.value : "0");
  try {
    await publishWork(sessionToken, user.value.id, formData, controller.signal, (value) => { progress.value = value; });
    if (token.value !== sessionToken) return;
    message.value = "Your work is live in the catalog.";
    title.value = "";
    description.value = "";
    file.value = null;
    cover.value = null;
    isPayable.value = false;
    priceEtb.value = "";
    progress.value = 100;
    emit("uploaded");
  } catch (requestError) {
    if (token.value === sessionToken) error.value = requestError instanceof DOMException && requestError.name === 'AbortError'
      ? 'Upload paused. Publish again with the same file to resume large audio/video.'
      : requestError instanceof Error ? requestError.message : "Upload failed";
  } finally {
    loading.value = false;
  }
}

watch(token, () => { controller?.abort(); file.value = null; cover.value = null; message.value = ''; error.value = ''; });
onUnmounted(() => controller?.abort());
</script>
