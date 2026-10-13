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
            <TrackList :tracks="playableItems" @select="selectTrack" />
            <AudioPlayer v-if="selectedTrack" :title="selectedTrack.title" :src="selectedTrack.streamUrl" :download-url="selectedTrack.downloadUrl" :autoplay-token="autoplayToken" />
            <div v-else class="empty-state empty-state--small">Select a music work to start listening.</div>
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
            <h2 class="mb-4 text-2xl font-semibold">Search results</h2>
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
            <TrackList :tracks="filteredPlayableItems" @select="selectTrack" />
            <AudioPlayer v-if="selectedTrack" :title="selectedTrack.title" :src="selectedTrack.streamUrl" :download-url="selectedTrack.downloadUrl" :autoplay-token="autoplayToken" />
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
                  <img v-if="work.thumbnail" class="work-row__thumb" :src="work.thumbnail" :alt="work.title" />
                  <div v-else class="work-row__thumb work-row__thumb--empty">{{ work.type }}</div>
                  <div class="work-row__body">
                    <span class="eyebrow">{{ work.type }}</span>
                    <h3>{{ work.title }}</h3>
                    <p>{{ work.description || "Published by " + work.creatorName }}</p>
                    <p class="work-row__stats">{{ work.playCount }} plays / {{ work.downloadCount }} downloads</p>
                  </div>
                  <div class="work-row__actions">
                    <button v-if="work.playable" class="text-button" type="button" @click="selectTrack(work.playable)">Play</button>
                    <button v-if="work.isPayable" class="text-button" type="button" @click="payForWork(work)">Pay {{ work.priceEtb }} ETB</button>
                    <a class="work-card__link" :href="work.openUrl" @click.prevent="goTo(work.openUrl)">Artist profile</a>
                  </div>
                </article>
              </div>
              <div v-else class="empty-state">No works are published for this creator yet.</div>
            </div>
            <aside class="space-y-4">
              <TrackList :tracks="creatorPlayableItems" @select="selectTrack" />
              <AudioPlayer v-if="selectedTrack" :title="selectedTrack.title" :src="selectedTrack.streamUrl" :download-url="selectedTrack.downloadUrl" :autoplay-token="autoplayToken" />
            </aside>
          </div>
        </section>
        <p v-else-if="loading" class="py-12 text-center text-[#68716a]">Loading creator profile...</p>
        <div v-else class="empty-state">That creator page could not be found.</div>
      </template>

      <template v-else-if="currentPage === 'publish'">
        <section class="grid gap-5 lg:grid-cols-[.85fr_1.15fr]">
          <AuthPanel />
          <WorkUpload @go-profile="goTo('/profile')" />
          <div v-if="!isAuthenticated" class="page-panel">
            <span class="eyebrow">Publish access</span>
            <h2>Sign in to publish.</h2>
            <p class="page-panel__intro">Artist / creator accounts can upload music, photography, visual art, video, poetry, and other work from this page.</p>
          </div>
        </section>
      </template>

      <template v-else-if="currentPage === 'creations'">
        <MyCreations />
      </template>

      <template v-else>
        <section class="grid gap-5 lg:grid-cols-[.85fr_1.15fr]">
          <AuthPanel />
          <ProfilePanel />
        </section>
      </template>

      <section v-if="!loading && !error && currentPage !== 'profile'" class="mt-14">
        <div class="mb-5 flex items-end justify-between">
          <div><span class="eyebrow">The open shelf</span><h2 class="mt-1 text-3xl font-semibold">Works and tracks</h2></div>
          <span class="text-sm text-[#68716a]">{{ visibleCatalogItems.length }} shown</span>
        </div>
        <p v-if="paymentError" class="form-error">{{ paymentError }}</p>
        <div class="work-list">
          <article v-for="work in visibleCatalogItems" :key="work.key" class="work-row">
            <img v-if="work.thumbnail" class="work-row__thumb" :src="work.thumbnail" :alt="work.title" />
            <div v-else class="work-row__thumb work-row__thumb--empty">{{ work.type }}</div>
            <div class="work-row__body">
              <span class="eyebrow">{{ work.type }}</span>
              <h3>{{ work.title }}</h3>
              <p>{{ work.description || "Published by " + work.creatorName }}</p>
              <p class="work-row__stats">{{ work.playCount }} plays / {{ work.downloadCount }} downloads</p>
            </div>
            <div class="work-row__actions">
              <button v-if="work.playable" class="text-button" type="button" @click="selectTrack(work.playable)">Play</button>
              <button v-if="work.isPayable" class="text-button" type="button" @click="payForWork(work)">Pay {{ work.priceEtb }} ETB</button>
              <a class="work-card__link" :href="work.openUrl" @click.prevent="goTo(work.openUrl)">Artist profile</a>
            </div>
          </article>
        </div>
      </section>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { AudioPlayer, TrackList } from "ui";
