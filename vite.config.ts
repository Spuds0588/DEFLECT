import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    port: 5173,
    // Captures and test artifacts live in the repo. Watching them made a kiosk
    // `?demo=true` session reload every time a screenshot was written.
    watch: { ignored: ['**/screenshots/**'] },
  },
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
  },
});
