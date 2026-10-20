<template>
  <section class="music-player" aria-label="Now playing">
    <audio ref="audio" :src="source" preload="metadata" @playing="onPlaying" @pause="playing = false" @timeupdate="sync" @loadedmetadata="sync" @ended="ended" @error="playbackError" />
    <div class="player-identity"><WorkArtwork :work="work" /><div><strong>{{ work.title }}</strong><span>{{ work.creator.displayName }}</span><OfflineDownload :key="work.id" :work="work" /></div></div>
    <div class="player-center"><div class="player-buttons">
      <button class="icon-button player-shuffle" title="Shuffle" aria-label="Shuffle" :aria-pressed="shuffle" @click="shuffle = !shuffle"><Shuffle :size="17" /></button>
      <button class="icon-button" title="Previous track" aria-label="Previous track" @click="advance(-1)"><SkipBack :size="20" /></button>
      <button class="play-button" :aria-label="playing ? 'Pause playback' : 'Resume playback'" :title="playing ? 'Pause' : 'Play'" @click="toggle"><Pause v-if="playing" :size="22" /><Play v-else :size="22" /></button>
      <button class="icon-button" title="Next track" aria-label="Next track" @click="advance(1)"><SkipForward :size="20" /></button>
      <button class="icon-button player-repeat" title="Repeat" aria-label="Repeat" :aria-pressed="repeat" @click="repeat = !repeat"><Repeat :size="17" /></button>
    </div><div class="player-timeline"><span>{{ formatTime(time) }}</span><input type="range" min="0" :max="duration || 1" :value="time" step="0.1" :disabled="!duration" aria-label="Seek playback" @input="seek" /><span>{{ formatTime(duration) }}</span></div></div>
    <div class="player-volume"><Volume2 :size="18" /><input v-model.number="volume" type="range" min="0" max="1" step="0.05" aria-label="Volume" /><a :href="workDownloadUrl(work.id)" class="icon-button" title="Download" aria-label="Download playing track"><Download :size="18" /></a></div>
  </section>
</template>
<script setup lang="ts">
import { ref, watch, nextTick } from "vue";
import { Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Volume2, Download } from "lucide-vue-next";
import WorkArtwork from "./WorkArtwork.vue";
import OfflineDownload from "./OfflineDownload.vue";
import { useMediaSource } from "../composables/use-media-source";
import { workDownloadUrl } from "../lib/graphql";
import { formatTime, nextIndex } from "../lib/media";
import type { CreativeWork } from "../composables/use-catalog";
const props = defineProps<{ work: CreativeWork; queue: CreativeWork[]; selection: number }>();
const source = useMediaSource(() => props.work.id);
const emit = defineEmits<{ select: [work: CreativeWork]; played: [work: CreativeWork]; error: [message: string] }>();
const audio = ref<HTMLAudioElement>();
const playing = ref(false);
const time = ref(0);
const duration = ref(0);
const volume = ref(0.8);
const shuffle = ref(false);
const repeat = ref(false);
let counted = false;
watch([() => props.selection, source], async (_, __, cleanup) => {
  let stale = false;
  cleanup(() => { stale = true; });
  counted = false;
  time.value = 0;
  duration.value = 0;
  await nextTick();
  if (stale || !audio.value || !source.value) return;
  audio.value.volume = volume.value;
  audio.value.load();
  await play();
}, { immediate: true, flush: 'post' });
watch(volume, (value) => { if (audio.value) audio.value.volume = value; });
async function play() { try { await audio.value?.play(); } catch { playing.value = false; } }
function toggle() { if (audio.value?.paused) void play(); else audio.value?.pause(); }
function onPlaying() { playing.value = true; if (!counted) { counted = true; emit('played', props.work); } }
function sync() { time.value = audio.value?.currentTime ?? 0; duration.value = Number.isFinite(audio.value?.duration) ? audio.value!.duration : 0; }
function seek(event: Event) { if (audio.value) audio.value.currentTime = Number((event.target as HTMLInputElement).value); }
function advance(direction: number) {
  if (!props.queue.length) return;
  const index = props.queue.findIndex((item) => item.id === props.work.id);
  const alternatives = props.queue.filter((item) => item.id !== props.work.id);
  const next = shuffle.value && alternatives.length ? alternatives[Math.floor(Math.random() * alternatives.length)] : props.queue[nextIndex(index, props.queue.length, direction)];
  emit('select', next);
}
function ended() { counted = false; if (repeat.value && audio.value) { audio.value.currentTime = 0; void play(); } else advance(1); }
function playbackError() { playing.value = false; emit('error', 'This track could not be played. Try another track or retry when connected.'); }
</script>
