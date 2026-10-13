<template>
  <section class="page-panel">
    <div class="my-creations__heading">
      <div>
        <span class="eyebrow">My creations</span>
        <h2>Manage your catalog.</h2>
        <p class="page-panel__intro">Edit each work's title, description, visibility, payment setting, and price.</p>
      </div>
      <button class="secondary-button" type="button" @click="loadWorks" :disabled="loading">{{ loading ? "Loading..." : "Refresh" }}</button>
    </div>

    <p v-if="message" class="upload-panel__message">{{ message }}</p>
    <p v-if="error" class="form-error">{{ error }}</p>

    <div v-if="!isAuthenticated" class="empty-state">Sign in as an artist / creator to manage your works.</div>
    <div v-else-if="user?.profileType !== 'creator'" class="empty-state">Switch your profile type to artist / creator before managing creations.</div>
    <div v-else-if="!loading && !works.length" class="empty-state">You have not published any works yet.</div>

    <div v-else class="creation-list">
      <article v-for="work in works" :key="work.id" class="creation-editor">
        <div class="creation-editor__meta">
          <span class="eyebrow">{{ work.workType.replace("_", " ") }}</span>
          <strong>{{ work.playCount }} plays / {{ work.downloadCount }} downloads</strong>
          <span>{{ work.published ? "Public" : "Private" }} / {{ work.isPayable ? `${work.priceEtb} ETB` : "Free" }}</span>
        </div>

        <form class="creation-editor__form" @submit.prevent="saveWork(work)">
          <input v-model="work.title" required placeholder="Work title" aria-label="Work title" />
          <textarea v-model="work.description" rows="3" placeholder="Description" aria-label="Description"></textarea>
          <label class="inline-toggle">
            <input v-model="work.published" type="checkbox" />
            <span>Publicly visible</span>
          </label>
          <label class="inline-toggle">
            <input v-model="work.isPayable" type="checkbox" />
            <span>Payable through Telebirr</span>
          </label>
          <input v-if="work.isPayable" v-model="work.priceEtb" required min="1" step="0.01" type="number" placeholder="Price in ETB" aria-label="Price in ETB" />
          <button class="primary-button" type="submit" :disabled="savingId === work.id">{{ savingId === work.id ? "Saving..." : "Save changes" }}</button>
        </form>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { listMyWorks, updateWorkSettings, type ManagedWork } from "../lib/graphql";
import { useAuth } from "../composables/use-auth";

const { token, user, isAuthenticated } = useAuth();
const works = ref<ManagedWork[]>([]);
const loading = ref(false);
const savingId = ref<number | null>(null);
const message = ref("");
const error = ref("");

async function loadWorks() {
  if (!token.value || user.value?.profileType !== "creator") return;
  loading.value = true;
  error.value = "";
  try {
    works.value = (await listMyWorks(token.value)).works;
  } catch (requestError) {
    error.value = requestError instanceof Error ? requestError.message : "Unable to load creations";
  } finally {
    loading.value = false;
  }
}

async function saveWork(work: ManagedWork) {
  if (!token.value) return;
  savingId.value = work.id;
  message.value = "";
  error.value = "";
  try {
    const response = await updateWorkSettings(token.value, work.id, {
      title: work.title,
      description: work.description,
      published: work.published,
      isPayable: work.isPayable,
      priceEtb: work.priceEtb,
    });
    works.value = works.value.map((item) => (item.id === work.id ? response.work : item));
    message.value = "Creation settings updated.";
  } catch (requestError) {
    error.value = requestError instanceof Error ? requestError.message : "Unable to save creation";
  } finally {
    savingId.value = null;
  }
}

onMounted(() => {
  loadWorks();
});
</script>
