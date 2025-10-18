// @ts-check
import { defineConfig } from "astro/config";

import tailwindcss from "@tailwindcss/vite";

import vercel from "@astrojs/vercel";

// https://astro.build/config
export default defineConfig({
  vite: {
    plugins: [tailwindcss()],
  },

  markdown: {
    syntaxHighlight: "shiki",
    shikiConfig: {
      theme: "material-theme-ocean",
    },
  },

  adapter: vercel(),
});