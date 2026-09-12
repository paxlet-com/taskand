import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));

const bad = spawnSync('node', [join(dir, 'bin.mjs')], { input: '{bad json' });
if (bad.status !== 2) {
  console.error('Test 1 failed: oczekiwano exit 2 przy złym JSON');
  process.exit(1);
}

const good = spawnSync('node', [join(dir, 'bin.mjs')], { input: '{"targetRole":"core-controller"}' });
if (good.status !== 0) {
  console.error('Test 2 failed: oczekiwano exit 0');
  process.exit(1);
}

console.log('proc://taskand.dev/bootstrap/handover/v1: kontrakt ✓');
