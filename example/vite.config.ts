import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/** The example against the engine's source, so an edit under `src/` reloads here at once. */
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      justable: fileURLToPath(new URL('../src/index.ts', import.meta.url)),
    },
  },
});
