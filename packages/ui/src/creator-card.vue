<template>
  <article class="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-md">
    <div class="relative h-48 bg-gradient-to-br from-slate-100 to-slate-200">
      <img
        v-if="image"
        :src="image"
        :alt="`${name} cover art`"
        class="h-full w-full object-cover"
      />
      <div
        v-else
        class="flex h-full items-center justify-center text-xs font-semibold uppercase tracking-[0.2em] text-slate-500"
      >
        Underground
      </div>
    </div>

    <div class="space-y-3 p-4">
      <div class="flex items-start justify-between gap-3">
        <h3 class="text-lg font-semibold text-slate-900">{{ name }}</h3>
        <GenreBadge :genre="genre" />
      </div>

      <p class="text-sm text-slate-600">{{ location }}</p>

      <p v-if="bio" class="text-sm leading-6 text-slate-700">
        {{ bio }}
      </p>

      <slot />
    </div>
  </article>
</template>

<script setup lang="ts">
import GenreBadge from "./genre-badge.vue";

interface CreatorCardProps {
  name: string;
  genre: string;
  location: string;
  image?: string;
  bio?: string;
}

defineProps<CreatorCardProps>();
</script>
