import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue(), VitePWA({
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
      globPatterns: ["**/*.{js,css,html,png,svg,ico}"],
      navigateFallback: "/index.html",
      navigateFallbackDenylist: [/^\/graphql/, /^\/auth\//, /^\/media\//, /^\/works\/\d+\//],
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
});
