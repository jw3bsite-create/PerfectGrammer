import { defineConfig } from 'vitest/config';

// Browser-Prüfung: npm run e2e (baut vorher die App)
export default defineConfig({
  test: {
    environment: 'node',
    include: ['e2e/**/*.e2e.ts'],
    fileParallelism: false,
    testTimeout: 120_000,
    hookTimeout: 60_000,
  },
});