import type { TrackListItem } from "ui";
import { artistProfilePath, initiateTelebirrPayment, mediaUrl, recordTrackPlay, recordWorkPlay, trackDownloadUrl, trackStreamUrl, workDownloadUrl, workStreamUrl } from "./lib/graphql";
import { useCatalog } from "./composables/use-catalog";
import { useAuth } from "./composables/use-auth";
import AuthPanel from "./components/AuthPanel.vue";
import WorkUpload from "./components/WorkUpload.vue";
import ProfilePanel from "./components/ProfilePanel.vue";
import MyCreations from "./components/MyCreations.vue";

const { artists, profiles, tracks, works, loading, error, load } = useCatalog();
const { user, isAuthenticated } = useAuth();
const searchDraft = ref("");
const submittedSearch = ref("");
const selectedWorkType = ref("");
const selectedMusicGenre = ref("");
const currentPath = ref(window.location.pathname);
const paymentError = ref("");

interface PlayableItem extends TrackListItem {
  key: string;
  streamUrl: string;
  downloadUrl: string;
  creatorName: string;
  description?: string;
  sourceType: "work" | "track";
  sourceId: string;
  playCount: number;
  downloadCount: number;
}
interface CatalogItem {
  key: string;
  title: string;
  type: string;
  typeKey: string;
  genre: string;
  creatorName: string;
  description?: string;
  thumbnail?: string;
  openUrl: string;
  playable?: PlayableItem;
  creatorProfilePath: string;
  isPayable: boolean;
  priceEtb: string;
  playCount: number;
  downloadCount: number;
}
interface CreatorCard {
  id: string;
  publicId: string;
  name: string;
  kind: string;
  location: string;
  bio: string;
  image?: string;
  popularity: number;
}

const selectedTrack = ref<PlayableItem | null>(null);
const autoplayToken = ref(0);
type AppPage = "home" | "search" | "creator" | "publish" | "creations" | "profile";

