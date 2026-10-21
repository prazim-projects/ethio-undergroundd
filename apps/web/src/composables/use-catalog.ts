import { ref } from "vue";
import { CATALOG_QUERY, GET_CREATOR_QUERY, GET_WORK_QUERY } from "../queries/catalog";
import { queryGraphQL } from "../lib/graphql";

export interface CreativeWork {
  id: string;
  title: string;
  workType: string;
  description: string;
  file: string;
  thumbnail?: string | null;
  isPayable: boolean;
  priceEtb: string;
  playCount: number;
  downloadCount: number;
  creator: CatalogProfile;
}

export interface CatalogProfile {
  id: string;
  publicId: string;
  username: string;
  displayName: string;
  profileType: "listener" | "creator";
  bio: string;
  location: string;
  disciplines: string[];
  avatar?: string | null;
}

export interface CreatorDetail extends CatalogProfile {
  works: CreativeWork[];
}

interface CatalogResponse {
  popularCreatives: CatalogProfile[];
  loadPopularWorks: CreativeWork[];
  searchWorks: CreativeWork[];
}

interface CreatorResponse {
  getCreator: CreatorDetail | null;
}

export function useCatalog() {
  const profiles = ref<CatalogProfile[]>([]);
  const loading = ref(false);
  const error = ref("");
  const works = ref<CreativeWork[]>([]);
  const selectedCreator = ref<CreatorDetail | null>(null);
  const selectedWork = ref<CreativeWork | null>(null);
  let requestVersion = 0;

  async function load(query = "", workType = "", force = false) {
    const version = ++requestVersion;
    loading.value = true;
    error.value = "";
    try {
      const result = await queryGraphQL<CatalogResponse>(CATALOG_QUERY, {
        query: query || null,
        workType: workType || null,
        creativeLimit: 12,
        workLimit: 12,
        searchLimit: 60,
      }, force);
      if (version !== requestVersion) return;
      profiles.value = result.popularCreatives;
      works.value = result.searchWorks;
    } catch (requestError) {
      if (version === requestVersion) error.value = requestError instanceof Error ? requestError.message : "Unable to load catalog";
    } finally {
      if (version === requestVersion) loading.value = false;
    }
  }

  async function loadCreator(publicId: string, force = false) {
    const version = ++requestVersion;
    loading.value = true;
    error.value = "";
    try {
      const result = await queryGraphQL<CreatorResponse>(GET_CREATOR_QUERY, { publicId }, force);
      if (version !== requestVersion) return;
      selectedCreator.value = result.getCreator;
      if (result.getCreator) {
        profiles.value = mergeById(profiles.value, [result.getCreator]);
        works.value = mergeById(works.value, result.getCreator.works);
      }
    } catch (requestError) {
      if (version === requestVersion) error.value = requestError instanceof Error ? requestError.message : "Unable to load creator";
    } finally {
      if (version === requestVersion) loading.value = false;
    }
  }

  async function loadWork(id: string, force = false) {
    const version = ++requestVersion;
    loading.value = true; error.value = ""; selectedWork.value = null;
    try {
      const result = await queryGraphQL<{ getWork: CreativeWork | null }>(GET_WORK_QUERY, { id }, force);
      if (version === requestVersion) selectedWork.value = result.getWork;
    } catch (err) {
      if (version === requestVersion) error.value = err instanceof Error ? err.message : "Unable to load work";
    } finally { if (version === requestVersion) loading.value = false; }
  }

  function updateStats(id: string, stats: { playCount: number; downloadCount: number }) {
    const items = [...works.value, ...(selectedCreator.value?.works ?? []), ...(selectedWork.value ? [selectedWork.value] : [])];
    for (const item of items) if (item.id === id) {
      item.playCount = Math.max(item.playCount, stats.playCount);
      item.downloadCount = Math.max(item.downloadCount, stats.downloadCount);
    }
  }

  return { profiles, works, selectedCreator, selectedWork, loading, error, load, loadCreator, loadWork, updateStats };
}

function mergeById<T extends { id: string }>(current: T[], incoming: T[]) {
  const items = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) items.set(item.id, item);
  return [...items.values()];
}
