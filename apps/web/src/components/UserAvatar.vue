<template>
  <span class="user-avatar"><img v-if="source && !failed" :src="source" alt="" @error="failed = true" /><span v-else aria-hidden="true">{{ (user?.displayName || user?.username || '?').slice(0, 2).toUpperCase() }}</span></span>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useAuth } from '../composables/use-auth';
import { mediaUrl } from '../lib/graphql';
const { user } = useAuth();
const source = computed(() => mediaUrl(user.value?.avatar));
const failed = ref(false);
watch(source, () => { failed.value = false; });
</script>
