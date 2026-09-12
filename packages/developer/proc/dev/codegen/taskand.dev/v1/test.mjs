import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));

// Test kontraktu
const r = spawnSync('node', [join(dir, 'bin.mjs')], {
  input: JSON.stringify({ name: "test-auto", description: "testowy proces" })
});

if (r.status !== 0) {
  console.error(`dev/codegen test failed: exit ${r.status}`);
  process.exit(1);
}

const res = JSON.parse(r.stdout);
if (!res.ok || !res.registeredUri) {
  console.error('dev/codegen test failed: brak zarejestrowanego URI');
  process.exit(1);
}

console.log('proc://taskand.dev/dev/codegen/v1: kontrakt ✓');
