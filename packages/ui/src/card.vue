<template>
  <div class="p-4 border rounded shadow hover:bg-gray-50">
    <h3 class="font-bold text-xl">{{ name }}</h3>
    <p class="text-sm text-gray-600">{{ genre }} • {{ location }}</p>
    <slot name="footer"></slot>
  </div>
</template>

<script setup>
defineProps(['name', 'genre', 'location'])
</script>
