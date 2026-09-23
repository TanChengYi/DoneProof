import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const cli = resolve('node_modules/playwright/cli.js');
const result = spawnSync(process.execPath, [cli, 'install', 'chromium-headless-shell'], {
  stdio: 'inherit',
  env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: '0' },
  windowsHide: true
});

if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
