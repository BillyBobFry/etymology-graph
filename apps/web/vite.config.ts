import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  envDir: "../..",
  plugins: [vue(), tailwindcss()],
  server: {
    proxy: {
      "/api": "http://127.0.0.1:3000"
    }
  }
});
