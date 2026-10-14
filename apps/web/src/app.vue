<template>
  <main class="app-shell">
    <nav class="app-nav" aria-label="Primary navigation">
      <a href="/" class="app-nav__link" :class="{ active: currentPage === 'home' }" @click.prevent="goTo('/')">Discover</a>
      <a href="/search" class="app-nav__link" :class="{ active: currentPage === 'search' }" @click.prevent="goTo('/search')">Search</a>
      <a href="/publish" class="app-nav__link" :class="{ active: currentPage === 'publish' }" @click.prevent="goTo('/publish')">Publish</a>
      <a href="/my-creations" class="app-nav__link" :class="{ active: currentPage === 'creations' }" @click.prevent="goTo('/my-creations')">Creations</a>
      <a href="/profile" class="app-nav__link app-nav__profile" :class="{ active: currentPage === 'profile' }" @click.prevent="goTo('/profile')">
        <span class="app-nav__avatar">{{ userInitials }}</span>
        <span>Profile</span>
      </a>
    </nav>

    <div class="app-content">
      <header class="page-hero">
        <p class="eyebrow">Addis sound archive / 2026</p>
        <h1>{{ pageTitle }}</h1>
        <p>{{ pageIntro }}</p>
        <div class="catalog-count">{{ creatorCards.length }} creators / {{ catalogItems.length }} works</div>
      </header>

      <section v-if="selectedAudioWork" class="now-playing-bar" :class="{ 'now-playing-bar--minimized': playerMinimized }" aria-label="Now playing">
        <div class="now-playing-bar__art">
          <img v-if="selectedAudioArtwork" :src="selectedAudioArtwork" :alt="selectedAudioWork.title" />
          <span v-else>{{ selectedAudioWork.creatorName.slice(0, 2).toUpperCase() }}</span>
        </div>
        <div class="now-playing-bar__main">
          <div class="now-playing-bar__meta">
            <span class="eyebrow">Now playing</span>
            <strong>{{ selectedAudioWork.title }}</strong>
            <small>{{ selectedAudioWork.creatorName }}</small>
          </div>
          <div class="now-playing-bar__wave" aria-hidden="true">
            <span v-for="bar in waveformBars" :key="bar" :style="{ height: `${10 + ((bar * 7) % 24)}px` }"></span>
          </div>
          <input class="now-playing-bar__progress" type="range" min="0" max="100" step="0.1" :value="playbackProgress" aria-label="Playback progress" @input="seekPlayer" />
          <audio ref="topAudio" :src="selectedAudioWork.streamUrl" preload="metadata" @loadedmetadata="syncPlayerProgress" @timeupdate="syncPlayerProgress" @play="handleTopAudioPlay" @pause="isTopPlaying = false" @ended="handleAudioEnded"></audio>
        </div>
        <div class="now-playing-bar__controls">
          <select v-model="nextPlayMode" aria-label="Play next mode">
            <option value="creator">This creator catalog</option>
            <option value="random">Random creator discovery</option>
          </select>
          <button class="icon-button" type="button" aria-label="Shuffle next audio work" @click="shuffleNextAudioWork">Shuffle</button>
          <button class="icon-button" type="button" aria-label="Previous audio work" @click="playPreviousAudioWork">Back</button>
          <button class="icon-button icon-button--play" type="button" :aria-label="isTopPlaying ? 'Pause' : 'Play'" @click="toggleTopPlayback">{{ isTopPlaying ? "Pause" : "Play" }}</button>
          <button class="icon-button" type="button" aria-label="Next audio work" @click="playNextAudioWork">Next</button>
          <button class="icon-button" type="button" :class="{ active: repeatAudioWork }" aria-label="Repeat audio work" @click="repeatAudioWork = !repeatAudioWork">Repeat</button>
          <a class="audio-player__download" :href="selectedAudioWork.downloadUrl">Download</a>
          <button class="icon-button now-playing-bar__minimize" type="button" :aria-label="playerMinimized ? 'Expand player' : 'Minimize player'" @click="playerMinimized = !playerMinimized">{{ playerMinimized ? "Expand" : "Min" }}</button>
        </div>
      </section>

      <template v-if="currentPage === 'home'">
        <section class="feature-strip">
          <div>
            <span class="eyebrow">Ethiopian underground</span>
            <h2>New releases from Addis, Dire Dawa, Mekelle, Bahir Dar, and the diaspora.</h2>
          </div>
          <button class="primary-button" type="button" @click="goTo('/search')">Search catalog</button>
        </section>

        <p v-if="loading" class="py-12 text-center text-[#68716a]">Tuning into the catalog...</p>
        <div v-else-if="error" class="rounded-2xl border border-[#c76d4b] bg-[#fff2eb] p-5 text-[#8f3f25]">
          <strong>Could not reach the catalog.</strong>
          <p class="mt-1 text-sm">{{ error }} Start Django on port 8000, then reload this page.</p>
        </div>

        <section v-else class="grid gap-10 lg:grid-cols-[1fr_22rem]">
          <div>
            <section v-if="popularCreators.length" class="popular-creators">
              <div class="mb-4 flex items-center justify-between">
                <h2 class="text-2xl font-semibold">Popular creators</h2>
                <span class="text-sm text-[#68716a]">Top {{ popularCreators.length }}</span>
              </div>
              <div class="creator-grid">
                <article v-for="creator in popularCreators" :key="creator.id" class="creator-card creator-card--popular" @click="viewCreator(creator)">
                  <img v-if="creator.image" class="creator-card__avatar" :src="creator.image" :alt="creator.name" />
                  <div v-else class="creator-card__avatar creator-card__avatar--empty">{{ creator.name.slice(0, 2).toUpperCase() }}</div>
                  <span class="eyebrow">{{ creator.kind }}</span>
                  <h3>{{ creator.name }}</h3>
                  <p>{{ creator.popularity }} popularity points</p>
                </article>
              </div>
            </section>
            <div class="mb-4 flex items-center justify-between">
              <h2 class="text-2xl font-semibold">Creators</h2>
              <span class="text-sm text-[#68716a]">{{ creatorCards.length }} profiles</span>
            </div>
            <div v-if="creatorCards.length" class="creator-grid">
              <article v-for="creator in creatorCards" :key="creator.id" class="creator-card" @click="viewCreator(creator)">
                <img v-if="creator.image" class="creator-card__avatar" :src="creator.image" :alt="creator.name" />
                <div v-else class="creator-card__avatar creator-card__avatar--empty">{{ creator.name.slice(0, 2).toUpperCase() }}</div>
                <span class="eyebrow">{{ creator.kind }}</span>
                <h3>{{ creator.name }}</h3>
                <p>{{ creator.location || "Ethiopia" }}</p>
                <p>{{ creator.popularity }} popularity points</p>
                <p v-if="creator.bio">{{ creator.bio }}</p>
              </article>
            </div>
            <div v-else class="empty-state">No creators are published yet.</div>
          </div>

          <aside class="space-y-4 lg:sticky lg:top-6 lg:self-start">
            <AudioWorkList :works="playableItems" @select="selectAudioWork" />
          </aside>
        </section>
      </template>

      <template v-else-if="currentPage === 'search'">
        <section class="search-panel">
          <form class="search-panel__form" @submit.prevent="submitSearch">
            <input v-model="searchDraft" type="search" placeholder="Search creators, cities, genres, and works" aria-label="Search catalog" />
            <select v-model="selectedWorkType" aria-label="Filter by art type">
              <option value="">All art types</option>
              <option v-for="type in workTypes" :key="type" :value="type">{{ formatType(type) }}</option>
            </select>
            <select v-if="selectedWorkType === 'music'" v-model="selectedMusicGenre" aria-label="Filter music by genre">
              <option value="">All music genres</option>
              <option v-for="genre in genres" :key="genre" :value="genre">{{ genre }}</option>
            </select>
            <button class="primary-button" type="submit">Search</button>
          </form>
        </section>
        <section class="grid gap-8 lg:grid-cols-[1fr_22rem]">
          <div>
            <div class="mb-4 flex items-center justify-between">
              <h2 class="text-2xl font-semibold">Works</h2>
              <span class="text-sm text-[#68716a]">{{ visibleCatalogItems.length }} results</span>
            </div>
            <div v-if="visibleCatalogItems.length" class="work-list">
              <article v-for="work in visibleCatalogItems" :key="work.key" class="work-row">
                <div class="work-row__media" :class="{ 'work-row__media--locked': work.isPayable }">
                  <img v-if="work.thumbnail" class="work-row__thumb" :src="work.thumbnail" :alt="work.title" />
                  <video v-else-if="work.typeKey === 'videography'" class="work-row__thumb" :src="work.fileUrl || work.viewUrl" muted preload="metadata" playsinline></video>
                  <div v-else class="work-row__thumb work-row__thumb--empty">{{ work.type }}</div>
                </div>
                <div class="work-row__body">
                  <span class="eyebrow">{{ work.type }}</span>
                  <h3>{{ work.title }}</h3>
                  <p>{{ work.description || "Published by " + work.creatorName }}</p>
                  <p class="work-row__stats">{{ work.playCount }} views / plays / {{ work.downloadCount }} downloads</p>
                </div>
                <div class="work-row__actions">
                  <button v-if="work.typeKey === 'music'" class="text-button" type="button" @click="playCatalogItem(work)">Play</button>
                  <button v-if="work.isPayable" class="text-button" type="button" @click="payForWork(work)">Pay {{ work.priceEtb }} ETB</button>
                  <button class="text-button" type="button" @click="openViewer(work, visibleCatalogItems)">View</button>
                  <button class="text-button" type="button" @click="shareWork(work)">Share</button>
                  <a class="work-card__link" :href="work.openUrl" @click.prevent="goTo(work.openUrl)">Creator profile</a>
                </div>
              </article>
            </div>
            <div v-else class="empty-state">No works match that search.</div>

            <div class="mb-4 mt-8 flex items-center justify-between">
              <h2 class="text-2xl font-semibold">Creators</h2>
              <span class="text-sm text-[#68716a]">{{ filteredCreators.length }} results</span>
            </div>
            <div v-if="filteredCreators.length" class="creator-grid">
              <article v-for="creator in filteredCreators" :key="creator.id" class="creator-card" @click="viewCreator(creator)">
                <img v-if="creator.image" class="creator-card__avatar" :src="creator.image" :alt="creator.name" />
                <div v-else class="creator-card__avatar creator-card__avatar--empty">{{ creator.name.slice(0, 2).toUpperCase() }}</div>
                <span class="eyebrow">{{ creator.kind }}</span>
                <h3>{{ creator.name }}</h3>
                <p>{{ creator.location || "Ethiopia" }}</p>
                <p>{{ creator.popularity }} popularity points</p>
              </article>
            </div>
            <div v-else class="empty-state">No creators match that search.</div>
          </div>
          <aside class="space-y-4">
            <div class="empty-state empty-state--small">Search uses creator profiles and creative works. Music results are playable here too.</div>
            <AudioWorkList :works="filteredPlayableItems" @select="selectAudioWork" />
          </aside>
        </section>
      </template>

      <template v-else-if="currentPage === 'creator'">
        <section v-if="creatorDetail" class="creator-detail">
          <div class="creator-detail__header">
            <img v-if="creatorDetail.image" class="creator-card__avatar creator-detail__avatar" :src="creatorDetail.image" :alt="creatorDetail.name" />
            <div v-else class="creator-card__avatar creator-card__avatar--empty creator-detail__avatar">{{ creatorDetail.name.slice(0, 2).toUpperCase() }}</div>
            <div>
              <span class="eyebrow">{{ creatorDetail.kind }}</span>
              <h2>{{ creatorDetail.name }}</h2>
              <p>{{ creatorDetail.location || "Ethiopia" }}</p>
              <p v-if="creatorDetail.bio">{{ creatorDetail.bio }}</p>
              <p>{{ creatorDetail.popularity }} popularity points</p>
            </div>
          </div>
          <div class="grid gap-8 lg:grid-cols-[1fr_22rem]">
            <div>
              <h3 class="mb-4 text-2xl font-semibold">Works by {{ creatorDetail.name }}</h3>
              <div v-if="creatorWorks.length" class="work-list">
                <article v-for="work in creatorWorks" :key="work.key" class="work-row">
                  <div class="work-row__media" :class="{ 'work-row__media--locked': work.isPayable }">
                    <img v-if="work.thumbnail" class="work-row__thumb" :src="work.thumbnail" :alt="work.title" />
                    <video v-else-if="work.typeKey === 'videography'" class="work-row__thumb" :src="work.fileUrl || work.viewUrl" muted preload="metadata" playsinline></video>
                    <div v-else class="work-row__thumb work-row__thumb--empty">{{ work.type }}</div>
                  </div>
                  <div class="work-row__body">
                    <span class="eyebrow">{{ work.type }}</span>
                    <h3>{{ work.title }}</h3>
                    <p>{{ work.description || "Published by " + work.creatorName }}</p>
                    <p class="work-row__stats">{{ work.playCount }} views / plays / {{ work.downloadCount }} downloads</p>
                  </div>
                  <div class="work-row__actions">
                    <button v-if="work.typeKey === 'music'" class="text-button" type="button" @click="playCatalogItem(work)">Play</button>
                    <button v-if="work.isPayable" class="text-button" type="button" @click="payForWork(work)">Pay {{ work.priceEtb }} ETB</button>
                    <button class="text-button" type="button" @click="openViewer(work, creatorWorks)">View</button>
                    <button class="text-button" type="button" @click="shareWork(work)">Share</button>
                    <a class="work-card__link" :href="work.openUrl" @click.prevent="goTo(work.openUrl)">Creator profile</a>
                  </div>
                </article>
              </div>
              <div v-else class="empty-state">No works are published for this creator yet.</div>
            </div>
            <aside class="space-y-4">
              <AudioWorkList :works="creatorPlayableItems" @select="selectAudioWork" />
            </aside>
          </div>
        </section>
        <p v-else-if="loading" class="py-12 text-center text-[#68716a]">Loading creator profile...</p>
        <div v-else class="empty-state">That creator page could not be found.</div>
      </template>

      <template v-else-if="currentPage === 'publish'">
        <section class="grid gap-5 lg:grid-cols-[.85fr_1.15fr]">
          <AuthPanel />
          <WorkUpload @go-profile="goTo('/profile')" @uploaded="refreshCatalog" />
          <div v-if="!isAuthenticated" class="page-panel">
            <span class="eyebrow">Publish access</span>
            <h2>Sign in to publish.</h2>
            <p class="page-panel__intro">Creator accounts can upload music, photography, visual art, video, poetry, and other work from this page.</p>
          </div>
        </section>
      </template>

      <template v-else-if="currentPage === 'creations'">
        <MyCreations />
      </template>

      <template v-else-if="currentPage === 'work'">
        <section v-if="workDetail" class="work-detail">
          <div class="work-detail__media" :class="{ 'work-row__media--locked': workDetail.isPayable }">
            <img v-if="workDetail.thumbnail" :src="workDetail.thumbnail" :alt="workDetail.title" />
            <video v-else-if="workDetail.typeKey === 'videography'" :src="workDetail.fileUrl || workDetail.viewUrl" muted preload="metadata" playsinline></video>
            <div v-else class="work-row__thumb work-row__thumb--empty">{{ workDetail.type }}</div>
          </div>
          <div class="work-detail__body">
            <span class="eyebrow">{{ workDetail.type }}</span>
            <h2>{{ workDetail.title }}</h2>
            <p>{{ workDetail.description || "Published by " + workDetail.creatorName }}</p>
            <p class="work-row__stats">{{ workDetail.playCount }} views / plays / {{ workDetail.downloadCount }} downloads</p>
            <div class="work-row__actions">
              <button v-if="workDetail.typeKey === 'music'" class="text-button" type="button" @click="playCatalogItem(workDetail)">Play</button>
              <button v-if="workDetail.isPayable" class="text-button" type="button" @click="payForWork(workDetail)">Pay {{ workDetail.priceEtb }} ETB</button>
              <button class="text-button" type="button" @click="openViewer(workDetail, visibleCatalogItems)">View</button>
              <button class="text-button" type="button" @click="shareWork(workDetail)">Share</button>
              <a class="work-card__link" :href="workDetail.openUrl" @click.prevent="goTo(workDetail.openUrl)">Creator profile</a>
            </div>
          </div>
        </section>
        <p v-else-if="loading" class="py-12 text-center text-[#68716a]">Loading work...</p>
        <div v-else class="empty-state">That work could not be found.</div>
      </template>

      <template v-else>
        <section class="grid gap-5 lg:grid-cols-[.85fr_1.15fr]">
          <AuthPanel />
          <ProfilePanel />
        </section>
      </template>

      <p v-if="shareMessage" class="upload-panel__message">{{ shareMessage }}</p>

      <section v-if="!loading && !error && currentPage === 'home'" class="mt-14">
        <div class="mb-5 flex items-end justify-between">
          <div><span class="eyebrow">The open shelf</span><h2 class="mt-1 text-3xl font-semibold">Popular works</h2></div>
          <span class="text-sm text-[#68716a]">{{ popularCatalogItems.length }} shown</span>
        </div>
        <p v-if="paymentError" class="form-error">{{ paymentError }}</p>
        <div v-if="popularCatalogItems.length" class="work-list">
          <article v-for="work in popularCatalogItems" :key="work.key" class="work-row">
            <div class="work-row__media" :class="{ 'work-row__media--locked': work.isPayable }">
              <img v-if="work.thumbnail" class="work-row__thumb" :src="work.thumbnail" :alt="work.title" />
              <video v-else-if="work.typeKey === 'videography'" class="work-row__thumb" :src="work.fileUrl || work.viewUrl" muted preload="metadata" playsinline></video>
              <div v-else class="work-row__thumb work-row__thumb--empty">{{ work.type }}</div>
            </div>
            <div class="work-row__body">
              <span class="eyebrow">{{ work.type }}</span>
              <h3>{{ work.title }}</h3>
              <p>{{ work.description || "Published by " + work.creatorName }}</p>
              <p class="work-row__stats">{{ work.playCount }} views / plays / {{ work.downloadCount }} downloads</p>
            </div>
            <div class="work-row__actions">
              <button v-if="work.typeKey === 'music'" class="text-button" type="button" @click="playCatalogItem(work)">Play</button>
              <button v-if="work.isPayable" class="text-button" type="button" @click="payForWork(work)">Pay {{ work.priceEtb }} ETB</button>
              <button class="text-button" type="button" @click="openViewer(work, popularCatalogItems)">View</button>
              <button class="text-button" type="button" @click="shareWork(work)">Share</button>
              <a class="work-card__link" :href="work.openUrl" @click.prevent="goTo(work.openUrl)">Creator profile</a>
            </div>
          </article>
        </div>
        <div v-else class="empty-state">Popular works will appear here after they receive views or plays.</div>
      </section>

      <section v-if="mediaViewerOpen && activeMedia" class="media-viewer" role="dialog" aria-modal="true" aria-label="Work viewer">
        <div class="media-viewer__panel">
          <header class="media-viewer__header">
            <div>
              <span class="eyebrow">{{ activeMedia.type }}</span>
              <h2>{{ activeMedia.title }}</h2>
              <p>{{ activeMedia.creatorName }} / {{ activeMedia.playCount }} views / plays / {{ activeMedia.downloadCount }} downloads</p>
            </div>
            <button class="secondary-button" type="button" @click="closeViewer">Close</button>
          </header>

          <div class="media-viewer__stage">
            <template v-if="activeMediaKind === 'audio'">
              <div class="media-viewer__album-art">
                <img v-if="activeMedia.thumbnail" :src="activeMedia.thumbnail" :alt="activeMedia.title" />
                <div v-else class="media-viewer__album-empty">
                  <span>{{ activeMedia.creatorName.slice(0, 2).toUpperCase() }}</span>
                  <small>Album art</small>
                </div>
              </div>
              <audio ref="viewerAudio" :src="activeMedia.viewUrl" controls autoplay></audio>
            </template>

            <video v-else-if="activeMediaKind === 'video'" ref="viewerVideo" :src="activeMedia.viewUrl" controls autoplay playsinline></video>
            <img v-else-if="activeMediaKind === 'image'" class="media-viewer__image" :src="activeMedia.viewUrl || activeMedia.fileUrl" :alt="activeMedia.title" />
            <iframe v-else-if="activeMediaKind === 'document'" class="media-viewer__document" :src="activeMedia.viewUrl" :title="activeMedia.title"></iframe>
            <div v-else class="media-viewer__fallback">
              <p>This work type cannot be previewed inline yet.</p>
              <a class="work-card__link" :href="activeMedia.viewUrl" target="_blank" rel="noreferrer">Open file</a>
            </div>
          </div>

          <footer class="media-viewer__controls">
            <button class="secondary-button" type="button" @click="previousMedia">Previous</button>
            <button v-if="activeMediaKind === 'audio' || activeMediaKind === 'video'" class="secondary-button" type="button" @click="pauseViewerMedia">Pause</button>
            <button v-else-if="activeMediaKind === 'image'" class="secondary-button" type="button" @click="toggleSlideshow">{{ slideshowActive ? "Pause slides" : "Start slides" }}</button>
            <button v-if="activeMediaKind === 'audio' || activeMediaKind === 'video'" class="secondary-button" type="button" @click="fastForwardMedia">+15s</button>
            <button v-else-if="activeMediaKind === 'image'" class="secondary-button" type="button" @click="fastForwardMedia">Fast forward</button>
            <button class="secondary-button" type="button" @click="nextMedia">{{ activeMediaKind === "image" ? "Next slide" : "Next" }}</button>
            <button class="secondary-button" type="button" @click="shareWork(activeMedia)">Share</button>
            <button class="primary-button" type="button" @click="goTo(activeMedia.openUrl)">Creator profile</button>
          </footer>
        </div>
      </section>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { AudioWorkList } from "ui";