const genres = computed(() => [...new Set(artists.value.map((artist) => artist.genre).filter(Boolean))].sort());
const workTypes = computed(() => [...new Set(catalogItems.value.map((item) => item.typeKey))].sort());
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
  if (currentPath.value === "/search") return "search";
  if (currentPath.value === "/publish") return "publish";
  if (currentPath.value === "/my-creations") return "creations";
  if (currentPath.value === "/profile") return "profile";
  return "home";
});
const pageTitle = computed(() => {
  if (currentPage.value === "creator") return creatorDetail.value?.name ?? "Creator.";
  if (currentPage.value === "search") return "Search the catalog.";
  if (currentPage.value === "publish") return "Publish work.";
  if (currentPage.value === "creations") return "My creations.";
  if (currentPage.value === "profile") return "Profile.";
  return "Ethiopian underground, on your frequency.";
});
const pageIntro = computed(() => {
  if (currentPage.value === "creator") return creatorDetail.value ? `${creatorDetail.value.location || "Ethiopia"} / ${creatorDetail.value.kind}` : "Creator profile and published works.";
  if (currentPage.value === "search") return "Look up creators, cities, genres, and works when you are ready to dig deeper.";
  if (currentPage.value === "publish") return "Upload new music, photography, visual art, video, poetry, or other creative work to the catalog.";
  if (currentPage.value === "creations") return "Edit visibility, payment settings, names, and descriptions for every work you own.";
  if (currentPage.value === "profile") return "Update your circular profile image, account type, bio, and public artist information.";
  return "Find creators, follow the thread from place to rhythm, and listen to works outside the algorithm.";
});
const userInitials = computed(() => (user.value?.displayName ?? "Me").slice(0, 2).toUpperCase());
const creatorPopularity = computed(() => {
  const counts = new Map<string, number>();
  for (const work of works.value) counts.set(work.creator.displayName, (counts.get(work.creator.displayName) ?? 0) + work.playCount + work.downloadCount * 2 + 1);
  for (const track of tracks.value) counts.set(track.album.artist.name, (counts.get(track.album.artist.name) ?? 0) + track.playCount + track.downloadCount * 2 + 1);
  return counts;
});
const creatorCards = computed<CreatorCard[]>(() => {
  const profileCards = profiles.value
    .filter((profile) => profile.profileType === "creator")
    .map((profile) => ({
      id: `profile-${profile.id}`,
      publicId: profile.publicId,
      name: profile.displayName,
      kind: profile.disciplines[0] ?? "creator",
      location: profile.location,
      bio: profile.bio,
      image: mediaUrl(profile.avatar),
      popularity: creatorPopularity.value.get(profile.displayName) ?? 0,
    }));
  const legacyCards = artists.value.map((artist) => ({
    id: `artist-${artist.id}`,
    publicId: artist.publicId,
    name: artist.name,
    kind: artist.genre,
    location: artist.location,
    bio: artist.bio,
    image: mediaUrl(artist.albums.find((album) => album.coverImage)?.coverImage),
    popularity: creatorPopularity.value.get(artist.name) ?? 0,
  }));
  return [...profileCards, ...legacyCards].sort((left, right) => right.popularity - left.popularity || left.name.localeCompare(right.name));
});
const popularCreators = computed(() => creatorCards.value.filter((creator) => creator.popularity > 0).slice(0, 4));
const creatorRouteId = computed(() => decodeURIComponent(currentPath.value.replace(/^\/creators\/?/, "")));
const creatorDetail = computed(() => creatorCards.value.find((creator) => creator.publicId === creatorRouteId.value || creator.id === creatorRouteId.value));
const playableItems = computed<PlayableItem[]>(() => {
  const musicWorks = works.value
    .filter((work) => work.workType === "music")
    .map((work) => ({
      id: `work-${work.id}`,
      key: `work-${work.id}`,
      title: work.title,
      audioFile: work.file,
      album: { title: work.creator.displayName, artist: { name: work.creator.displayName } },
      streamUrl: workStreamUrl(work.id)!,
      downloadUrl: workDownloadUrl(work.id)!,
      creatorName: work.creator.displayName,
      description: work.description,
      sourceType: "work" as const,
      sourceId: work.id,
      playCount: work.playCount,
      downloadCount: work.downloadCount,
    }));
  const legacyTracks = tracks.value
    .filter((track) => track.audioFile)
    .map((track) => ({
      ...track,
      key: `track-${track.id}`,
      streamUrl: trackStreamUrl(track.id)!,
      downloadUrl: trackDownloadUrl(track.id)!,
      creatorName: track.album.artist.name,
      sourceType: "track" as const,
      sourceId: track.id,
      playCount: track.playCount,
      downloadCount: track.downloadCount,
    }));
  return [...musicWorks, ...legacyTracks];
});
const catalogItems = computed<CatalogItem[]>(() => {
  const workItems = works.value.map((work) => {
    const playable = playableItems.value.find((item) => item.key === `work-${work.id}`);
    return {
      key: `work-${work.id}`,
      title: work.title,
      type: work.workType.replace("_", " "),
      typeKey: work.workType,
      genre: work.workType === "music" ? "music" : "",
      creatorName: work.creator.displayName,
      description: work.description,
      thumbnail: mediaUrl(work.thumbnail),
      openUrl: artistProfilePath(work.creator.publicId),
      creatorProfilePath: artistProfilePath(work.creator.publicId),
      isPayable: work.isPayable,
      priceEtb: work.priceEtb,
      playCount: work.playCount,
      downloadCount: work.downloadCount,
      playable,
    };
  });
  const trackItems = tracks.value.map((track) => ({
    key: `track-${track.id}`,
    title: track.title,
    type: "music",
    typeKey: "music",
    genre: artists.value.find((artist) => artist.name === track.album.artist.name)?.genre ?? "",
    creatorName: track.album.artist.name,
    description: track.album.title,
    openUrl: artistProfilePath(artists.value.find((artist) => artist.name === track.album.artist.name)?.publicId ?? track.album.artist.name),
    creatorProfilePath: artistProfilePath(artists.value.find((artist) => artist.name === track.album.artist.name)?.publicId ?? track.album.artist.name),
    isPayable: false,
    priceEtb: "0.00",
    playCount: track.playCount,
    downloadCount: track.downloadCount,
    playable: playableItems.value.find((item) => item.key === `track-${track.id}`),
  }));
  return [...workItems, ...trackItems];
});
const filteredCreators = computed(() => creatorCards.value.filter((creator) => {
  const term = submittedSearch.value.toLowerCase().trim();
  const matchesText = !term || `${creator.name} ${creator.location} ${creator.kind} ${creator.bio}`.toLowerCase().includes(term);
  const matchesType = !selectedWorkType.value || creatorWorkTypes.value.get(creator.name)?.has(selectedWorkType.value);
  const matchesMusicGenre = selectedWorkType.value !== "music" || !selectedMusicGenre.value || creatorMusicGenres.value.get(creator.name)?.has(selectedMusicGenre.value);
  return matchesText && matchesType && matchesMusicGenre;
}));
const filteredPlayableItems = computed(() => playableItems.value.filter((item) => {
  const term = submittedSearch.value.toLowerCase().trim();
  const matchesText = !term || `${item.title} ${item.creatorName} ${item.album.title} ${item.description ?? ""}`.toLowerCase().includes(term);
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
const creatorWorks = computed(() => {
  if (!creatorDetail.value) return [];
  return catalogItems.value.filter((item) => item.creatorName === creatorDetail.value?.name);
});
const creatorPlayableItems = computed(() => {
  if (!creatorDetail.value) return [];
  return playableItems.value.filter((item) => item.creatorName === creatorDetail.value?.name);
});

function goTo(path: string) {
  if (window.location.pathname !== path) window.history.pushState({}, "", path);
  currentPath.value = path;
  scrollToTop();
}

function submitSearch() {
  submittedSearch.value = searchDraft.value;
}

function viewCreator(creator: CreatorCard) {
  selectedTrack.value = playableItems.value.find((track) => track.creatorName === creator.name) ?? null;
  goTo(artistProfilePath(creator.publicId));
}

function selectTrack(track: PlayableItem | TrackListItem) {
  if ("streamUrl" in track) {
    selectedTrack.value = track;
    recordPlay(track);
    autoplayToken.value += 1;
    return;
  }
  selectedTrack.value = playableItems.value.find((item) => item.id === track.id) ?? null;
  if (selectedTrack.value) recordPlay(selectedTrack.value);
  autoplayToken.value += 1;
}

async function recordPlay(track: PlayableItem) {
  try {
    if (track.sourceType === "work") await recordWorkPlay(track.sourceId);
    else await recordTrackPlay(track.sourceId);
  } catch {
    // Playback should still work if stats recording fails.
  }
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

function handlePopState() {
  currentPath.value = window.location.pathname;
  scrollToTop();
}

function scrollToTop() {
  requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: "auto" }));
}

watch(playableItems, (items) => {
  if (!selectedTrack.value && items.length) selectedTrack.value = items[0];
});
function formatType(type: string) {
  return type.replace("_", " ");
}

watch(selectedWorkType, () => {
  submittedSearch.value = searchDraft.value;
  if (selectedWorkType.value !== "music") selectedMusicGenre.value = "";
});
watch(selectedMusicGenre, () => {
  submittedSearch.value = searchDraft.value;
});
onMounted(() => {
  window.addEventListener("popstate", handlePopState);
  load();
});
watch(selectedMusicGenre, (genre) => load(selectedWorkType.value === "music" ? genre || undefined : undefined));
</script>
