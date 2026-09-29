import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // `example/` imports the package by its published name; here that name is `src/`.
    alias: [
      {
        find: /^@kihyun1998\/justable$/,
        replacement: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
      },
      {
        find: /^@kihyun1998\/justable\/style\.css$/,
        replacement: fileURLToPath(new URL('./src/style.css', import.meta.url)),
      },
    ],
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}', 'example/**/*.test.{ts,tsx}'],
  },
});
