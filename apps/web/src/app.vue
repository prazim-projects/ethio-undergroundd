<template>
  <div class="app-shell" :class="{ 'has-player': playingWork }">
    <aside class="sidebar">
      <RouterLink to="/" class="brand" aria-label="Ethio Underground home"><AudioLines :size="30" /><span>ETHIO<br /><strong>UNDERGROUND</strong></span></RouterLink>
      <span class="sidebar-caption">YOUR NEXT DISCOVERY</span>
      <nav aria-label="Primary navigation"><RouterLink v-for="item in navigation" :key="item.path" :to="item.path" :class="{ active: page === item.page }" :aria-current="page === item.page ? 'page' : undefined"><component :is="item.icon" :size="20" /><span>{{ item.label }}</span></RouterLink></nav>
      <div class="sidebar-bottom"><span class="tibeb-mark" aria-hidden="true"></span><p>Independent voices.<br />Made here. Heard everywhere.</p><span class="city-stamp">ADDIS ABABA · ETHIOPIA</span></div>
    </aside>
    <header class="shell-header"><div class="topbar">
      <RouterLink to="/" class="mobile-brand"><AudioLines :size="23" /><strong>UNDERGROUND</strong></RouterLink>
      <form class="global-search" role="search" @submit.prevent="submitSearch"><Search :size="18" /><input v-model="search" aria-label="Search music and creators" placeholder="Search tracks, artists, cities..." /><button type="submit" aria-label="Submit search" title="Search"><ArrowUpRight :size="18" /></button></form>
      <RouterLink to="/publish" class="upload-link"><Upload :size="17" /><span>Upload</span></RouterLink>
      <RouterLink to="/profile" class="account-link" :aria-label="user ? 'Your profile' : 'Sign in'"><UserRound :size="19" /><span>{{ user?.displayName || 'Sign in' }}</span></RouterLink>
    </div></header>
    <main ref="content" class="shell-content"><div class="page-content">
      <div v-if="!online" class="notice" role="status"><WifiOff :size="18" />You are offline. Reconnect to load and play tracks.</div>
      <div v-if="needRefresh" class="notice">An update is ready.<button @click="updateServiceWorker(true)">Update app</button></div>
      <header class="page-heading"><div><p class="eyebrow">{{ page === 'home' ? 'FROM ETHIOPIA, WITH SOUND' : 'ETHIO UNDERGROUND' }}</p><h1>{{ title }}</h1><p>{{ subtitle }}</p></div><button v-if="installPrompt" class="secondary-button" @click="installApp"><Download :size="16" />Install app</button></header>
      <template v-if="['home', 'search', 'creator', 'work'].includes(page)">
        <div v-if="page === 'home' || page === 'search'" class="browse-tabs" aria-label="Browse work type"><button v-for="type in types" :key="type.value" :class="{ active: filter === type.value }" :aria-pressed="filter === type.value" @click="setFilter(type.value)">{{ type.label }}</button></div>
        <div v-if="loading" class="loading-state" role="status"><span class="loading-spinner" aria-hidden="true"></span>Loading the catalog...</div>
        <div v-else-if="error" class="empty-state" role="alert"><WifiOff :size="30" /><h2>Could not load the catalog</h2><p>{{ error }}</p><button class="primary-button" @click="refresh">Try again</button></div>
        <template v-else>
          <section v-if="page === 'home' && music.length && !filter" class="release-section" aria-labelledby="rotation-title"><div class="section-heading"><h2 id="rotation-title">In rotation</h2><span>Independent sounds, on repeat</span></div><div class="release-grid"><article v-for="work in music.slice(0, 4)" :key="work.id" class="release">
            <button class="release-cover" :aria-label="`Play ${work.title}`" @click="openWork(work)"><WorkArtwork :work="work" /><span class="release-play"><Play :size="23" fill="currentColor" /></span></button><button class="release-title" @click="openWork(work)">{{ work.title }}</button><RouterLink :to="creatorProfilePath(work.creator.publicId)">{{ work.creator.displayName }}</RouterLink><span>{{ work.creator.location || 'Independent release' }}</span>
          </article></div></section>
          <section v-if="page === 'creator' && selectedCreator" class="artist-heading"><img v-if="selectedCreator.avatar" :src="mediaUrl(selectedCreator.avatar)" :alt="selectedCreator.displayName" /><div v-else class="artist-avatar"><Mic2 :size="32" /></div><div><h2>{{ selectedCreator.displayName }}</h2><p>{{ selectedCreator.location }}</p><p>{{ selectedCreator.bio }}</p></div></section>
          <div class="catalog-layout"><section class="track-section" aria-label="Published works"><div class="section-heading"><h2>{{ page === 'search' ? 'Search results' : page === 'creator' ? 'Discography & works' : page === 'work' ? 'Release' : 'The local rotation' }}</h2><span>{{ visibleWorks.length }} {{ visibleWorks.length === 1 ? 'work' : 'works' }}</span></div>
            <div v-if="visibleWorks.length" class="track-list"><WorkRow v-for="(work, index) in visibleWorks" :key="work.id" :work="work" :index="index" :active="playingWork?.id === work.id" @open="openWork" @share="shareWork" @pay="payForWork" /></div>
            <div v-else class="empty-state"><Disc3 :size="38" /><h2>{{ page === 'search' ? 'No matches this time' : 'The next release starts here' }}</h2><p>{{ page === 'search' ? 'Try another artist, title, or city.' : 'There are no published works in this selection yet.' }}</p><RouterLink to="/publish" class="primary-button">Upload a work</RouterLink></div>
          </section><aside v-if="page === 'home' || page === 'search'" class="artist-column"><div class="section-heading"><h2>Behind the sound</h2><Mic2 :size="18" /></div><RouterLink v-for="profile in profiles.slice(0, 5)" :key="profile.id" :to="creatorProfilePath(profile.publicId)" class="artist-row"><img v-if="profile.avatar" :src="mediaUrl(profile.avatar)" :alt="profile.displayName" loading="lazy" /><span v-else class="artist-avatar">{{ profile.displayName.slice(0, 2) }}</span><span><strong>{{ profile.displayName }}</strong><small>{{ profile.location || 'Independent creator' }}</small></span><ChevronRight :size="16" /></RouterLink><p v-if="!profiles.length" class="muted">Artists will appear here as they publish.</p><div class="local-note"><span class="tibeb-mark" aria-hidden="true"></span><h3>Keep it independent.</h3><p>Music, words, and images from Ethiopia's creative community.</p><RouterLink to="/publish">Add your voice <ArrowUpRight :size="16" /></RouterLink></div></aside></div>
        </template>
      </template>
      <div v-else-if="page === 'publish'" class="account-layout"><AuthPanel v-if="!isAuthenticated" /><WorkUpload @go-profile="router.push('/profile')" @uploaded="router.push('/')" /></div>
      <MyCreations v-else-if="page === 'creations'" />
      <div v-else-if="page === 'profile'" class="account-layout"><AuthPanel /><ProfilePanel v-if="isAuthenticated" /></div>
      <div v-else class="empty-state"><h2>Page not found</h2><RouterLink to="/">Back to Discover</RouterLink></div>
      <footer class="page-footer"><span>ETHIO UNDERGROUND</span><span>Independent by nature.</span><span class="flag-lines" aria-hidden="true"><i></i><i></i><i></i></span></footer>
    </div></main>
    <MusicPlayer v-if="playingWork" :work="playingWork" :queue="music" :selection="selection" @select="playWork" @played="countWork" @error="notify" />
    <nav class="mobile-nav" aria-label="Mobile navigation"><RouterLink v-for="item in navigation" :key="item.path" :to="item.path" :class="{ active: page === item.page }"><component :is="item.icon" :size="20" /><span>{{ item.label }}</span></RouterLink></nav>
    <WorkViewer :work="viewedWork" @close="viewedWork = null" @viewed="countWork" @pay="payForWork" />
    <div v-if="message" class="app-toast" role="status">{{ message }}</div>
  </div>
