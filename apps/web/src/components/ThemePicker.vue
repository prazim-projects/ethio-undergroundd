<template>
  <label class="theme-picker">
    <Sun v-if="theme === 'light'" :size="16" aria-hidden="true" />
    <Moon v-else-if="theme === 'dark'" :size="16" aria-hidden="true" />
    <Sparkles v-else :size="16" aria-hidden="true" />
    <span class="sr-only">Color theme</span>
    <select :value="theme" aria-label="Color theme" @change="setTheme(($event.target as HTMLSelectElement).value)">
      <option v-for="option in themeOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
    </select>
  </label>
</template>
<script setup lang="ts">
import { Sun, Moon, Sparkles } from 'lucide-vue-next';
import { useTheme } from '../composables/use-theme';
const { theme, setTheme, themeOptions } = useTheme();
</script>
