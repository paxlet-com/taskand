import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
const bad = spawnSync('node', [join(dir, 'bin.mjs')], { input: 'invalid' });
if (bad.status !== 2) {
  console.error('Test 1 failed: oczekiwano exit 2');
  process.exit(1);
}

const good = spawnSync('node', [join(dir, 'bin.mjs')], { input: '{"text":"Zdanie pierwsze. Zdanie drugie."}' });
if (good.status !== 0) {
  console.error('Test 2 failed: oczekiwano exit 0');
  process.exit(1);
}
console.log('proc://taskand.dev/developer/test-auto/v1: kontrakt ✓');
