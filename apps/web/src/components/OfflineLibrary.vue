<template>
  <section class="page-panel">
    <p class="page-panel__intro">Saved on this device for your account. Remove downloads to free storage.</p>
    <p v-if="!user" class="empty-state">Sign in to open your offline downloads.</p>
    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    <p v-if="loading" role="status">Loading downloads…</p>
    <template v-else-if="user">
      <div class="pagination"><span>{{ entries.length }} downloads · {{ (bytes / 1024 / 1024).toFixed(1) }} MB</span><button v-if="entries.length" class="secondary-button" :disabled="removing" @click="removeAll">Remove all downloads</button></div>
      <p v-if="!entries.length" class="empty-state">Open a work and choose Save offline to keep it here.</p>
      <article v-for="entry in entries" :key="entry.key" class="offline-entry">
        <div><strong>{{ entry.work.title }}</strong><p>{{ entry.work.creator.displayName }} · {{ (entry.size / 1024 / 1024).toFixed(1) }} MB</p></div>
        <button class="primary-button" @click="$emit('open', entry.work, entries.map((item) => item.work))">Open</button>
        <button class="secondary-button" :disabled="removing" @click="remove(entry.work.id)">Remove</button>
      </article>
    </template>
  </section>
</template>
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useAuth } from '../composables/use-auth';
import { listOffline, removeOffline, type OfflineEntry } from '../lib/offline';
import type { CreativeWork } from '../composables/use-catalog';
defineEmits<{ open: [work: CreativeWork, queue: CreativeWork[]] }>();
const { user } = useAuth();
const entries = ref<OfflineEntry[]>([]);
const loading = ref(false);
const removing = ref(false);
const error = ref('');
const bytes = computed(() => entries.value.reduce((sum, entry) => sum + entry.size, 0));
let version = 0;
async function load() {
  const current = ++version;
  const owner = user.value?.id;
  entries.value = []; error.value = ''; loading.value = !!owner;
  if (!owner) return;
  try { const result = await listOffline(owner); if (current === version) entries.value = result; }
  catch (err) { if (current === version) error.value = err instanceof Error ? err.message : 'Device storage is unavailable.'; }
  finally { if (current === version) loading.value = false; }
}
async function remove(id: string) {
  if (!user.value) return;
  removing.value = true;
  try { await removeOffline(user.value.id, id); await load(); }
  catch (err) { error.value = err instanceof Error ? err.message : 'Unable to remove download.'; }
  finally { removing.value = false; }
}
async function removeAll() {
  if (!user.value) return;
  const owner = user.value.id;
  removing.value = true;
  try { for (const entry of [...entries.value]) await removeOffline(owner, entry.work.id); await load(); }
  catch (err) { error.value = err instanceof Error ? err.message : 'Unable to remove downloads.'; }
  finally { removing.value = false; }
}
watch(() => user.value?.id, load, { immediate: true });
onMounted(() => window.addEventListener('offline-library-changed', load));
onUnmounted(() => { version++; window.removeEventListener('offline-library-changed', load); });
</script>
