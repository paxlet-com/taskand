import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
const res = spawnSync('node', [join(dir, 'bin.mjs')], { input: '{}', encoding: 'utf8' });
if (res.status !== 0) {
  console.error('Test failed: status !== 0', res.stderr);
  process.exit(1);
}
const out = JSON.parse(res.stdout);
if (!out.uri || out.service !== 'nginx') {
  console.error('Test failed: invalid output', out);
  process.exit(1);
}
console.log('proc://taskand.dev/nginx/status/v1: kontrakt ✓');
