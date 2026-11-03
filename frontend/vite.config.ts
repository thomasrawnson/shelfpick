import {
  defineConfig,
} from "vite"

import react
  from "@vitejs/plugin-react"

import {
  VitePWA,
} from "vite-plugin-pwa"


export default defineConfig({
  define: {
    __SHELFPICK_LEGAL_DRAFTS__:
      JSON.stringify(
        process.env.VITE_LEGAL_DRAFTS_ENABLED
        === "true",
      ),
  },

  plugins: [
    react(),

    VitePWA({
      registerType:
        "autoUpdate",

      manifest: {
        name:
          "ShelfPick",

        short_name:
          "ShelfPick",

        description:
          "Pick the right board game for game night.",

        theme_color:
          "#315C48",

        background_color:
          "#F6F3EB",

        display:
          "standalone",

        orientation:
          "portrait",

        start_url:
          "/",

        scope:
          "/",

        icons: [
          {
            src:
              "/branding/pwa-192.png",

            sizes:
              "192x192",

            type:
              "image/png",

            purpose:
              "any",
          },
          {
            src:
              "/branding/pwa-512.png",

            sizes:
              "512x512",

            type:
              "image/png",

            purpose:
              "any",
          },
          {
            src:
              "/branding/pwa-maskable-192.png",

            sizes:
              "192x192",

            type:
              "image/png",

            purpose:
              "maskable",
          },
          {
            src:
              "/branding/pwa-maskable-512.png",

            sizes:
              "512x512",

            type:
              "image/png",

            purpose:
              "maskable",
          },
        ],
      },

      workbox: {
        cleanupOutdatedCaches:
          true,

        navigateFallback:
          "/index.html",

        globPatterns: [
          "**/*.{js,css,html,ico,png,svg,woff,woff2}",
        ],

        globIgnores: [
          "branding/shelfpick-icon-source.png",
          "branding/social-profile-1024.png",
        ],
      },
    }),
  ],
})
