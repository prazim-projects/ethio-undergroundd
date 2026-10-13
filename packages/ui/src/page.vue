<template>
  <main class="min-h-screen bg-slate-50 px-6 py-10 text-slate-900">
    <div class="mx-auto max-w-6xl">
      <header class="mb-10 border-b border-slate-200 pb-6">
        <p class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Shared workspace app</p>
        <h1 class="mt-2 text-4xl font-bold tracking-tight">{{ appName }}</h1>
      </header>
      <slot />
    </div>
  </main>
</template>

<script setup lang="ts">
defineProps<{ appName: string }>();
</script>
