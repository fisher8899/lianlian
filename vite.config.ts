import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// https://vitejs.dev/config/
export default defineConfig(async () => ({
  plugins: [vue()],

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
  },
  // 3. to make use of `TAURI_PLATFORM`, `TAURI_ARCH`, `TAURI_FAMILY`, `TAURI_PLATFORM_VERSION`, `TAURI_PLATFORM_TYPE` and `TAURI_DEBUG` env variables
  envPrefix: ['VITE_', 'TAURI_'],
}));
