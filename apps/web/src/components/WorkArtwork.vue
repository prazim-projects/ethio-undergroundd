<template>
  <div class="artwork" :class="`artwork--${Number(work.id) % 3}`">
    <img v-if="source && !failed" :src="source" :alt="work.title" loading="lazy" decoding="async" @error="failed = true" />
    <div v-else class="record-sleeve" aria-hidden="true"><Disc3 :size="64" :stroke-width="1" /><span>{{ work.creator.displayName }}</span></div>
  </div>
</template>
<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Disc3 } from "lucide-vue-next";
import { mediaKind } from "../lib/media";
import { mediaUrl, workStreamUrl } from "../lib/graphql";
import type { CreativeWork } from "../composables/use-catalog";
const props = defineProps<{ work: CreativeWork }>();
const failed = ref(false);
const source = computed(() => mediaUrl(props.work.thumbnail) || (mediaKind(props.work.file) === "image" ? workStreamUrl(props.work.id) : undefined));
watch(source, () => { failed.value = false; });
</script>
