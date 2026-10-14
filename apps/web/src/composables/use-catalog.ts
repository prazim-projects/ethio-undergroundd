import { ref } from "vue";
import { CATALOG_QUERY, GET_CREATOR_QUERY } from "../queries/catalog";
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

  async function load(query = "", workType = "") {
    loading.value = true;
    error.value = "";
    try {
      const result = await queryGraphQL<CatalogResponse>(CATALOG_QUERY, {
        query: query || null,
        workType: workType || null,
        creativeLimit: 3,
        workLimit: 4,
        searchLimit: 60,
      });
      profiles.value = mergeById(result.popularCreatives, selectedCreator.value ? [selectedCreator.value] : []);
      works.value = mergeById(query || workType ? result.searchWorks : result.loadPopularWorks, selectedCreator.value?.works ?? []);
    } catch (requestError) {
      error.value = requestError instanceof Error ? requestError.message : "Unable to load catalog";
    } finally {
      loading.value = false;
    }
  }

  async function loadCreator(publicId: string) {
    loading.value = true;
    error.value = "";
    try {
      const result = await queryGraphQL<CreatorResponse>(GET_CREATOR_QUERY, { publicId });
      selectedCreator.value = result.getCreator;
      if (result.getCreator) {
        profiles.value = mergeById(profiles.value, [result.getCreator]);
        works.value = mergeById(works.value, result.getCreator.works);
      }
    } catch (requestError) {
      error.value = requestError instanceof Error ? requestError.message : "Unable to load creator";
    } finally {
      loading.value = false;
    }
  }

  return { profiles, works, selectedCreator, loading, error, load, loadCreator };
}

function mergeById<T extends { id: string }>(current: T[], incoming: T[]) {
  const items = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) items.set(item.id, item);
  return [...items.values()];
}
