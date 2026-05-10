import path from 'node:path';
import fs from 'node:fs';

const CRATE = 'forwardemail-desktop';

export function resolveAppBinary(): string {
  if (process.env.TAURI_E2E_BINARY) {
    return path.resolve(process.env.TAURI_E2E_BINARY);
  }

  const target = process.env.TAURI_TARGET;
  const repoRoot = path.resolve(process.cwd(), '..');
  const targetDir = path.join(
    repoRoot,
    'src-tauri',
    'target',
    ...(target ? [target] : []),
    'debug',
  );

  const binaryName = process.platform === 'win32' ? `${CRATE}.exe` : CRATE;
  const binaryPath = path.join(targetDir, binaryName);

  if (!fs.existsSync(binaryPath)) {
    throw new Error(
      [
        `Tauri debug binary not found at ${binaryPath}.`,
        `Build it first from the repo root:`,
        `  pnpm tauri build --debug --no-bundle --features webdriver${target ? ` --target ${target}` : ''}`,
        `(plain "cargo build" produces a binary with no embedded frontendDist —`,
        ` use the tauri CLI so index.html is registered.)`,
        `Or set TAURI_E2E_BINARY to an explicit path.`,
      ].join('\n'),
    );
  }
  return binaryPath;
}
