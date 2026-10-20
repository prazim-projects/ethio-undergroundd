import { fileURLToPath, URL } from "node:url";
import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";
import { VitePWA } from "vite-plugin-pwa";
import { resolveDeployment } from './config/deployment';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const native = mode === 'native';
  const env = { ...loadEnv(mode, process.cwd(), 'VITE_'), ...process.env, MODE: mode };
  const deployment = resolveDeployment(env, native);
  return {
  define: {
    'import.meta.env.VITE_API_URL': JSON.stringify(deployment.apiUrl),
    'import.meta.env.VITE_FRONTEND_URL': JSON.stringify(deployment.frontendUrl),
  },
  build: { outDir: native ? 'dist-native' : 'dist' },
  // Never bundle the downloadable APK inside another Android APK.
  publicDir: native ? false : 'public',
  plugins: [vue(), VitePWA({
    disable: native,
    registerType: "prompt",
    includeAssets: ["pwa-icon.svg", "icons/*.png"],
    manifest: {
      name: "Ethio Underground", short_name: "Underground",
      description: "Independent music and creative voices from Ethiopia.",
      id: "/", start_url: "/", scope: "/", display: "standalone",
      background_color: "#f9faf9", theme_color: "#171d19",
      icons: [
        { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
      ],
    },
    workbox: {
      importScripts: ["/sw-migration.js"],
      clientsClaim: true,
      globPatterns: ["**/*.{js,css,html,png,webp,svg,ico}"],
      maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      navigateFallback: "/index.html",
      navigateFallbackDenylist: [/^\/graphql/, /^\/auth\//, /^\/media\//, /^\/downloads\/.*\.apk$/, /^\/works\/\d+\//],
      cleanupOutdatedCaches: true,
      // Only build assets are precached. Never cache tokens, API responses or user media.
      runtimeCaching: [],
    },
  })],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
};
});