import type { AudioWorkListItem } from "ui";
import { creatorProfilePath, initiateTelebirrPayment, mediaUrl, recordWorkPlay, workDownloadUrl, workStreamUrl } from "./lib/graphql";
import { useCatalog } from "./composables/use-catalog";
import type { CatalogProfile } from "./composables/use-catalog";
import { useAuth } from "./composables/use-auth";
import AuthPanel from "./components/AuthPanel.vue";
import WorkUpload from "./components/WorkUpload.vue";
import ProfilePanel from "./components/ProfilePanel.vue";
import MyCreations from "./components/MyCreations.vue";

const { profiles, works, selectedCreator, loading, error, load, loadCreator } = useCatalog();
const { user, isAuthenticated } = useAuth();
const searchDraft = ref("");
const submittedSearch = ref("");
const selectedWorkType = ref("");
const selectedMusicGenre = ref("");
const currentPath = ref(window.location.pathname);
const paymentError = ref("");

interface PlayableItem extends AudioWorkListItem {
  key: string;
  streamUrl: string;
  downloadUrl: string;
  creatorName: string;
  description?: string;
  sourceType: "work";
  sourceId: string;
  isPayable: boolean;
  playCount: number;
  downloadCount: number;
}
interface CatalogItem {
  key: string;
  title: string;
  type: string;
  typeKey: string;
  genre: string;
  creatorId: string;
  creatorPublicId: string;
  creatorName: string;
  description?: string;
  thumbnail?: string;
  fileUrl?: string;
  openUrl: string;
  viewUrl: string;
  sharePath: string;
  playable?: PlayableItem;
  creatorProfilePath: string;
  isPayable: boolean;
  priceEtb: string;
  playCount: number;
  downloadCount: number;
}
interface CreatorCard {
  id: string;
  publicId?: string;
  username?: string;
  name: string;
  kind: string;
  location: string;
  bio: string;
  image?: string;
  popularity: number;
}

