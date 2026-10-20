import { ref, watch } from "vue";
import { useAuth } from "./use-auth";
import { workStreamUrl } from "../lib/graphql";
import { offlineSource } from "../lib/offline";

export function useMediaSource(id: () => string | undefined) {
  const { user } = useAuth();
  const source = ref<string>();
  watch([id, () => user.value?.id], async ([workId, owner], _, cleanup) => {
    source.value = undefined;
    let stale = false;
    let release: (() => void) | undefined;
    cleanup(() => { stale = true; release?.(); });
    if (!workId) return;
    try {
      const local = owner ? await offlineSource(owner, workId) : undefined;
      if (stale) { local?.release(); return; }
      release = local?.release;
      source.value = local?.url ?? workStreamUrl(workId);
    } catch { if (!stale) source.value = workStreamUrl(workId); }
  }, { immediate: true });
  return source;
}
