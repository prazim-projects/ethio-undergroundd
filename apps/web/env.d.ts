/// <reference types="vite-plugin-pwa/vue" />
/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly MODE: string;
  readonly VITE_API_URL?: string;
  readonly VITE_FRONTEND_URL?: string;
  readonly VITE_ANDROID_APK_URL?: string;
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  google?: {
    accounts: {
      id: {
        initialize: (options: { client_id: string; callback: (response: { credential: string }) => void }) => void;
        renderButton: (element: HTMLElement, options: { theme: string; size: string; width: number }) => void;
      };
    };
  };
}

declare module "*.vue" {
  import type { DefineComponent } from "vue";

  const component: DefineComponent<{}, {}, any>;

  export default component;
}