const selectedAudioWork = ref<PlayableItem | null>(null);
const autoplayToken = ref(0);
const topAudio = ref<HTMLAudioElement | null>(null);
const isTopPlaying = ref(false);
const playbackProgress = ref(0);
const playbackDuration = ref(0);
const nextPlayMode = ref<"creator" | "random">("creator");
const repeatAudioWork = ref(false);
const playerMinimized = ref(false);
const shareMessage = ref("");
const mediaViewerOpen = ref(false);
const viewerCollection = ref<CatalogItem[]>([]);
const activeMediaKey = ref("");
const viewerAudio = ref<HTMLAudioElement | null>(null);
const viewerVideo = ref<HTMLVideoElement | null>(null);
const slideshowActive = ref(false);
let slideshowTimer: number | undefined;
const waveformBars = Array.from({ length: 36 }, (_, index) => index + 1);
const allWorkTypes = ["music", "photography", "visual_art", "videography", "poetry", "other"];
type AppPage = "home" | "search" | "creator" | "work" | "publish" | "creations" | "profile";
type MediaKind = "audio" | "video" | "image" | "document" | "file";

const genres = computed(() => [...new Set(catalogItems.value.filter((item) => item.typeKey === "music").map((item) => item.genre).filter(Boolean))].sort());
const workTypes = computed(() => allWorkTypes);
const creatorWorkTypes = computed(() => {
  const types = new Map<string, Set<string>>();
  for (const item of catalogItems.value) {
    const nextTypes = types.get(item.creatorName) ?? new Set<string>();
    nextTypes.add(item.typeKey);
    types.set(item.creatorName, nextTypes);
  }
  return types;
});
const creatorMusicGenres = computed(() => {
  const musicGenres = new Map<string, Set<string>>();
  for (const item of catalogItems.value) {
    if (item.typeKey !== "music" || !item.genre) continue;
    const nextGenres = musicGenres.get(item.creatorName) ?? new Set<string>();
    nextGenres.add(item.genre);
    musicGenres.set(item.creatorName, nextGenres);
  }
  return musicGenres;
});
const currentPage = computed<AppPage>(() => {
  if (currentPath.value.startsWith("/creators/")) return "creator";
  if (currentPath.value.startsWith("/works/")) return "work";
  if (currentPath.value === "/search") return "search";
  if (currentPath.value === "/publish") return "publish";
  if (currentPath.value === "/my-creations") return "creations";
  if (currentPath.value === "/profile") return "profile";
  return "home";
});
const pageTitle = computed(() => {
  if (currentPage.value === "creator") return creatorDetail.value?.name ?? "Creator.";
  if (currentPage.value === "work") return workDetail.value?.title ?? "Work.";
  if (currentPage.value === "search") return "Search the catalog.";
  if (currentPage.value === "publish") return "Publish work.";
  if (currentPage.value === "creations") return "My creations.";
  if (currentPage.value === "profile") return "Profile.";
  return "Ethiopian underground, on your frequency.";
});
const pageIntro = computed(() => {
  if (currentPage.value === "creator") return creatorDetail.value ? `${creatorDetail.value.location || "Ethiopia"} / ${creatorDetail.value.kind}` : "Creator profile and published works.";
  if (currentPage.value === "work") return workDetail.value ? `${workDetail.value.creatorName} / ${workDetail.value.type}` : "Public work page.";
  if (currentPage.value === "search") return "Look up creators, cities, genres, and works when you are ready to dig deeper.";
  if (currentPage.value === "publish") return "Upload new music, photography, visual art, video, poetry, or other creative work to the catalog.";
  if (currentPage.value === "creations") return "Edit visibility, payment settings, names, and descriptions for every work you own.";
  if (currentPage.value === "profile") return "Update your circular profile image, account type, bio, and public creator information.";
  return "Find creators, follow the thread from place to rhythm, and listen to works outside the algorithm.";
});
const userInitials = computed(() => (user.value?.displayName ?? "Me").slice(0, 2).toUpperCase());
const creatorPopularity = computed(() => {
  const counts = new Map<string, number>();
  for (const work of works.value) counts.set(work.creator.displayName, (counts.get(work.creator.displayName) ?? 0) + work.playCount + 1);
  return counts;
});
const creatorCards = computed<CreatorCard[]>(() => {
  const profileCards = profiles.value
    .filter(isVisibleCreatorProfile)
    .map(profileToCreatorCard);
  return profileCards.sort((left, right) => right.popularity - left.popularity || left.name.localeCompare(right.name));
});
const popularCreators = computed(() => creatorCards.value.filter((creator) => creator.popularity > 0).slice(0, 3));
const creatorRouteId = computed(() => decodeURIComponent(currentPath.value.replace(/^\/creators\/?/, "")));
const creatorDetail = computed(() => {
  if (selectedCreator.value) {
    const fetchedCreator = profileToCreatorCard(selectedCreator.value);
    if (isCreatorRouteMatch(fetchedCreator, creatorRouteId.value)) return fetchedCreator;
  }
  return creatorCards.value.find((creator) => isCreatorRouteMatch(creator, creatorRouteId.value));
});
const workRouteKey = computed(() => decodeURIComponent(currentPath.value.replace(/^\/works\/?/, "")));
const playableItems = computed<PlayableItem[]>(() => {
  const musicWorks = works.value
    .filter((work) => normalizeWorkType(work.workType) === "music")
    .map((work) => ({
      id: `work-${work.id}`,
      key: `work-${work.id}`,
      title: work.title,
      audioFile: work.file,
      streamUrl: workStreamUrl(work.id)!,
      downloadUrl: workDownloadUrl(work.id)!,
      creatorName: work.creator.displayName,
      description: work.description,
      sourceType: "work" as const,
      sourceId: work.id,
      isPayable: work.isPayable,
      playCount: work.playCount,
      downloadCount: work.downloadCount,
    }));
  return musicWorks;
});
const catalogItems = computed<CatalogItem[]>(() => {
  const workItems = works.value.map((work) => {
    const playable = playableItems.value.find((item) => item.key === `work-${work.id}`);
    const workType = normalizeWorkType(work.workType);
    return {
      key: `work-${work.id}`,
      title: work.title,
      type: workType.replace("_", " "),
      typeKey: workType,
      genre: workType === "music" ? "music" : "",
      creatorId: `profile-${work.creator.id}`,
      creatorPublicId: work.creator.publicId || work.creator.username || work.creator.id,
      creatorName: work.creator.displayName,
      description: work.description,
      thumbnail: mediaUrl(work.thumbnail) ?? (isImageType(workType) ? workStreamUrl(work.id) : undefined),
      fileUrl: mediaUrl(work.file),
      openUrl: creatorProfilePath(work.creator.publicId || work.creator.username || work.creator.id),
      viewUrl: workStreamUrl(work.id)!,
      sharePath: publicWorkPath(`work-${work.id}`),
      creatorProfilePath: creatorProfilePath(work.creator.publicId || work.creator.username || work.creator.id),
      isPayable: work.isPayable,
      priceEtb: work.priceEtb,
      playCount: work.playCount,
      downloadCount: work.downloadCount,
      playable,
    };
  });
  return workItems;
});
const filteredCreators = computed(() => creatorCards.value.filter((creator) => {
  const term = submittedSearch.value.toLowerCase().trim();
  const creatorWorksForSearch = catalogItems.value.filter((item) => item.creatorName === creator.name);
  const matchesCreatorText = `${creator.name} ${creator.location} ${creator.kind} ${creator.bio}`.toLowerCase().includes(term);
  const matchesWorkText = creatorWorksForSearch.some((item) => `${item.title} ${item.type} ${item.genre} ${item.description ?? ""}`.toLowerCase().includes(term));
  const matchesText = !term || matchesCreatorText || matchesWorkText;
  const matchesType = !selectedWorkType.value || creatorWorkTypes.value.get(creator.name)?.has(selectedWorkType.value);
  const matchesMusicGenre = selectedWorkType.value !== "music" || !selectedMusicGenre.value || creatorMusicGenres.value.get(creator.name)?.has(selectedMusicGenre.value);
  return matchesText && matchesType && matchesMusicGenre;
}));
const filteredPlayableItems = computed(() => playableItems.value.filter((item) => {
  const term = submittedSearch.value.toLowerCase().trim();
  const matchesText = !term || `${item.title} ${item.creatorName} ${item.description ?? ""}`.toLowerCase().includes(term);
  const catalogItem = catalogItems.value.find((work) => work.playable?.key === item.key);
  const matchesType = !selectedWorkType.value || catalogItem?.typeKey === selectedWorkType.value;
  const matchesMusicGenre = selectedWorkType.value !== "music" || !selectedMusicGenre.value || catalogItem?.genre.toLowerCase() === selectedMusicGenre.value.toLowerCase();
  return matchesText && matchesType && matchesMusicGenre;
}));
const visibleCatalogItems = computed(() => {
  if (currentPage.value !== "search") return catalogItems.value;
  const term = submittedSearch.value.toLowerCase().trim();
  return catalogItems.value.filter((item) => {
    const matchesText = !term || `${item.title} ${item.creatorName} ${item.type} ${item.genre} ${item.description ?? ""}`.toLowerCase().includes(term);
    const matchesType = !selectedWorkType.value || item.typeKey === selectedWorkType.value;
    const matchesMusicGenre = selectedWorkType.value !== "music" || !selectedMusicGenre.value || item.genre.toLowerCase() === selectedMusicGenre.value.toLowerCase();
    return matchesText && matchesType && matchesMusicGenre;
  });
});
const popularCatalogItems = computed(() => catalogItems.value
  .sort((left, right) => right.playCount - left.playCount)
  .slice(0, 4));
