<template>
  <div v-if="work" class="viewer-overlay" role="dialog" aria-modal="true" aria-label="Work viewer" @click.self="$emit('close')">
    <section ref="dialog" class="viewer-dialog" tabindex="-1" @keydown.esc="$emit('close')" @keydown.tab="trapFocus">
      <header class="viewer-header"><h2>{{ work.title }}</h2><button class="icon-button" aria-label="Close viewer" @click="$emit('close')"><X :size="22" /></button></header>
      <div v-if="work" class="work-viewer">
        <p class="viewer-credit">{{ work.creator.displayName }} <span>{{ work.playCount }} views</span></p>
        <p v-if="error" role="alert" class="form-error">{{ error }}</p>
        <pre v-if="kind === 'text'" class="text-preview">{{ text || (error ? '' : 'Loading text...') }}</pre>
        <iframe v-else-if="kind === 'pdf' && source" :src="source" :title="work.title" @load="loaded" />
        <img v-else-if="kind === 'image' && source" :src="source" :alt="work.title" @load="loaded" @error="error = 'Image could not be loaded.'" />
        <video v-else-if="kind === 'video' && source" :src="source" controls playsinline @playing="loaded" @error="error = 'Video could not be played.'" />
        <p v-else>No inline preview is available for this file.</p>
        <p v-if="work.description">{{ work.description }}</p>
        <div class="viewer-actions"><a :href="source" target="_blank" rel="noopener noreferrer">Open original</a><a :href="workDownloadUrl(work.id)">Download</a><OfflineDownload :key="work.id" :work="work" /><button v-if="work.isPayable" class="primary-button" @click="$emit('pay', work)">Pay {{ work.priceEtb }} ETB</button></div>
      </div>
    </section>
  </div>
</template>
<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { X } from 'lucide-vue-next';
import { mediaKind } from '../lib/media';
import { workDownloadUrl } from '../lib/graphql';
import type { CreativeWork } from '../composables/use-catalog';
import OfflineDownload from './OfflineDownload.vue';
import { useMediaSource } from '../composables/use-media-source';
const props = defineProps<{ work: CreativeWork | null }>();
const source = useMediaSource(() => props.work?.id);
const emit = defineEmits<{ close: []; viewed: [work: CreativeWork]; pay: [work: CreativeWork] }>();
const kind = computed(() => mediaKind(props.work?.file ?? ''));
const text = ref('');
const error = ref('');
const dialog = ref<HTMLElement>();
let opener: HTMLElement | undefined;
watch(() => !!props.work, async (open, _, cleanup) => {
  let stale = false;
  cleanup(() => { stale = true; });
  if (!open) { opener?.focus(); opener = undefined; return; }
  opener = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
  await nextTick();
  if (!stale) dialog.value?.querySelector<HTMLButtonElement>('button')?.focus();
});
function trapFocus(event: KeyboardEvent) {
  const controls = [...(dialog.value?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input, video[controls], iframe') ?? [])];
  const first = controls[0]; const last = controls[controls.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
}
let counted = false;
function loaded() { if (!counted && props.work) { counted = true; emit('viewed', props.work); } }
watch([() => props.work?.id, source], async (_, __, cleanup) => {
  text.value = ''; error.value = ''; counted = false;
  const controller = new AbortController();
  cleanup(() => controller.abort());
  if (!props.work || !source.value || kind.value !== 'text') return;
  try {
    const response = await fetch(source.value, { signal: controller.signal });
    if (!response.ok) throw new Error('Text could not be loaded.');
    text.value = await response.text();
    loaded();
  } catch (err) { if (!controller.signal.aborted) error.value = err instanceof Error ? err.message : 'Preview unavailable.'; }
}, { immediate: true });
</script>
