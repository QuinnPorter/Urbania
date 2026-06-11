import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  // Relative base so the build also works inside a Capacitor webview later.
  base: "./",
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Urbania",
        short_name: "Urbania",
        description: "Design your own city — roads, transit, parks, and more.",
        display: "standalone",
        orientation: "any",
        background_color: "#8fd16e",
        theme_color: "#8fd16e",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icons/icon-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
  },
});
