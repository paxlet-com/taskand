import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));

const bad = spawnSync('node', [join(dir, 'bin.mjs')], { input: '{invalid json' });
if (bad.status !== 2) {
  console.error('Test 1 failed: status !== 2');
  process.exit(1);
}

const noOrg = spawnSync('node', [join(dir, 'bin.mjs')], { input: '{}' });
if (noOrg.status !== 2) {
  console.error('Test 2 failed: status !== 2 dla pustego payloadu');
  process.exit(1);
}

const good = spawnSync('node', [join(dir, 'bin.mjs')], { input: JSON.stringify({ organism: "vault", role: "security" }) });
if (good.status !== 0) {
  console.error('Test 3 failed: status !== 0', good.stderr);
  process.exit(1);
}
const out = JSON.parse(good.stdout);
if (!out.ok || !out.spawned || out.organism !== "vault") {
  console.error('Test 3 failed: niepoprawny output spawnu', out);
  process.exit(1);
}

console.log('proc://taskand.dev/doctor/spawn/v1: kontrakt ✓');
