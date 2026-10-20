import { computed, onMounted, onUnmounted, ref } from 'vue';
import { Capacitor } from '@capacitor/core';

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };
const prompt = ref<InstallPrompt | null>(null);
const native = Capacitor.isNativePlatform();
const installed = ref(native || window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
const message = ref('');
const installing = ref(false);

export function useInstall() {
  function beforeInstall(event: Event) { event.preventDefault(); prompt.value = event as InstallPrompt; }
  function appInstalled() { installed.value = true; prompt.value = null; message.value = 'Underground is installed. Open it from your home screen or app launcher.'; }
  onMounted(() => { window.addEventListener('beforeinstallprompt', beforeInstall); window.addEventListener('appinstalled', appInstalled); });
  onUnmounted(() => { window.removeEventListener('beforeinstallprompt', beforeInstall); window.removeEventListener('appinstalled', appInstalled); });
  async function install() {
    message.value = '';
    if (!prompt.value) { message.value = 'Follow the steps below for your browser. If you are in another app’s browser, open this site in Chrome or Safari first.'; return; }
    const current = prompt.value;
    installing.value = true;
    try {
      await current.prompt();
      const choice = await current.userChoice;
      message.value = choice.outcome === 'accepted' ? 'Installation requested. Your browser will finish adding Underground.' : 'Installation dismissed. You can install later using your browser menu.';
    } catch { message.value = 'Use the browser menu to install Underground with the steps below.'; }
    finally { if (prompt.value === current) prompt.value = null; installing.value = false; }
  }
  return { installed, native, message, installing, canPrompt: computed(() => Boolean(prompt.value)), install };
}
