<template>
  <span class="abyssinia-portrait" :class="`abyssinia-portrait--${variant % 3}`" aria-hidden="true"></span>
</template>
<script setup lang="ts">
defineProps<{ variant: number }>();
</script>
