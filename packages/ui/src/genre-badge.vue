<template>
  <span :class="badgeClass">
    {{ genre }}
  </span>
</template>

<script setup lang="ts">
import { computed } from "vue";

interface GenreBadgeProps {
  genre: string;
}

const props = defineProps<GenreBadgeProps>();

const toneMap: Record<string, string> = {
  indie: "bg-amber-100 text-amber-800 border-amber-300",
  jazz: "bg-blue-100 text-blue-800 border-blue-300",
  electronic: "bg-cyan-100 text-cyan-800 border-cyan-300",
  hiphop: "bg-rose-100 text-rose-800 border-rose-300",
  rock: "bg-slate-200 text-slate-900 border-slate-400",
};

const badgeClass = computed(() => {
  const normalized = props.genre.toLowerCase().replace(/\s+/g, "");
  const palette = toneMap[normalized] ?? "bg-emerald-100 text-emerald-800 border-emerald-300";

  return [
    "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide",
    palette,
  ];
});
</script>
