import { defineConfig } from 'vitest/config';

// Server tests only (the real database is used, see server/tests/helpers.mjs).
export default defineConfig({
  test: {
    include: ['server/tests/**/*.test.mjs'],
    environment: 'node',
    testTimeout: 30000,
    hookTimeout: 60000,
    fileParallelism: false,
  },
});
