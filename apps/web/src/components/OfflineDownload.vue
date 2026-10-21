<template>
  <button type="button" class="secondary-button" :disabled="saving" @click="download">{{ saving ? percent === null ? 'Saving…' : `Saving ${percent}%…` : 'Save offline' }}</button>
  <span v-if="message" role="status">{{ message }}</span>
</template>
<script setup lang="ts">
import { ref } from 'vue';
import { useAuth } from '../composables/use-auth';
import { saveOffline } from '../lib/offline';
import type { CreativeWork } from '../composables/use-catalog';
const props = defineProps<{ work: CreativeWork }>();
const { user } = useAuth();
const saving = ref(false);
const percent = ref<number | null>(null);
const message = ref('');
async function download() {
  if (!user.value) { message.value = 'Sign in to keep private offline downloads.'; return; }
  const owner = user.value.id;
  saving.value = true; message.value = '';
  try { await saveOffline(owner, props.work, (value) => { percent.value = value; }); message.value = 'Saved in Offline downloads.'; }
  catch (error) { message.value = error instanceof Error ? error.message : 'Download failed. Check connection and free storage.'; }
  finally { saving.value = false; }
}
</script>
