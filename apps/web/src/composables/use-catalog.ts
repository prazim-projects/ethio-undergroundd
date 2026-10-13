import { ref } from "vue";
import { CATALOG_QUERY } from "../queries/catalog";
import { queryGraphQL } from "../lib/graphql";

export interface CatalogArtist {
  id: string;
  publicId: string;
  name: string;
  genre: string;
  bio: string;
  location: string;
  albums: CatalogAlbum[];
}

export interface CatalogAlbum {
  id: string;
  title: string;
  releaseDate: string;
  coverImage?: string | null;
  tracks: CatalogTrack[];
}

export interface CatalogTrack {
  id: string;
  title: string;
  audioFile?: string | null;
  playCount: number;
  downloadCount: number;
  album: { title: string; artist: { name: string } };
}

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

interface CatalogResponse {
  allArtists: CatalogArtist[];
  allProfiles: CatalogProfile[];
  tracksByGenre: CatalogTrack[];
  allWorks: CreativeWork[];
}

export function useCatalog() {
  const artists = ref<CatalogArtist[]>([]);
  const profiles = ref<CatalogProfile[]>([]);
  const tracks = ref<CatalogTrack[]>([]);
  const loading = ref(false);
  const error = ref("");
  const works = ref<CreativeWork[]>([]);

  async function load(genre?: string) {
    loading.value = true;
    error.value = "";
    try {
      const result = await queryGraphQL<CatalogResponse>(CATALOG_QUERY, { genre: genre || null });
      artists.value = result.allArtists;
      profiles.value = result.allProfiles;
      tracks.value = result.tracksByGenre;
      works.value = result.allWorks;
    } catch (requestError) {
      error.value = requestError instanceof Error ? requestError.message : "Unable to load catalog";
    } finally {
      loading.value = false;
    }
  }

  return { artists, profiles, tracks, works, loading, error, load };
}
