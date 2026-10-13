<template>
  <section class="audio-player" aria-label="Audio player">
    <div class="audio-player__meta">
      <span class="audio-player__eyebrow">Now playing</span>
      <strong>{{ title }}</strong>
    </div>
    <audio ref="audio" :src="src" controls preload="metadata" @play="isPlaying = true" @pause="isPlaying = false" />
    <div class="audio-player__actions">
      <span class="audio-player__status">{{ isPlaying ? "Playing" : "Ready" }}</span>
      <a v-if="downloadUrl" class="audio-player__download" :href="downloadUrl">Download</a>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";

interface AudioPlayerProps {
  title: string;
  src: string;
  downloadUrl?: string;
  autoplayToken?: number;
}

const props = defineProps<AudioPlayerProps>();
const audio = ref<HTMLAudioElement | null>(null);
const isPlaying = ref(false);

watch(
  () => [props.src, props.autoplayToken] as const,
  ([nextSrc], [previousSrc]) => {
    if (!audio.value) return;
    if (nextSrc !== previousSrc) audio.value.load();
    if (props.autoplayToken) audio.value.play().catch(() => {
      isPlaying.value = false;
    });
  },
);
</script>