</template>
<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter, RouterLink } from 'vue-router';
import { AudioLines, Search, Upload, UserRound, Compass, Library, ArrowUpRight, Play, Mic2, Disc3, ChevronRight, Download, WifiOff } from 'lucide-vue-next';
import { useRegisterSW } from 'virtual:pwa-register/vue';
import { useCatalog, type CreativeWork } from './composables/use-catalog';
import { useAuth } from './composables/use-auth';
import { creatorProfilePath, mediaUrl, recordWorkPlay, initiateTelebirrPayment } from './lib/graphql';
import { mediaKind } from './lib/media';
import WorkArtwork from './components/WorkArtwork.vue';
import WorkRow from './components/WorkRow.vue';
import MusicPlayer from './components/MusicPlayer.vue';
import WorkViewer from './components/WorkViewer.vue';
const AuthPanel = defineAsyncComponent(() => import('./components/AuthPanel.vue'));
const ProfilePanel = defineAsyncComponent(() => import('./components/ProfilePanel.vue'));
const WorkUpload = defineAsyncComponent(() => import('./components/WorkUpload.vue'));
const MyCreations = defineAsyncComponent(() => import('./components/MyCreations.vue'));
const router = useRouter();
const route = useRoute();
const { profiles, works, selectedCreator, selectedWork, loading, error, load, loadCreator, loadWork, updateStats } = useCatalog();
const { user, isAuthenticated } = useAuth();
const { needRefresh, updateServiceWorker } = useRegisterSW();
const content = ref<HTMLElement>();
const search = ref('');
const filter = computed(() => String(route.query.type || ''));
const message = ref('');
const playingWork = ref<CreativeWork | null>(null);
const viewedWork = ref<CreativeWork | null>(null);
const selection = ref(0);
const online = ref(navigator.onLine);
type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
const installPrompt = ref<InstallPrompt | null>(null);
const navigation = [{ path: '/', page: 'home', label: 'Discover', icon: Compass }, { path: '/search', page: 'search', label: 'Search', icon: Search }, { path: '/publish', page: 'publish', label: 'Upload', icon: Upload }, { path: '/my-creations', page: 'creations', label: 'My works', icon: Library }, { path: '/profile', page: 'profile', label: 'Profile', icon: UserRound }];
const types = [{ value: '', label: 'Everything' }, { value: 'music', label: 'Music' }, { value: 'poetry', label: 'Spoken & written' }, { value: 'photography', label: 'Photography' }, { value: 'visual_art', label: 'Visual art' }, { value: 'videography', label: 'Film' }];
const page = computed(() => route.path.startsWith('/creators/') ? 'creator' : route.path.startsWith('/works/') ? 'work' : navigation.find((item) => item.path === route.path)?.page || 'missing');
const titles: Record<string, string> = { home: 'Find your frequency.', search: 'Dig a little deeper.', publish: 'Your next release.', creations: 'Your catalog.', profile: 'Your space.' };
const title = computed(() => page.value === 'creator' ? selectedCreator.value?.displayName || 'Artist' : page.value === 'work' ? selectedWork.value?.title || 'Release' : titles[page.value] || 'Lost in the mix.');
const subtitles: Record<string, string> = { home: 'Fresh sounds and independent voices from Ethiopia and beyond.', search: 'Find a track, a voice, or a new perspective.', creator: 'Independent artist', work: 'Public release', publish: 'Music. Words. Images. Make something heard.', creations: 'Your releases, their reach, and what comes next.', profile: 'A home for you and your sound.' };
const subtitle = computed(() => page.value === 'search' && search.value ? `Results for "${search.value}"` : subtitles[page.value] || '');
const visibleWorks = computed(() => page.value === 'creator' ? selectedCreator.value?.works ?? [] : page.value === 'work' ? selectedWork.value ? [selectedWork.value] : [] : works.value);
const music = computed(() => visibleWorks.value.filter((work) => mediaKind(work.file) === 'audio'));
function notify(value: string) { message.value = value; }
function submitSearch() { void router.push({ path: '/search', query: { q: search.value, ...(filter.value ? { type: filter.value } : {}) } }); }
function setFilter(value: string) { void router.push({ path: route.path, query: { ...route.query, type: value || undefined } }); }
async function refresh() {
  search.value = String(route.query.q || '');
  if (page.value === 'creator') await loadCreator(decodeURIComponent(route.path.split('/').pop()!));
  else if (page.value === 'work') await loadWork(route.path.split('/').pop()!.replace(/^work-/, ''));
  else if (page.value === 'home' || page.value === 'search') await load(search.value, filter.value);
}
function playWork(work: CreativeWork) { playingWork.value = work; selection.value++; }
function openWork(work: CreativeWork) {
  if (mediaKind(work.file) === 'audio') playWork(work);
  else viewedWork.value = work;
}
async function countWork(work: CreativeWork) {
  try { const stats = await recordWorkPlay(work.id); updateStats(work.id, stats); work.playCount = Math.max(work.playCount, stats.playCount); work.downloadCount = Math.max(work.downloadCount, stats.downloadCount); }
  catch { notify('Playback is available, but this play or view could not be recorded.'); }
}
async function shareWork(work: CreativeWork) {
  const url = `${location.origin}/works/work-${encodeURIComponent(work.id)}`;
  try { if (navigator.share) await navigator.share({ title: work.title, url }); else { await navigator.clipboard.writeText(url); notify('Release link copied.'); } }
  catch (err) { if (!(err instanceof DOMException && err.name === 'AbortError')) notify(url); }
}
async function payForWork(work: CreativeWork) { try { const payment = await initiateTelebirrPayment(work.id); location.assign(payment.checkoutUrl); } catch (err) { notify(err instanceof Error ? err.message : 'Payment is unavailable.'); } }
function networkChanged() { online.value = navigator.onLine; }
function beforeInstall(event: Event) { event.preventDefault(); installPrompt.value = event as InstallPrompt; }
async function installApp() { await installPrompt.value?.prompt(); installPrompt.value = null; }
watch(() => route.fullPath, () => { viewedWork.value = null; content.value?.scrollTo({ top: 0, behavior: 'auto' }); void refresh(); }, { immediate: true });
onMounted(() => { window.addEventListener('online', networkChanged); window.addEventListener('offline', networkChanged); window.addEventListener('beforeinstallprompt', beforeInstall); });
onUnmounted(() => { window.removeEventListener('online', networkChanged); window.removeEventListener('offline', networkChanged); window.removeEventListener('beforeinstallprompt', beforeInstall); });
</script>
