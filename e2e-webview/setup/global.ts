import { spawn, type ChildProcess } from 'node:child_process';

export default async function globalSetup() {
  const driver: ChildProcess = spawn('tauri-webdriver', [], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  await new Promise<void>((resolve, reject) => {
    driver.once('error', reject);
    // tauri-webdriver binds ports synchronously on startup; 2s is plenty.
    setTimeout(resolve, 2_000);
  });

  return async () => {
    if (!driver.killed) driver.kill('SIGTERM');
  };
}
