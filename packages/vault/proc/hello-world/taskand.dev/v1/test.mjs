import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
const r = spawnSync('node', [join(dir, 'bin.mjs')], { input: '{"ping":1}' });
if (r.status !== 0 || !JSON.parse(r.stdout).ok) {
  console.error('kontrakt ✗');
  process.exit(1);
}
console.log('kontrakt ✓ (fail-closed zachowany)');
