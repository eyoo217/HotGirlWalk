import { defineConfig } from 'vite';

export default defineConfig({
  base: '/HotGirlWalk/', // Replace YOUR_REPO_NAME with your actual repo name
  server: {
    proxy: {
      "/api": "http://localhost:5000",
    },
  }
});