const creatorWorks = computed(() => {
  const creator = creatorDetail.value;
  if (!creator) return [];
  return catalogItems.value.filter((item) => isCatalogItemByCreator(item, creator));
});
const workDetail = computed(() => catalogItems.value.find((item) => item.key === workRouteKey.value));
const creatorPlayableItems = computed(() => {
  if (!creatorDetail.value) return [];
  return playableItems.value.filter((item) => item.creatorName === creatorDetail.value?.name);
});
const activeMedia = computed(() => viewerCollection.value.find((item) => item.key === activeMediaKey.value) ?? null);
const activeMediaKind = computed<MediaKind>(() => inferMediaKind(activeMedia.value));
const activeMediaIndex = computed(() => viewerCollection.value.findIndex((item) => item.key === activeMediaKey.value));
const selectedAudioArtwork = computed(() => catalogItems.value.find((item) => item.playable?.key === selectedAudioWork.value?.key)?.thumbnail);

function goTo(path: string) {
  if (window.location.pathname !== path) window.history.pushState({}, "", path);
  currentPath.value = path;
  closeViewer();
  scrollToTop();
  refreshCatalog();
  loadCreatorForCurrentRoute();
}

function submitSearch() {
  submittedSearch.value = searchDraft.value;
  refreshCatalog();
}

