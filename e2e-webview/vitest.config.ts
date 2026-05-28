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
    // beforeEach runs activateDemo, which waits for the demo seed to paint.
    // On slow Linux Xvfb runners that seed+paint takes ~30-40s, overrunning a
    // 30s hook ceiling before the readiness gate can clear. Give the hook room.
    hookTimeout: 90_000,
    reporters: ['default', ['junit', { outputFile: './reports/junit.xml' }]],
  },
});
