import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['specs/**/*.spec.ts'],
    globalSetup: ['./setup/global.ts'],
    setupFiles: ['./setup/per-test.ts'],
    // tauri-plugin-webdriver allows one WebDriver session per app instance.
    // Run spec files sequentially so sessions never overlap.
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 30_000,
    reporters: ['default', ['junit', { outputFile: './reports/junit.xml' }]],
  },
});
