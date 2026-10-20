<template>
  <section class="install-panel" aria-label="Get the Underground app">
    <div class="install-cards">
      <article class="install-card">
        <Download :size="28" aria-hidden="true" /><span class="eyebrow">FOR YOUR PHONE OR COMPUTER</span><h2>Install the web app.</h2>
        <p>Keep Underground on your home screen. Enjoy a full-screen experience, your chosen theme, and works you save for offline listening.</p>
        <p v-if="installed" class="upload-panel__message" role="status">{{ native ? 'You are using the Android app.' : 'Already running as an installed app.' }}</p>
        <button v-else class="primary-button" :disabled="installing" @click="install">{{ installing ? 'Opening installer…' : canPrompt ? 'Install web app' : 'Show installation steps' }}</button>
        <p v-if="message" class="install-feedback" role="status">{{ message }}</p>
      </article>
      <article class="install-card">
        <Smartphone :size="28" aria-hidden="true" /><span class="eyebrow">ANDROID 7 AND NEWER</span><h2>Get the Android app.</h2>
        <p>The Android preview includes native camera capture and private offline storage. Download the APK, open it, and follow Android’s installation steps.</p>
        <a :href="apkUrl" class="primary-button" download="ethio-underground.apk">Download Android preview (.apk) <ArrowDownToLine :size="16" aria-hidden="true" /></a>
        <p class="install-note">Preview build. Android may ask you to allow installation from this browser.</p>
      </article>
    </div>
    <section class="install-instructions" aria-labelledby="install-steps"><h2 id="install-steps">Add it to your home screen.</h2>
      <div class="install-steps">
        <article><h3>Android · Chrome</h3><ol><li>Open this site in Chrome.</li><li>Open the ⋮ menu and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li><li>Confirm, then launch Underground from your app list.</li></ol></article>
        <article><h3>iPhone & iPad · Safari</h3><ol><li>Open this site in Safari.</li><li>Tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>.</li><li>Turn on <strong>Open as Web App</strong> if shown, then tap <strong>Add</strong>.</li></ol></article>
        <article><h3>Desktop · Chrome or Edge</h3><ol><li>Open this site in Chrome or Edge.</li><li>Use the install icon in the address bar, or the browser’s app installation menu.</li><li>Confirm to launch Underground in its own window.</li></ol></article>
      </div>
      <p class="install-note">To use works offline, sign in, open a work and choose Save offline. The website remains available without installing.</p>
    </section>
  </section>
</template>
<script setup lang="ts">
import { ArrowDownToLine, Download, Smartphone } from 'lucide-vue-next';
import { useInstall } from '../composables/use-install';
import { ANDROID_APK_URL as apkUrl } from '../lib/deployment';
const { installed, native, message, installing, canPrompt, install } = useInstall();
</script>