function viewCreator(creator: CreatorCard) {
  goTo(creatorProfilePath(creator.publicId || creator.id));
}

function playCatalogItem(work: CatalogItem) {
  if (work.playable) {
    selectAudioWork(work.playable);
    return;
  }
  const sourceId = work.key.replace(/^work-/, "");
  selectAudioWork({
    id: work.key,
    key: work.key,
    title: work.title,
    audioFile: work.fileUrl,
    streamUrl: work.viewUrl,
    downloadUrl: workDownloadUrl(sourceId)!,
    creatorName: work.creatorName,
    description: work.description,
    sourceType: "work",
    sourceId,
    isPayable: work.isPayable,
    playCount: work.playCount,
    downloadCount: work.downloadCount,
  });
}

function selectAudioWork(work: PlayableItem | AudioWorkListItem) {
  if ("streamUrl" in work) {
    selectedAudioWork.value = work;
    autoplayToken.value += 1;
    playSelectedAudioWork();
    return;
  }
  selectedAudioWork.value = playableItems.value.find((item) => item.id === work.id) ?? null;
  autoplayToken.value += 1;
  playSelectedAudioWork();
}

function handleTopAudioPlay() {
  isTopPlaying.value = true;
  if (selectedAudioWork.value) recordPlay(selectedAudioWork.value);
}

