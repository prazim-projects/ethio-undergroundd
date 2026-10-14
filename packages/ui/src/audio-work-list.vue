<template>
  <section class="audio-work-list" aria-label="Audio works">
    <div class="audio-work-list__heading">
      <span class="eyebrow">Audio works</span>
      <span>{{ works.length }} works</span>
    </div>
    <ol v-if="works.length" class="audio-work-list__items">
      <li v-for="(work, index) in works" :key="work.id" class="audio-work-list__item">
        <span class="audio-work-list__number">{{ String(index + 1).padStart(2, "0") }}</span>
        <button type="button" class="audio-work-list__button" @click="$emit('select', work)">
          <span>{{ work.title }}</span>
          <span class="audio-work-list__creator">{{ work.creatorName }}</span>
        </button>
      </li>
    </ol>
    <p v-else class="audio-work-list__empty">No audio works match this genre yet.</p>
  </section>
</template>

<script setup lang="ts">
export interface AudioWorkListItem {
  id: string;
  title: string;
  audioFile?: string | null;
  creatorName: string;
}

defineProps<{ works: AudioWorkListItem[] }>();
defineEmits<{ select: [work: AudioWorkListItem] }>();
</script>
