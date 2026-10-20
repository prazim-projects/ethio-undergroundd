import { readonly, ref } from 'vue';

export type Theme = 'light' | 'dark' | 'abyssinia';
export const THEME_KEY = 'underground_theme';
export const themeOptions = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'abyssinia', label: 'Abyssinia' },
] as const;
const isTheme = (value: unknown): value is Theme => themeOptions.some((option) => option.value === value);
const theme = ref<Theme>(isTheme(document.documentElement.dataset.theme) ? document.documentElement.dataset.theme : 'light');
const chromeColors: Record<Theme, string> = { light: '#171d19', dark: '#111916', abyssinia: '#20150e' };

function apply(value: Theme) {
  theme.value = value;
  document.documentElement.dataset.theme = value;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', chromeColors[value]);
}
apply(theme.value);
window.addEventListener('storage', (event) => {
  if (event.key === THEME_KEY) apply(isTheme(event.newValue) ? event.newValue : 'light');
});

export function useTheme() {
  function setTheme(value: string) {
    if (!isTheme(value)) return;
    apply(value);
    try { localStorage.setItem(THEME_KEY, value); } catch { /* Keep the in-session choice when storage is disabled. */ }
  }
  return { theme: readonly(theme), setTheme, themeOptions };
}