function playSelectedAudioWork() {
  requestAnimationFrame(() => {
    if (!topAudio.value) return;
    topAudio.value.load();
    topAudio.value.play().catch(() => {
      isTopPlaying.value = false;
    });
  });
}

function toggleTopPlayback() {
  if (!topAudio.value) return;
  if (topAudio.value.paused) {
    topAudio.value.play().catch(() => {
      isTopPlaying.value = false;
    });
    return;
  }
  topAudio.value.pause();
}

function syncPlayerProgress() {
  if (!topAudio.value) return;
  playbackDuration.value = Number.isFinite(topAudio.value.duration) ? topAudio.value.duration : 0;
  playbackProgress.value = playbackDuration.value ? (topAudio.value.currentTime / playbackDuration.value) * 100 : 0;
}

function seekPlayer(event: Event) {
  if (!topAudio.value || !playbackDuration.value) return;
  const target = event.target as HTMLInputElement;
  const nextProgress = Number(target.value);
  topAudio.value.currentTime = (nextProgress / 100) * playbackDuration.value;
  playbackProgress.value = nextProgress;
}

function handleAudioEnded() {
  if (repeatAudioWork.value && topAudio.value && (!playerMinimized.value || !selectedAudioWork.value?.isPayable)) {
    topAudio.value.currentTime = 0;
    topAudio.value.play().catch(() => {
      isTopPlaying.value = false;
    });
    return;
  }
  playNextAudioWork();
}

