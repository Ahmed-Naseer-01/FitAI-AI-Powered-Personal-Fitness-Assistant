import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'prisma/**/*.test.ts'],
    globalSetup: ['./vitest.globalSetup.mts'],
    setupFiles: ['./vitest.setup.mts'],
    // The AI client tests exercise real backoff waits.
    testTimeout: 30000,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
})
