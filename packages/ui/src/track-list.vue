<template>
  <section class="track-list" aria-label="Tracklist">
    <div class="track-list__heading">
      <span class="eyebrow">Tracks</span>
      <span>{{ tracks.length }} tracks</span>
    </div>
    <ol v-if="tracks.length" class="track-list__items">
      <li v-for="(track, index) in tracks" :key="track.id" class="track-list__item">
        <span class="track-list__number">{{ String(index + 1).padStart(2, "0") }}</span>
        <button type="button" class="track-list__button" @click="$emit('select', track)">
          <span>{{ track.title }}</span>
          <span class="track-list__album">{{ track.album.title }}</span>
        </button>
      </li>
    </ol>
    <p v-else class="track-list__empty">No tracks match this genre yet.</p>
  </section>
</template>

<script setup lang="ts">
export interface TrackListItem {
  id: string;
  title: string;
  audioFile?: string | null;
  album: { title: string; artist: { name: string } };
}

defineProps<{ tracks: TrackListItem[] }>();
defineEmits<{ select: [track: TrackListItem] }>();
</script>