function playNextAudioWork() {
  const pool = nextAudioPool();
  if (!pool.length) return;
  const currentIndex = pool.findIndex((work) => work.key === selectedAudioWork.value?.key);
  selectAudioWork(pool[(currentIndex + 1 + pool.length) % pool.length]);
}

function playPreviousAudioWork() {
  const pool = nextAudioPool();
  if (!pool.length) return;
  const currentIndex = pool.findIndex((work) => work.key === selectedAudioWork.value?.key);
  selectAudioWork(pool[(currentIndex - 1 + pool.length) % pool.length]);
}

function shuffleNextAudioWork() {
  const pool = nextAudioPool().filter((work) => work.key !== selectedAudioWork.value?.key);
  if (!pool.length) {
    playNextAudioWork();
    return;
  }
  selectAudioWork(pool[Math.floor(Math.random() * pool.length)]);
}

function nextAudioPool() {
  const availableAudioWorks = playerMinimized.value ? playableItems.value.filter((work) => !work.isPayable) : playableItems.value;
  if (!selectedAudioWork.value) return availableAudioWorks;
  if (nextPlayMode.value === "creator") {
    const creatorWorks = availableAudioWorks.filter((work) => work.creatorName === selectedAudioWork.value?.creatorName);
    return creatorWorks.length ? creatorWorks : availableAudioWorks;
  }
  const creatorsWithAudio = [...new Set(availableAudioWorks.map((work) => work.creatorName))].filter((creator) => creator !== selectedAudioWork.value?.creatorName);
  const randomCreator = creatorsWithAudio[Math.floor(Math.random() * creatorsWithAudio.length)];
  return randomCreator ? availableAudioWorks.filter((work) => work.creatorName === randomCreator) : availableAudioWorks;
}

async function recordPlay(work: PlayableItem) {
  try {
    const stats = await recordWorkPlay(work.sourceId);
    updateWorkStats(work.sourceId, stats.playCount, stats.downloadCount);
  } catch {
    // Playback should still work if stats recording fails.
  }
}

async function recordCatalogItemView(work: CatalogItem) {
  try {
    if (!work.key.startsWith("work-")) return;
    const workId = work.key.replace("work-", "");
    const stats = await recordWorkPlay(workId);
    updateWorkStats(workId, stats.playCount, stats.downloadCount);
  } catch {
    // Viewing should keep working even if the stats endpoint is unavailable.
  }
}

function updateWorkStats(workId: string | number, playCount: number, downloadCount: number) {
  const catalogWork = works.value.find((work) => String(work.id) === String(workId));
  if (catalogWork) {
    catalogWork.playCount = playCount;
    catalogWork.downloadCount = downloadCount;
  }
  if (selectedAudioWork.value && String(selectedAudioWork.value.sourceId) === String(workId)) {
    selectedAudioWork.value.playCount = playCount;
    selectedAudioWork.value.downloadCount = downloadCount;
  }
}

function openViewer(work: CatalogItem, collection: readonly CatalogItem[]) {
  viewerCollection.value = collection.length ? [...collection] : [work];
  activeMediaKey.value = work.key;
  mediaViewerOpen.value = true;
  recordCatalogItemView(work);
}

function closeViewer() {
  stopSlideshow();
  pauseViewerMedia();
  mediaViewerOpen.value = false;
}

function setViewerMedia(index: number) {
  if (!viewerCollection.value.length) return;
  const nextIndex = (index + viewerCollection.value.length) % viewerCollection.value.length;
  const nextItem = viewerCollection.value[nextIndex];
  activeMediaKey.value = nextItem.key;
  requestAnimationFrame(() => recordCatalogItemView(nextItem));
}

function previousMedia() {
  setViewerMedia(activeMediaIndex.value - 1);
}

function nextMedia() {
  setViewerMedia(activeMediaIndex.value + 1);
}

function pauseViewerMedia() {
  viewerAudio.value?.pause();
  viewerVideo.value?.pause();
}

