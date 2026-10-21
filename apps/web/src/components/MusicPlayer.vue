<template>
  <section class="music-player" aria-label="Now playing">
    <audio ref="audio" :src="source" preload="auto" @playing="onPlaying" @pause="paused" @timeupdate="sync" @loadedmetadata="metadataLoaded" @ended="ended" @error="playbackError" />
    <div class="player-identity"><WorkArtwork :work="work" /><div><strong>{{ work.title }}</strong><span>{{ work.creator.displayName }}</span><span v-if="resumeBlocked" role="status">Tap play to resume your song.</span><OfflineDownload :key="work.id" :work="work" /></div></div>
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
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from "vue";
import { Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Volume2, Download } from "lucide-vue-next";
import WorkArtwork from "./WorkArtwork.vue";
import OfflineDownload from "./OfflineDownload.vue";
import { useMediaSource } from "../composables/use-media-source";
import { workDownloadUrl, mediaUrl } from "../lib/graphql";
import { useAuth } from '../composables/use-auth';
import { savePlayback, type PlaybackSnapshot } from '../lib/playback';
import { formatTime, nextIndex } from "../lib/media";
import type { CreativeWork } from "../composables/use-catalog";
const props = defineProps<{ work: CreativeWork; queue: CreativeWork[]; selection: number; resume?: PlaybackSnapshot }>();
const { user } = useAuth();
const source = useMediaSource(() => props.work.id);
const emit = defineEmits<{ select: [work: CreativeWork]; played: [work: CreativeWork]; error: [message: string] }>();
const audio = ref<HTMLAudioElement>();
const playing = ref(false);
const time = ref(0);
const duration = ref(0);
const volume = ref(props.resume?.volume ?? 0.8);
const resumeBlocked = ref(false);
const shuffle = ref(false);
const repeat = ref(false);
let counted = false;
let resumeTime = 0;
let lastSaved = 0;
const owner = user.value?.id;
function persist() {
  if (user.value?.id !== owner) return;
  savePlayback({ work: props.work, queue: props.queue.slice(0, 100), time: resumeTime || (audio.value?.currentTime ?? time.value),
    playing: playing.value, volume: volume.value, saved: Date.now() }, owner);
}
watch([() => props.selection, source], async (_, __, cleanup) => {
  let stale = false;
  cleanup(() => { stale = true; });
  const restored = props.resume?.work.id === props.work.id && props.selection === 0 ? props.resume : undefined;
  counted = Boolean(restored);
  resumeTime = restored?.time ?? 0;
  time.value = resumeTime;
  duration.value = 0;
  await nextTick();
  if (stale || !audio.value || !source.value) return;
  audio.value.volume = volume.value;
  audio.value.load();
  setMediaSession();
  if (!restored || restored.playing) await play();
}, { immediate: true, flush: 'post' });
watch(volume, (value) => { if (audio.value) audio.value.volume = value; });
async function play() { try { await audio.value?.play(); resumeBlocked.value = false; } catch { playing.value = false; resumeBlocked.value = true; } }
function toggle() { if (audio.value?.paused) void play(); else audio.value?.pause(); }
function onPlaying() { playing.value = true; resumeBlocked.value = false; if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing'; persist(); if (!counted) { counted = true; emit('played', props.work); } }
function paused() { playing.value = false; if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused'; persist(); }
function metadataLoaded() {
  if (audio.value && resumeTime && Number.isFinite(audio.value.duration)) { audio.value.currentTime = Math.min(resumeTime, Math.max(0, audio.value.duration - .1)); resumeTime = 0; }
  sync();
}
function sync() {
  time.value = audio.value?.currentTime ?? 0; duration.value = Number.isFinite(audio.value?.duration) ? audio.value!.duration : 0;
  if (Date.now() - lastSaved > 1000) { lastSaved = Date.now(); persist(); }
  if (duration.value && 'mediaSession' in navigator && navigator.mediaSession.setPositionState) {
    try { navigator.mediaSession.setPositionState({ duration: duration.value, playbackRate: 1, position: Math.min(time.value, duration.value) }); } catch { /* Browser support varies. */ }
  }
}
function seek(event: Event) { if (audio.value) audio.value.currentTime = Number((event.target as HTMLInputElement).value); }
function advance(direction: number) {
  if (!props.queue.length) return;
  const index = props.queue.findIndex((item) => item.id === props.work.id);
  const alternatives = props.queue.filter((item) => item.id !== props.work.id);
  const next = shuffle.value && alternatives.length ? alternatives[Math.floor(Math.random() * alternatives.length)] : props.queue[nextIndex(index, props.queue.length, direction)];
  emit('select', next);
}
function ended() { counted = false; if (repeat.value && audio.value) { audio.value.currentTime = 0; void play(); } else advance(1); }
function playbackError() { if (!source.value) return; playing.value = false; emit('error', 'This track could not be played. Try another track or retry when connected.'); }
function setMediaSession() {
  if (!('mediaSession' in navigator)) return;
  if (typeof MediaMetadata !== 'undefined') navigator.mediaSession.metadata = new MediaMetadata({ title: props.work.title, artist: props.work.creator.displayName,
    artwork: props.work.thumbnail ? [{ src: mediaUrl(props.work.thumbnail)! }] : [] });
  const actions: Partial<Record<MediaSessionAction, MediaSessionActionHandler>> = {
    play: () => { void play(); }, pause: () => audio.value?.pause(), previoustrack: () => advance(-1), nexttrack: () => advance(1),
    seekto: (event) => { if (audio.value && event.seekTime !== undefined) audio.value.currentTime = event.seekTime; },
    seekbackward: (event) => { if (audio.value) audio.value.currentTime = Math.max(0, audio.value.currentTime - (event.seekOffset || 10)); },
    seekforward: (event) => { if (audio.value) audio.value.currentTime = Math.min(duration.value || Infinity, audio.value.currentTime + (event.seekOffset || 10)); },
  };
  for (const [action, handler] of Object.entries(actions)) {
    try { navigator.mediaSession.setActionHandler(action as MediaSessionAction, handler!); } catch { /* Optional OS controls. */ }
  }
}
onMounted(() => { window.addEventListener('pagehide', persist); document.addEventListener('visibilitychange', persist); });
onBeforeUnmount(() => {
  persist(); window.removeEventListener('pagehide', persist); document.removeEventListener('visibilitychange', persist);
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = null; navigator.mediaSession.playbackState = 'none';
    for (const action of ['play', 'pause', 'previoustrack', 'nexttrack', 'seekto', 'seekbackward', 'seekforward'] as MediaSessionAction[]) {
      try { navigator.mediaSession.setActionHandler(action, null); } catch { /* Optional OS controls. */ }
    }
  }
});
</script>
