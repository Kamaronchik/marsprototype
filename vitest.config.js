import { defineConfig } from 'vitest/config';

// Server tests use the real database (see server/tests/helpers.mjs).
// Page tests (src/**/*.test.jsx) render a page in jsdom with a fake server.
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: {
    include: ['server/tests/**/*.test.mjs', 'src/**/*.test.jsx'],
    environment: 'node',
    testTimeout: 30000,
    hookTimeout: 60000,
    fileParallelism: false,
  },
});
