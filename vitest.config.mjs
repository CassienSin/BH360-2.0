import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  test: {
    // These suites cover pure logic only — legal classification, date
    // arithmetic, string normalisation. No DOM, no Supabase, no network.
    environment: 'node',
    include: ['lib/__tests__/**/*.test.js'],
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('.', import.meta.url)) },
  },
})
