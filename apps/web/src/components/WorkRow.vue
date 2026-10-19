<template>
  <article class="track-row" :class="{ 'track-row--active': active }" :data-work-id="work.id">
    <span class="track-number">{{ String(index + 1).padStart(2, '0') }}</span>
    <button class="artwork-button" :aria-label="`${isAudio ? 'Play' : 'View'} ${work.title}`" @click="$emit('open', work)"><WorkArtwork :work="work" /><span class="artwork-action"><Play v-if="isAudio" :size="20" /><Eye v-else :size="20" /></span></button>
    <div class="track-info"><button class="track-title" @click="$emit('open', work)">{{ work.title }}</button><RouterLink :to="creatorProfilePath(work.creator.publicId)">{{ work.creator.displayName }}</RouterLink><span class="track-type">{{ work.workType.toLowerCase().replace('_', ' ') }}</span></div>
    <span class="track-count" :aria-label="`${work.playCount} plays and views`"><Headphones :size="14" />{{ work.playCount.toLocaleString() }}</span>
    <button v-if="work.isPayable" class="track-price text-button" @click="$emit('pay', work)">Pay {{ work.priceEtb }} ETB</button><span v-else class="track-price">Free</span>
    <button class="icon-button" :aria-label="`Share ${work.title}`" title="Share" @click="$emit('share', work)"><Share2 :size="18" /></button>
  </article>
</template>
<script setup lang="ts">
import { computed } from "vue";
import { RouterLink } from "vue-router";
import { Play, Eye, Headphones, Share2 } from "lucide-vue-next";
import WorkArtwork from "./WorkArtwork.vue";
import { creatorProfilePath } from "../lib/graphql";
import { mediaKind } from "../lib/media";
import type { CreativeWork } from "../composables/use-catalog";
const props = defineProps<{ work: CreativeWork; index: number; active?: boolean }>();
const isAudio = computed(() => mediaKind(props.work.file) === "audio");
defineEmits<{ open: [work: CreativeWork]; share: [work: CreativeWork]; pay: [work: CreativeWork] }>();
</script>