function fastForwardMedia() {
  if (activeMediaKind.value === "image") {
    nextMedia();
    return;
  }
  const player = viewerAudio.value ?? viewerVideo.value;
  if (!player) return;
  const nextTime = player.currentTime + 15;
  player.currentTime = Number.isFinite(player.duration) ? Math.min(nextTime, player.duration) : nextTime;
}

function toggleSlideshow() {
  if (slideshowActive.value) {
    stopSlideshow();
    return;
  }
  slideshowActive.value = true;
  slideshowTimer = window.setInterval(nextMedia, 5000);
}

function stopSlideshow() {
  if (slideshowTimer) window.clearInterval(slideshowTimer);
  slideshowTimer = undefined;
  slideshowActive.value = false;
}

function inferMediaKind(work: CatalogItem | null): MediaKind {
  if (!work) return "file";
  const url = (work.fileUrl || work.viewUrl).toLowerCase().split("?")[0];
  if (work.playable || work.typeKey === "music" || /\.(mp3|m4a|wav|ogg|aac|flac)$/.test(url)) return "audio";
  if (work.typeKey === "videography" || /\.(mp4|webm|ogv|mov)$/.test(url)) return "video";
  if (/\.(pdf|txt)$/.test(url)) return "document";
  if (["photography", "visual_art"].includes(work.typeKey) || /\.(jpg|jpeg|png|gif|webp|avif)$/.test(url)) return "image";
  return "file";
}

async function payForWork(work: CatalogItem) {
  paymentError.value = "";
  const workId = work.key.replace("work-", "");
  try {
    const response = await initiateTelebirrPayment(workId);
    window.location.href = response.checkoutUrl;
  } catch (requestError) {
    paymentError.value = requestError instanceof Error ? requestError.message : "Telebirr checkout could not start";
  }
}

async function shareWork(work: CatalogItem) {
  const url = `${window.location.origin}${work.sharePath}`;
  shareMessage.value = "";
  try {
    if (navigator.share) {
      await navigator.share({ title: work.title, text: `${work.title} by ${work.creatorName}`, url });
      shareMessage.value = "Share sheet opened.";
      return;
    }
    await navigator.clipboard.writeText(url);
    shareMessage.value = "Public link copied.";
  } catch {
    shareMessage.value = url;
  }
}

function publicWorkPath(key: string) {
  return `/works/${encodeURIComponent(key)}`;
}

function isImageType(type: string) {
  return ["photography", "visual_art"].includes(type);
}

function isCreatorRouteMatch(creator: CreatorCard, routeId: string) {
  const normalizedRoute = normalizeRouteKey(routeId);
  return [creator.publicId, creator.username, creator.id, creator.name]
    .filter(Boolean)
    .some((value) => normalizeRouteKey(value) === normalizedRoute);
}

function isCatalogItemByCreator(item: CatalogItem, creator: CreatorCard) {
  return [item.creatorPublicId, item.creatorId, item.creatorName]
    .filter(Boolean)
    .some((value) => [creator.publicId, creator.username, creator.id, creator.name].filter(Boolean).some((creatorValue) => normalizeRouteKey(value) === normalizeRouteKey(creatorValue)));
}

function isVisibleCreatorProfile(profile: CatalogProfile) {
  if (profile.profileType === "creator") return true;
  return works.value.some((work) => isSameCreatorProfile(work.creator, profile));
}

function isSameCreatorProfile(left: CatalogProfile, right: CatalogProfile) {
  return [left.publicId, left.username, left.id, left.displayName]
    .filter(Boolean)
    .some((leftValue) => [right.publicId, right.username, right.id, right.displayName].filter(Boolean).some((rightValue) => normalizeRouteKey(leftValue) === normalizeRouteKey(rightValue)));
}

function profileToCreatorCard(profile: CatalogProfile): CreatorCard {
  return {
    id: `profile-${profile.id}`,
    publicId: profile.publicId || profile.username || profile.id,
    username: profile.username,
    name: profile.displayName,
    kind: profile.disciplines[0] ?? "creator",
    location: profile.location,
    bio: profile.bio,
    image: mediaUrl(profile.avatar),
    popularity: creatorPopularity.value.get(profile.displayName) ?? 0,
  };
}

function normalizeRouteKey(value?: string) {
  return decodeURIComponent(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^profile-/, "")
    .replace(/\s+/g, "-");
}

function handlePopState() {
  currentPath.value = window.location.pathname;
  scrollToTop();
  refreshCatalog();
  loadCreatorForCurrentRoute();
}

function scrollToTop() {
  requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: "auto" }));
}

function refreshCatalog() {
  load(currentPage.value === "search" ? submittedSearch.value : "", currentPage.value === "search" ? selectedWorkType.value : "");
}

function loadCreatorForCurrentRoute() {
  if (currentPage.value !== "creator" || !creatorRouteId.value) return;
  loadCreator(creatorRouteId.value);
}

function formatType(type: string) {
  return normalizeWorkType(type).replace("_", " ");
}

function normalizeWorkType(type: string) {
  return type.toLowerCase();
}

watch(selectedWorkType, () => {
  submittedSearch.value = searchDraft.value;
  if (selectedWorkType.value !== "music") selectedMusicGenre.value = "";
  refreshCatalog();
});
watch(selectedMusicGenre, () => {
  submittedSearch.value = searchDraft.value;
  refreshCatalog();
});
onMounted(() => {
  window.addEventListener("popstate", handlePopState);
  refreshCatalog();
  loadCreatorForCurrentRoute();
});
onUnmounted(() => {
  window.removeEventListener("popstate", handlePopState);
  stopSlideshow();
});
watch(activeMediaKind, (kind) => {
  if (kind !== "image") stopSlideshow();
});
watch(playerMinimized, (minimized) => {
  if (!minimized || !selectedAudioWork.value?.isPayable) return;
  const freeAudioWorks = playableItems.value.filter((work) => !work.isPayable);
  if (freeAudioWorks.length) {
    selectAudioWork(freeAudioWorks[0]);
    return;
  }
  topAudio.value?.pause();
});
</script>
