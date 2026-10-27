import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // the balance simulation plays 72 full matches
    testTimeout: 120_000,
    reporters: ['verbose'],
  },
})
